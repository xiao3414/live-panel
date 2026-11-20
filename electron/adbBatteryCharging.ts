import type { AppConfig } from "./types.js";
import { adbShell } from "./adb.js";

/** dumpsys battery：USB/AC/无线任一供电视为充电中 */
export async function isDeviceCharging(config: AppConfig): Promise<boolean> {
  try {
    const out = await adbShell(config, "dumpsys battery", 5000);
    const lines = out.split(/\r?\n/);
    let usb = false;
    let ac = false;
    let wireless = false;
    let status = "";
    for (const line of lines) {
      const t = line.trim();
      if (/^USB powered:\s*/i.test(t)) {
        usb = /:\s*true\s*$/i.test(t);
      } else if (/^AC powered:\s*/i.test(t)) {
        ac = /:\s*true\s*$/i.test(t);
      } else if (/^Wireless powered:\s*/i.test(t)) {
        wireless = /:\s*true\s*$/i.test(t);
      } else if (/^status:\s*/i.test(t)) {
        status = t.replace(/^status:\s*/i, "").trim();
      }
    }
    if (usb || ac || wireless) return true;
    // 2=charging, 5=full（插电满电仍算在充）
    if (status === "2" || status === "5") return true;
    return false;
  } catch {
    return false;
  }
}

export const POWER_SAVE_CHARGING_NOTE =
  "省电模式不能充电时开启（库：不能充电时推送）；当前 ADB/USB 充电中，实况 Disable 属平台限制，不作不符";
