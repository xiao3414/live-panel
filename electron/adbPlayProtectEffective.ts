import type { AppConfig } from "./types.js";
import { settingsGet } from "./adb.js";
export type PlayProtectEffective = {
  raw: "0" | "1";
  consent: string;
  detail?: string;
};

/**
 * Play 保护「扫描应用」与 USDK getPackageVerifierUserConsent 可能不一致；
 * 以 Settings.Global.package_verifier_user_consent 对齐 Play 保护机制 UI。
 */
export async function readPlayProtectEffectiveRaw(
  config: AppConfig,
): Promise<PlayProtectEffective | null> {
  try {
    const consent = await settingsGet(
      config,
      "global",
      "package_verifier_user_consent",
    );
    if (consent == null || consent === "" || consent === "null") {
      return null;
    }
    if (consent === "1") {
      return { raw: "1", consent };
    }
    return {
      raw: "0",
      consent,
      detail: "Play 保护机制扫描未开启。",
    };
  } catch {
    return null;
  }
}

/**
 * 「工作政策 + MDM 管控 UI」：开关置灰、文案提示 IT 管理员等，OEM JSON 无法单独决定。
 * 与 USB 的 ensure_verify_apps 不同键，但面板同样视为「平台强制、不参与 JSON 不符」。
 */