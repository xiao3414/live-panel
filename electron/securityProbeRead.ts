import type { AppConfig, ProbeResult, ProbeSpec } from "./types.js";
import { buildProbeResultFromRead } from "./probeRunner.js";
import { runProbesParallel } from "./runProbesParallel.js";
import {
  securityBridgeGetBatch,
  securityBridgeGetMany,
} from "./securityBridge.js";
import { isCameraEffectivelyDisabled } from "./adbCameraEffective.js";
import {
  lockPasswordSetFromSummary,
  lockSetRawFromSummary,
  readLockSettingsSummary,
} from "./adbLockSettings.js";
import {
  applyPlatformCompareExempt,
  readMdmPolicySnapshot,
  unknownSourcesBlockedByMdm,
} from "./adbMdmPolicy.js";
import { readInstallUnknownAppsEffectiveRaw } from "./adbUnknownSourcesEffective.js";
import { readPlayProtectEffectiveRaw } from "./adbPlayProtectEffective.js";
import { readUsbEnableEffectiveRaw } from "./adbUsbEffective.js";

/** 21 项一次 batch，减少广播轮次 */
const BATCH_CHUNK = 21;
const FILL_CONCURRENCY = 4;
const READ_DEADLINE_MS = 32_000;

function featureOf(spec: ProbeSpec): string | null {
  if (spec.probe.kind === "security.bridge") return spec.probe.feature;
  return null;
}

function hasRaw(hit: { raw: string | null } | undefined): boolean {
  return hit?.raw != null && hit.raw !== "";
}

export function isUsdkRuntimeBroken(note?: string | null): boolean {
  if (!note) return false;
  return (
    note.includes("Failed resolution") ||
    note.includes("DeviceManagerEx") ||
    note.includes("NoClassDefFoundError") ||
    note.includes("usdk_not_available")
  );
}

function mapProbeResults(
  probeIds: string[],
  byId: Map<string, ProbeSpec>,
  batch: Map<string, { raw: string | null; note?: string }>,
  deadlineNote?: string,
): ProbeResult[] {
  return probeIds.map((id) => {
    const spec = byId.get(id);
    if (!spec) {
      return {
        probeId: id,
        ok: false,
        raw: null,
        display: "未注册",
        error: `未知 probe: ${id}`,
        at: Date.now(),
      };
    }
    const feature = featureOf(spec);
    if (!feature) {
      return {
        probeId: id,
        ok: false,
        raw: null,
        display: "非 Security 桥接项",
        error: "probe kind mismatch",
        at: Date.now(),
      };
    }
    const hit = batch.get(feature);
    const note =
      hit?.note ?? (!hasRaw(hit) && deadlineNote ? deadlineNote : undefined);
    return buildProbeResultFromRead(spec, hit?.raw ?? null, note);
  });
}

/** Security 页读数：单次 batch 全量 → 少量补读 → 必要时 ADB 并行兜底 */
export async function readSecurityProbeResults(
  config: AppConfig,
  probeIds: string[],
  byId: Map<string, ProbeSpec>,
): Promise<ProbeResult[]> {
  const batch = new Map<string, { raw: string | null; note?: string }>();
  const features: string[] = [];
  for (const id of probeIds) {
    const spec = byId.get(id);
    const f = spec ? featureOf(spec) : null;
    if (f) features.push(f);
  }

  const deadline = Date.now() + READ_DEADLINE_MS;
  const timedOut = () => Date.now() >= deadline;

  if (features.length && !timedOut()) {
    const part = await securityBridgeGetBatch(config, features);
    const unknownOp = [...part.values()].some((v) =>
      (v.note ?? "").includes("unknown op"),
    );
    for (const [k, v] of part) batch.set(k, v);
    if (unknownOp) {
      return runProbesParallel(config, probeIds, byId, 6);
    }
  }

  let missing = features.filter((f) => !hasRaw(batch.get(f)));
  if (missing.length && !timedOut()) {
    const filled = await securityBridgeGetMany(
      config,
      missing,
      FILL_CONCURRENCY,
    );
    for (const [k, v] of filled) batch.set(k, v);
  }

  const deadlineNote = timedOut()
    ? "读数超时，请检查 USB 或点「刷新设备」"
    : undefined;
  const mapped = mapProbeResults(probeIds, byId, batch, deadlineNote);
  const usdkDead = mapped.every(
    (r) => !r.ok && isUsdkRuntimeBroken(r.error ?? r.display),
  );
  if (usdkDead) {
    return runProbesParallel(config, probeIds, byId, 6);
  }
  return enrichSecurityProbeResults(config, mapped, byId);
}

