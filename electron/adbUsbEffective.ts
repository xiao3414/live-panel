import type { AppConfig } from "./types.js";
import { adbShell } from "./adb.js";

/** OEM USBEnable：是否允许 USB 数据传输（MTP/PTP 等），非「线缆已连接」 */
export function usbDataEnabledFromConfigProp(raw: string | null): boolean | null {
  if (raw == null || raw === "") return null;
  const c = raw.trim().toLowerCase();
  if (c === "none" || c === "null") return false;
  if (
    c.includes("mtp") ||
    c.includes("ptp") ||
    c.includes("mass_storage") ||
    c.includes("file_transfer")
  ) {
    return true;
  }
  if (c.includes("charging") || c.includes("charge_only")) {
    return false;
  }
  /** 仅 adb 调试：与 OEM Disable USB 数据一致 */
  if (c.includes("adb") && !c.includes("mtp") && !c.includes("ptp")) {
    return false;
  }
  return null;
}

export async function readUsbEnableEffectiveRaw(
  config: AppConfig,
): Promise<string | null> {
  try {
    let cfg = await adbShell(config, "getprop sys.usb.config", 6000);
    if (!cfg || cfg === "null") {
      cfg = await adbShell(config, "getprop persist.sys.usb.config", 6000);
    }
    const fromProp = usbDataEnabledFromConfigProp(cfg);
    if (fromProp != null) return fromProp ? "1" : "0";
  } catch {
    /* ignore */
  }
  return null;
}
