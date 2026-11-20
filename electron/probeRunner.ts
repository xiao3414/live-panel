import type { AppConfig, ProbeResult, ProbeRunnerSpec, ProbeSpec } from "./types.js";
import { adbShell, settingsGet } from "./adb.js";
import {
  classifyDeviceError,
  softReadSupportHint,
} from "./probeSupport.js";
import {
  normalizeLockPasswordTypeRaw,
  normalizeUsbModeFromProp,
} from "./oemNormalize.js";
import { securityBridgeGet } from "./securityBridge.js";
import { scanWedgeProperty } from "./scanWedgeRead.js";
import { dockingBridgeGetField } from "./dockingBridge.js";
import {
  isDeviceCharging,
  POWER_SAVE_CHARGING_NOTE,
} from "./adbBatteryCharging.js";
import {
  isOemVolumeSettingsKey,
  readOemVolumePercent,
} from "./volumeAudio.js";
import {
  fontScaleToOem,
  isDisplayFontScaleKey,
  isDisplayTimeoutKey,
  isStayAwakeKey,
  stayAwakeRawToOem,
  timeoutMsToOem,
} from "./displayOem.js";
import { resolveSideAppBarSupport } from "./sideAppBarCapability.js";

const SIDE_APP_BAR_FEATURES = new Set(["side_app_bar", "side_app_bar_left"]);

/** YAML 数字枚举（如 12/24）会被解析成 number，统一成 string 再比 */
function labelText(v: unknown): string {
  return v == null ? "" : String(v);
}

export function probeLabelFor(
  spec: ProbeSpec,
  raw: string | null,
): string {
  if (raw == null || raw === "") return "—";
  if (raw === "null" || raw === "NULL") return "未设置";
  const labels = spec.labels;
  if (labels && raw in labels) return labelText(labels[raw]);
  if (labels) {
    const nt = raw.trim().toLowerCase().replace(/\s+/g, "_");
    for (const [k, label] of Object.entries(labels)) {
      if (k === raw) continue;
      const text = labelText(label);
      if (!text) continue;
      if (text.toLowerCase() === raw.trim().toLowerCase()) return text;
      if (text.trim().toLowerCase().replace(/\s+/g, "_") === nt) {
        return text;
      }
    }
  }
  return raw;
}

