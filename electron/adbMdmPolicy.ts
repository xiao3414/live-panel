import type { AppConfig, ProbeResult } from "./types.js";
import { adbShell } from "./adb.js";
import type { PlayProtectEffective } from "./adbPlayProtectEffective.js";
import {
  playProtectPlatformMessage,
  usbVerifyPlatformMessage,
} from "./platformPolicyCopy.js";

export type MdmPolicySnapshot = {
  effective: Set<string>;
  global: Set<string>;
  mdmLabel: string;
  /** dumpsys user: Device managed: true */
  deviceManaged: boolean;
  /** dumpsys device_policy: Enabled Device Admins 非空 */
  hasActiveDeviceAdmin: boolean;
};

function parseRestrictionBlock(text: string, header: string): string[] {
  const idx = text.indexOf(header);
  if (idx < 0) return [];
  const tail = text.slice(idx + header.length);
  const lines = tail.split("\n");
  const keys: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (keys.length) break;
      continue;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(t)) break;
    keys.push(t);
  }
  return keys;
}

export function parseDumpsysUserPolicy(out: string): Pick<
  MdmPolicySnapshot,
  "effective" | "global"
> {
  const effective = new Set(
    parseRestrictionBlock(out, "Effective restrictions:"),
  );
  for (const k of parseRestrictionBlock(out, "Restrictions:")) {
    effective.add(k);
  }
  const global = new Set(
    parseRestrictionBlock(out, "Device policy global restrictions:"),
  );
  for (const k of global) effective.add(k);
  return { effective, global };
}

export function parseDeviceManagedFromUser(out: string): boolean {
  return /Device managed:\s*true\b/i.test(out);
}

/** 不解析 Guest restrictions 模板，仅 Enabled Device Admins 段 */
export function parseHasEnabledDeviceAdmin(dpmOut: string): boolean {
  const idx = dpmOut.indexOf("Enabled Device Admins");
  if (idx < 0) return false;
  const slice = dpmOut.slice(idx, idx + 1200);
  return /ComponentInfo\{/.test(slice);
}

export function mdmLabelFromDevicePolicy(out: string): string {
  if (/soti\.mobicontrol/i.test(out)) return "SOTI MobiControl";
  if (/net\.soti\./i.test(out)) return "SOTI";
  const m = out.match(/admin=ComponentInfo\{([^/}]+)/);
  if (m?.[1]) {
    const pkg = m[1].trim();
    if (pkg.includes("mobicontrol")) return "SOTI MobiControl";
    return pkg;
  }
  return "";
}

/** 企业 MDM 托管（SOTI/MobiControl 或 Device managed + 活跃 Device Admin） */
export function isEnterpriseMdmManaged(snap: MdmPolicySnapshot | null): boolean {
  if (!snap) return false;
  if (/soti|mobicontrol/i.test(snap.mdmLabel)) return true;
  return snap.deviceManaged && snap.hasActiveDeviceAdmin;
}

export async function readMdmPolicySnapshot(
  config: AppConfig,
): Promise<MdmPolicySnapshot | null> {
  try {
    const [userOut, dpmOut] = await Promise.all([
      adbShell(config, "dumpsys user", 12_000),
      adbShell(config, "dumpsys device_policy", 14_000),
    ]);
    if (!userOut && !dpmOut) return null;
    const parsed = parseDumpsysUserPolicy(userOut ?? "");
    return {
      ...parsed,
      mdmLabel: mdmLabelFromDevicePolicy(dpmOut ?? userOut ?? ""),
      deviceManaged: parseDeviceManagedFromUser(userOut ?? ""),
      hasActiveDeviceAdmin: parseHasEnabledDeviceAdmin(dpmOut ?? ""),
    };
  } catch {
    return null;
  }
}

function hasRestriction(snap: MdmPolicySnapshot, key: string): boolean {
  return snap.effective.has(key) || snap.global.has(key);
}

function withPlatformExempt(
  r: ProbeResult,
  message: string,
): ProbeResult {
  return {
    ...r,
    platformCompareExempt: { message },
    supportStatus: "not_allowed" as const,
    supportMessage: message,
  };
}

/**
 * 不受 OEM JSON 控制的平台项：不参与「与配置不符」对比。
 * 须同时满足「策略键存在」与「企业 MDM 托管」，避免未接 SOTI 设备误判。
 */
export function applyPlatformCompareExempt(
  results: ProbeResult[],
  snap: MdmPolicySnapshot | null,
  playProtect?: PlayProtectEffective | null,
): ProbeResult[] {
  const managed = isEnterpriseMdmManaged(snap);
  return results.map((r) => {
    if (!r.ok) return r;

    if (
      r.probeId === "sec.verify_apps_usb" &&
      snap &&
      managed &&
      hasRestriction(snap, "ensure_verify_apps")
    ) {
      const label = snap.mdmLabel || "MDM";
      const msg = usbVerifyPlatformMessage(label);
      return withPlatformExempt(r, msg);
    }

    if (
      r.probeId === "sec.google_play_protect" &&
      playProtect &&
      isPlayProtectMdmUiControlled(playProtect, snap)
    ) {
      const label = snap?.mdmLabel || "SOTI MobiControl";
      const msg = playProtectPlatformMessage(label);
      return withPlatformExempt(r, msg);
    }

    return r;
  });
}

/** Play 保护：企业 MDM + SOTI 标签 + consent=-1 */
export function isPlayProtectMdmUiControlled(
  effective: PlayProtectEffective,
  snap: MdmPolicySnapshot | null,
): boolean {
  if (!snap || !isEnterpriseMdmManaged(snap)) return false;
  if (!/soti|mobicontrol/i.test(snap.mdmLabel)) return false;
  return effective.consent === "-1";
}

/** 未知来源：仅在企业 MDM 对用户生效 no_install_unknown_sources 时强制读为禁止 */
export function unknownSourcesBlockedByMdm(
  snap: MdmPolicySnapshot | null,
): boolean {
  if (!snap || !isEnterpriseMdmManaged(snap)) return false;
  return (
    snap.effective.has("no_install_unknown_sources") ||
    snap.global.has("no_install_unknown_sources")
  );
}
