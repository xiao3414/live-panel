/** 与 SecurityBridge.mapLockType 对齐 */
export function normalizeLockPasswordTypeRaw(raw: string | null): string | null {
  if (raw == null || raw === "" || raw === "null") return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  if (n === 0) return "none";
  if (n === 65536) return "slide";
  if (n === 131072 || n === 262144) return "pin";
  if (n === 196608 || n === 65536 + 65536) return "pattern";
  return String(n);
}

/** sys.usb.config → OEM usb_mode 0–3 */
export function normalizeUsbModeFromProp(raw: string | null): string | null {
  if (raw == null || raw === "") return null;
  const c = raw.toLowerCase();
  if (c.includes("midi")) return "3";
  if (c.includes("ptp")) return "2";
  if (c.includes("mtp") || c.includes("mass_storage")) return "1";
  if (c.includes("charging") || c.includes("charge_only") || c === "none") {
    return "0";
  }
  if (c.includes("adb") && !c.includes("mtp") && !c.includes("ptp")) return "0";
  return "0";
}