async function runRunner(
  config: AppConfig,
  runner: ProbeRunnerSpec,
  shellTimeoutMs?: number,
): Promise<{
  raw: string | null;
  note?: string;
  displayOverride?: string;
  unsupported?: boolean;
  supportMessage?: string;
  volumeMax?: number;
}> {
  switch (runner.kind) {
    case "static": {
      const note = runner.note ?? "";
      // 动作型（Clear/Add/Cancel 等）：无设备持久态，对比豁免，避免「未读到」
      if (/^\[动作\]/.test(note.trim())) {
        return {
          raw: null,
          note,
          unsupported: true,
          supportMessage: note.replace(/^\[动作\]\s*/, "") || note,
        };
      }
      return { raw: null, note };
    }
    case "usdk":
      if (runner.fallback) {
        return runRunner(config, runner.fallback);
      }
      return { raw: null, note: `USDK ${runner.api} 未实现` };
    case "scan.profile": {
      const { raw, note } = await scanWedgeProperty(config, runner.property);
      return { raw, note };
    }
    case "docking.field": {
      const got = await dockingBridgeGetField(config, runner.field);
      if (got.unsupported) {
        return {
          raw: null,
          note: got.supportMessage ?? got.note ?? `Docking ${runner.field} 本机不支持`,
          displayOverride: got.supportMessage ?? "本机不支持",
          unsupported: true,
          supportMessage: got.supportMessage,
        };
      }
      if (got.raw != null && got.raw !== "") return { raw: got.raw, note: got.note };
      // DHCP 下空地址：ok + 空串，避免对比区「未读到」
      if (got.raw === "" && got.note?.includes("DHCP")) {
        return { raw: "", note: got.note, displayOverride: "—" };
      }
      return {
        raw: null,
        note: got.note ?? `Docking 字段 ${runner.field} 未读到`,
      };
    }
    case "scan.field": {
      const prop = runner.property;
      if (prop) {
        const { raw, note } = await scanWedgeProperty(config, prop);
        if (raw != null && raw !== "") return { raw, note };
        return {
          raw: null,
          note: note ?? `ScanWedge 属性 ${prop} 未读到（${runner.oemPath}）`,
        };
      }
      return {
        raw: null,
        note: `ScanWedge 属性待映射 · ${runner.oemPath}`,
      };
    }
    case "security.bridge": {
      if (SIDE_APP_BAR_FEATURES.has(runner.feature)) {
        const cap = await resolveSideAppBarSupport(config);
        if (!cap.supported) {
          return {
            raw: null,
            unsupported: true,
            supportMessage:
              cap.note ??
              "侧边栏仅 DT630 等机型支持，本项免测",
          };
        }
      }
      const { raw, note } = await securityBridgeGet(config, runner.feature);
      // 禁用输入法列表为空是合法读数（已全部解除禁用），勿当成未读到
      if (runner.feature === "disable_imi" && raw != null) {
        const list = String(raw).trim();
        return {
          raw: list,
          displayOverride: list ? list : "（无禁用）",
        };
      }
      if (raw != null && raw !== "") return { raw };
      if (runner.fallback) {
        const fb = await runRunner(config, runner.fallback);
        if (fb.raw != null && fb.raw !== "") return fb;
        if (!note) return fb;
      }
      return { raw, note };
    }
    case "adb.settings": {
      // Sound 音量：OEM 百分比为主，档位仅作量化
      if (isOemVolumeSettingsKey(runner.key)) {
        const vol = await readOemVolumePercent(config, runner.key);
        if (vol.raw != null) {
          return { raw: vol.raw, volumeMax: vol.volumeMax };
        }
        return { raw: null, note: vol.note };
      }
      let raw = await settingsGet(config, runner.namespace, runner.key);
      if (runner.key === "lockscreen.password_type") {
        raw = normalizeLockPasswordTypeRaw(raw) ?? raw;
      }
      // Display：设备 raw → OEM 文案
      if (isDisplayFontScaleKey(runner.key)) {
        const oem = fontScaleToOem(raw);
        if (oem) return { raw: oem, displayOverride: oem };
      }
      if (isDisplayTimeoutKey(runner.key)) {
        const oem = timeoutMsToOem(raw);
        if (oem) return { raw: oem, displayOverride: oem };
      }
      if (isStayAwakeKey(runner.key)) {
        const oem = stayAwakeRawToOem(raw);
        if (oem) return { raw: oem, displayOverride: oem };
      }
      return { raw };
    }
    case "adb.shell": {
      let raw = await adbShell(config, runner.cmd, shellTimeoutMs ?? 8000);
      if (runner.parse === "regex" && runner.pattern) {
        const re = new RegExp(runner.pattern);
        const m = raw.match(re);
        raw = m?.[1] ?? raw;
      }
      if (runner.parse === "contains" && runner.map) {
        const entries = Object.entries(runner.map).sort(
          (a, b) => b[0].length - a[0].length,
        );
        for (const [needle, mapped] of entries) {
          if (raw.includes(needle)) {
            if (
              mapped === "0" ||
              mapped === "1" ||
              mapped === "true" ||
              mapped === "false"
            ) {
              return { raw: mapped };
            }
            return { raw: needle, displayOverride: mapped };
          }
        }
        const usb = normalizeUsbModeFromProp(raw);
        if (usb != null) return { raw: usb };
      }
      return { raw };
    }
    default:
      return { raw: null, note: "未知 probe kind" };
  }
}

function resolveReadRunner(spec: ProbeSpec): ProbeRunnerSpec {
  if (spec.readAfterWrite) return spec.readAfterWrite;
  if (spec.probe.kind === "usdk" && spec.probe.fallback) {
    return spec.probe.fallback;
  }
  return spec.probe;
}

function shortenReadNote(note: string): string {
  if (note.includes("Failed resolution") || note.includes("DeviceManagerEx")) {
    return "USDK 不可用";
  }
  if (note.includes("桥接无响应")) return "桥接无响应";
  if (note.includes("Security 批量读") || note.includes("securityGetBatch")) {
    return "读失败";
  }
  if (note.length > 56) return `${note.slice(0, 56)}…`;
  return note;
}

function buildDisplay(
  spec: ProbeSpec,
  raw: string | null,
  note?: string,
  displayOverride?: string,
): string {
  if (displayOverride) return displayOverride;
  if (note && (raw == null || raw === "")) return shortenReadNote(note);
  if (spec.display.type === "diff") {
    return note ?? "导入 SOTI 策略 JSON 后可对账";
  }
  return probeLabelFor(spec, raw);
}

/** 写入后快速回读（仅单探针，不走 group） */
export async function readProbeValue(
  config: AppConfig,
  spec: ProbeSpec,
  shellTimeoutMs = 3500,
): Promise<ProbeResult> {
  const at = Date.now();
  const runner = resolveReadRunner(spec);
  const { raw, note, displayOverride } = await runRunner(
    config,
    runner,
    shellTimeoutMs,
  );
  return {
    probeId: spec.id,
    ok: true,
    raw,
    display: buildDisplay(spec, raw, note, displayOverride),
    at,
  };
}