async function enrichSecurityProbeResults(
  config: AppConfig,
  results: ProbeResult[],
  byId: Map<string, ProbeSpec>,
): Promise<ProbeResult[]> {
  const ids = new Set(results.map((r) => r.probeId));
  const needLock =
    ids.has("sec.screen_lock_set") || ids.has("sec.screen_lock_password");
  const needCamera = ids.has("sec.camera_access");
  const needUnknownSource = ids.has("sec.unknown_source");
  const needPlayProtect = ids.has("sec.google_play_protect");
  const needUsb = ids.has("sec.usb");

  const lockSummary = needLock ? await readLockSettingsSummary(config) : null;
  const cameraBlocked = needCamera
    ? await isCameraEffectivelyDisabled(config)
    : false;
  const [mdmSnap, unknownEffective, playProtectEffective, usbEffective] =
    await Promise.all([
      readMdmPolicySnapshot(config),
      needUnknownSource
        ? readInstallUnknownAppsEffectiveRaw(config)
        : Promise.resolve(null),
      needPlayProtect
        ? readPlayProtectEffectiveRaw(config)
        : Promise.resolve(null),
      needUsb ? readUsbEnableEffectiveRaw(config) : Promise.resolve(null),
    ]);

  const enriched: ProbeResult[] = results.map((r) => {
    const spec = byId.get(r.probeId);
    if (!spec) return r;

    if (r.probeId === "sec.screen_lock_set" && lockSummary) {
      const adbSet = lockSetRawFromSummary(lockSummary);
      if (adbSet !== null && adbSet !== undefined && adbSet !== r.raw) {
        const next = buildProbeResultFromRead(spec, adbSet);
        if (adbSet === "slide" && r.raw !== "slide") {
          return {
            ...next,
            supportMessage:
              "ADB：屏幕锁定已开且无 PIN/图案 → 滑动；与「无锁屏」(disabled=1) 区分",
          };
        }
        if (adbSet === "none" && r.raw !== "none") {
          return {
            ...next,
            supportMessage: "ADB：lockscreen.disabled=1 或 password_type=0 → 无",
          };
        }
        return next;
      }
    }

    if (r.probeId === "sec.screen_lock_password" && lockSummary) {
      if (
        lockPasswordSetFromSummary(lockSummary) &&
        (r.raw == null || r.raw === "")
      ) {
        return buildProbeResultFromRead(spec, "set");
      }
    }

    if (
      r.probeId === "sec.camera_access" &&
      cameraBlocked &&
      r.raw === "1"
    ) {
      return {
        ...buildProbeResultFromRead(spec, "0"),
        supportMessage: "USDK 为允许，但系统策略 no_camera（相机不可用）",
        supportStatus: "unsupported" as const,
      };
    }

    if (r.probeId === "sec.unknown_source" && unknownEffective) {
      const bridged = buildProbeResultFromRead(spec, unknownEffective.raw);
      if (unknownEffective.detail) {
        return {
          ...bridged,
          supportMessage: unknownEffective.detail,
          supportStatus: undefined,
        };
      }
      return bridged;
    }

    if (r.probeId === "sec.unknown_source" && unknownSourcesBlockedByMdm(mdmSnap)) {
      return buildProbeResultFromRead(spec, "0");
    }

    if (r.probeId === "sec.usb" && usbEffective != null) {
      const bridged = buildProbeResultFromRead(spec, usbEffective);
      if (usbEffective !== r.raw) {
        return {
          ...bridged,
          supportMessage:
            r.raw === "1" && usbEffective === "0"
              ? "USDK 为启用；按 sys.usb.config 判定为仅充电/ADB，USB 数据传输关"
              : undefined,
        };
      }
      return bridged;
    }

    if (r.probeId === "sec.google_play_protect" && playProtectEffective) {
      const bridged = buildProbeResultFromRead(
        spec,
        playProtectEffective.raw,
      );
      const usdkOn = r.raw === "1";
      const overridden = usdkOn !== (playProtectEffective.raw === "1");
      let out: ProbeResult = bridged;
      if (overridden && playProtectEffective.detail) {
        out = { ...out, supportMessage: playProtectEffective.detail };
      } else if (playProtectEffective.detail) {
        out = { ...out, supportMessage: playProtectEffective.detail };
      }
      return out;
    }

    return r;
  });
  return applyPlatformCompareExempt(enriched, mdmSnap, playProtectEffective);
}
