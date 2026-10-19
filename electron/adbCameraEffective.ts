import type { AppConfig } from "./types.js";
import { adbShell } from "./adb.js";

/** USDK 允许但用户/策略 no_camera 时，实况应视为禁用 */
export async function isCameraEffectivelyDisabled(
  config: AppConfig,
): Promise<boolean> {
  try {
    const out = await adbShell(config, "dumpsys user", 12_000);
    if (!out) return false;
    const idx = out.indexOf("Effective restrictions:");
    if (idx < 0) {
      return /\bno_camera\b/.test(out);
    }
    const slice = out.slice(idx, idx + 400);
    return /\bno_camera\b/.test(slice);
  } catch {
    return false;
  }
}