export function buildProbeResultFromRead(
  spec: ProbeSpec,
  raw: string | null,
  note?: string,
  displayOverride?: string,
): ProbeResult {
  const at = Date.now();
  let resolvedRaw = raw;
  let resolvedOverride = displayOverride;
  // 禁用列表空串为合法读数
  if (
    spec.probe.kind === "security.bridge" &&
    spec.probe.feature === "disable_imi" &&
    raw != null
  ) {
    const list = String(raw).trim();
    resolvedRaw = list;
    resolvedOverride = resolvedOverride ?? (list ? list : "（无禁用）");
  }
  const display = buildDisplay(spec, resolvedRaw, note, resolvedOverride);
  const readFailed = (resolvedRaw == null || resolvedRaw === "") && Boolean(note);
  // disable_imi 空列表不算读失败
  const emptyListOk =
    spec.probe.kind === "security.bridge" &&
    spec.probe.feature === "disable_imi" &&
    resolvedRaw === "";
  const soft = softReadSupportHint(display, resolvedRaw);
  return {
    probeId: spec.id,
    ok: emptyListOk ? true : !readFailed,
    raw: resolvedRaw,
    display,
    error: emptyListOk || !readFailed ? undefined : note,
    supportStatus: soft?.status,
    supportMessage: soft?.userMessage,
    at,
  };
}

export function probeResultFromWriteMode(
  spec: ProbeSpec,
  mode: "on" | "off",
): ProbeResult {
  const raw = mode === "on" ? "1" : "0";
  const labels = spec.labels;
  const display =
    mode === "on"
      ? (labels?.["1"] ?? labels?.["true"] ?? "开")
      : (labels?.["0"] ?? labels?.["false"] ?? "关");
  return {
    probeId: spec.id,
    ok: true,
    raw,
    display,
    at: Date.now(),
  };
}

export async function executeProbe(
  config: AppConfig,
  spec: ProbeSpec,
  registryById: Map<string, ProbeSpec>,
): Promise<ProbeResult> {
  const at = Date.now();
  try {
    if (spec.display.type === "group" && spec.probe.kind === "static") {
      const members = spec.probe.members ?? [];
      const lines: string[] = [];
      for (const mid of members) {
        const child = registryById.get(mid);
        if (!child) {
          lines.push(`${mid}: ?`);
          continue;
        }
        const childRes = await executeProbe(config, child, registryById);
        lines.push(`${child.item}: ${childRes.display}`);
      }
      return {
        probeId: spec.id,
        ok: true,
        raw: null,
        display: lines.join("\n"),
        at,
      };
    }

    const {
      raw,
      note,
      displayOverride,
      unsupported,
      supportMessage,
      volumeMax,
    } = await runRunner(config, spec.probe);
    if (unsupported) {
      const msg = supportMessage ?? displayOverride ?? note ?? "本机不支持";
      return {
        probeId: spec.id,
        ok: true,
        raw: null,
        display: msg,
        supportStatus: "unsupported",
        supportMessage: msg,
        platformCompareExempt: { message: msg },
        at,
      };
    }
    let display: string;
    if (displayOverride) {
      display = displayOverride;
    } else if (note && (raw == null || raw === "")) {
      display = note;
    } else if (spec.display.type === "diff") {
      display = note ?? "导入 SOTI 策略 JSON 后可对账";
    } else {
      display = probeLabelFor(spec, raw);
    }
    const soft = softReadSupportHint(display, raw);
    let out: ProbeResult = {
      probeId: spec.id,
      ok: true,
      raw,
      display,
      supportStatus: soft?.status,
      supportMessage: soft?.userMessage,
      volumeMax,
      at,
    };
    if (
      spec.probe.kind === "security.bridge" &&
      spec.probe.feature === "power_save_mode" &&
      (raw === "0" || raw === "false") &&
      (await isDeviceCharging(config))
    ) {
      out = {
        ...out,
        supportMessage: POWER_SAVE_CHARGING_NOTE,
        platformCompareExempt: { message: POWER_SAVE_CHARGING_NOTE },
      };
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const classified = classifyDeviceError(msg);
    return {
      probeId: spec.id,
      ok: false,
      raw: null,
      display:
        classified.status === "ok" ? "错误" : classified.userMessage,
      error: msg,
      supportStatus: classified.status === "ok" ? undefined : classified.status,
      supportMessage:
        classified.status === "ok" ? undefined : classified.userMessage,
      at,
    };
  }
}
