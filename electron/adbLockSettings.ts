import type { AppConfig } from "./types.js";
import { adbShell, settingsGet } from "./adb.js";
import { normalizeLockPasswordTypeRaw } from "./oemNormalize.js";

export type LockSettingsSummary = {
  credentialType: string | null;
  hasLskfProtector: boolean;
  /** secure lockscreen.password_type；null 表示未写入该键 */
  passwordType: number | null;
  /** lockscreen.disabled：1=关闭屏幕锁定 → 锁屏方式为「无」 */
  screenLockEnabled: boolean | null;
  quality: number | null;
  passwordHandleCount: number | null;
};

export function mapCredentialTypeToLockSet(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();
  if (t === "NONE" || t === "UNSET") return "none";
  if (t.includes("SWIPE") || t.includes("SLIDE")) return "slide";
  if (t.includes("PATTERN")) return "pattern";
  if (t.includes("PIN")) return "pin";
  if (t.includes("PASSWORD")) return "pin";
  return null;
}

export function lockSetFromPasswordType(passwordType: number | null): string | null {
  if (passwordType == null || Number.isNaN(passwordType)) return null;
  if (passwordType === 65536) return "slide";
  if (passwordType === 131072 || passwordType === 262144) return "pin";
  if (passwordType === 196608) return "pattern";
  if (passwordType === 0) return "none";
  return null;
}

export function parseLockSettingsDumpsys(text: string): LockSettingsSummary {
  let credentialType: string | null = null;
  let hasLskfProtector = false;
  let quality: number | null = null;
  let passwordHandleCount: number | null = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.includes("LSKF-based SP protector ID:")) {
      const id = trimmed.split(":").slice(1).join(":").trim();
      if (id && id !== "null") hasLskfProtector = true;
    }
    if (trimmed.startsWith("CredentialType:")) {
      credentialType = trimmed.slice("CredentialType:".length).trim();
    }
    if (trimmed.startsWith("Quality:")) {
      const q = Number(trimmed.slice("Quality:".length).trim());
      if (Number.isFinite(q)) quality = q;
    }
    if (trimmed.startsWith("PasswordHandleCount:")) {
      const n = Number(trimmed.slice("PasswordHandleCount:".length).trim());
      if (Number.isFinite(n)) passwordHandleCount = n;
    }
  }
  return {
    credentialType,
    hasLskfProtector,
    passwordType: null,
    screenLockEnabled: null,
    quality,
    passwordHandleCount,
  };
}

async function readPasswordTypeInt(config: AppConfig): Promise<number | null> {
  try {
    const raw = await settingsGet(config, "secure", "lockscreen.password_type");
    if (raw == null || raw === "" || raw === "null") return null;
    const normalized = normalizeLockPasswordTypeRaw(raw);
    if (normalized === "slide") return 65536;
    if (normalized === "pin") return 262144;
    if (normalized === "pattern") return 196608;
    if (normalized === "none") return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function readScreenLockEnabled(config: AppConfig): Promise<boolean | null> {
  try {
    const raw = await settingsGet(config, "secure", "lockscreen.disabled");
    if (raw == null || raw === "" || raw === "null") return true;
    return raw.trim() !== "1";
  } catch {
    return null;
  }
}

export async function readLockSettingsSummary(
  config: AppConfig,
): Promise<LockSettingsSummary | null> {
  try {
    const [passwordType, screenLockEnabled] = await Promise.all([
      readPasswordTypeInt(config),
      readScreenLockEnabled(config),
    ]);
    const out = await adbShell(config, "dumpsys lock_settings", 14_000);
    if (!out || out.length < 20) {
      return {
        credentialType: null,
        hasLskfProtector: false,
        passwordType,
        screenLockEnabled,
        quality: null,
        passwordHandleCount: null,
      };
    }
    const summary = parseLockSettingsDumpsys(out);
    summary.passwordType = passwordType;
    summary.screenLockEnabled = screenLockEnabled;
    return summary;
  } catch {
    return null;
  }
}

/**
 * 锁屏方式仅两类 OEM 语义：
 * - none：屏幕锁定关闭（lockscreen.disabled=1）或 password_type 明确为 0
 * - slide：password_type=65536 / 凭据为 SWIPE，或「锁定已开 + 无 PIN/图案凭据」的滑动态
 * 不用「非 PIN 即 slide」的排除法；LSKF  alone 不判 PIN。
 */
export function lockSetRawFromSummary(summary: LockSettingsSummary): string | null {
  if (summary.screenLockEnabled === false) return "none";

  const fromPt = lockSetFromPasswordType(summary.passwordType);
  if (fromPt === "slide" || fromPt === "pin" || fromPt === "pattern") {
    return fromPt;
  }
  if (fromPt === "none") return "none";

  if (summary.quality === 65536) return "slide";

  const cred = mapCredentialTypeToLockSet(summary.credentialType);
  if (cred === "slide" || cred === "pin" || cred === "pattern") return cred;

  const handles = summary.passwordHandleCount ?? 0;

  if (
    summary.screenLockEnabled === true &&
    (summary.passwordType == null || summary.passwordType < 0) &&
    (cred === "none" || cred == null) &&
    handles === 0
  ) {
    return "slide";
  }

  if (cred === "none" && summary.passwordType === 0) return "none";

  return null;
}

export function lockPasswordSetFromSummary(summary: LockSettingsSummary): boolean {
  const set = lockSetRawFromSummary(summary);
  return set === "pin" || set === "pattern";
}
