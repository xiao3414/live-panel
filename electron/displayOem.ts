/**
 * Display 字体/熄屏超时：OEM 文案为主，settings 为设备 raw。
 * 依据：OEMConfig_2.0_产品框架/System Configuration.md · Display
 */

/** font_scale → OEM setFontSize */
const FONT_SCALE_TO_OEM: Record<string, string> = {
  "0.85": "Small",
  "0.9": "Small",
  "1": "Default",
  "1.0": "Default",
  "1.00": "Default",
  "1.15": "Large",
  "1.2": "Large",
  "1.30": "Largest",
  "1.3": "Largest",
  "1.5": "Largest",
};

const OEM_FONT_TO_SCALE: Record<string, string> = {
  Small: "0.85",
  Default: "1.0",
  Large: "1.15",
  Largest: "1.3",
};

/** screen_off_timeout(ms) → OEM displayTimeout */
const TIMEOUT_MS_TO_OEM: Record<string, string> = {
  "2147483647": "Never",
  "-1": "Never",
  "15000": "15 seconds",
  "30000": "30 seconds",
  "60000": "1 minute",
  "120000": "2 minutes",
  "300000": "5 minutes",
  "600000": "10 minutes",
  "1800000": "30 minutes",
};

const OEM_TIMEOUT_TO_MS: Record<string, string> = {
  Never: "2147483647",
  "15 seconds": "15000",
  "30 seconds": "30000",
  "1 minute": "60000",
  "2 minutes": "120000",
  "5 minutes": "300000",
  "10 minutes": "600000",
  "30 minutes": "1800000",
};

export function isDisplayFontScaleKey(key: string): boolean {
  return key === "font_scale";
}

export function isDisplayTimeoutKey(key: string): boolean {
  return key === "screen_off_timeout";
}

export function isStayAwakeKey(key: string): boolean {
  return key === "stay_on_while_plugged_in";
}

/**
 * stay_on_while_plugged_in：0=关；非 0（1/3/7/15…）=开。
 * OEM Enable/Disable ↔ 设备位标志。
 */
export function stayAwakeRawToOem(raw: string | null): string | null {
  if (raw == null || raw === "" || raw === "null") return null;
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return null;
  return n === 0 ? "Disable" : "Enable";
}

/** OEM → settings：Enable 写 15（AC|USB|无线|Dock 全开），Disable 写 0 */
export function oemToStayAwakeRaw(oem: string): string {
  const t = oem.trim().toLowerCase();
  if (t === "0" || t === "disable" || t === "off" || t === "false") return "0";
  if (
    t === "1" ||
    t === "enable" ||
    t === "on" ||
    t === "true" ||
    t === "7" ||
    t === "15"
  ) {
    return "15";
  }
  if (/^\d+$/.test(t)) return t; // 已是位标志
  throw new Error(`未知 Stay Awake 值：${oem}`);
}

function normScale(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw.trim();
  // 归一到常见精度，便于查表
  if (Math.abs(n - 1.3) < 0.05) return "1.3";
  if (Math.abs(n - 1.15) < 0.05) return "1.15";
  if (Math.abs(n - 1.0) < 0.05) return "1.0";
  if (Math.abs(n - 0.85) < 0.05) return "0.85";
  if (Math.abs(n - 1.5) < 0.05) return "1.5";
  return String(n);
}

/** settings font_scale → OEM 文案 */
export function fontScaleToOem(raw: string | null): string | null {
  if (raw == null || raw === "" || raw === "null") return null;
  const key = normScale(raw);
  return FONT_SCALE_TO_OEM[key] ?? FONT_SCALE_TO_OEM[raw.trim()] ?? null;
}

/** OEM 文案 → settings font_scale */
export function oemToFontScale(oem: string): string {
  const t = oem.trim();
  if (OEM_FONT_TO_SCALE[t]) return OEM_FONT_TO_SCALE[t];
  const hit = Object.entries(OEM_FONT_TO_SCALE).find(
    ([k]) => k.toLowerCase() === t.toLowerCase(),
  );
  if (hit) return hit[1];
  // 已是数字则原样
  if (/^\d+(\.\d+)?$/.test(t)) return t;
  throw new Error(`未知字体大小：${oem}（应为 Default/Small/Large/Largest）`);
}

/** settings ms → OEM 文案 */
export function timeoutMsToOem(raw: string | null): string | null {
  if (raw == null || raw === "" || raw === "null") return null;
  const t = raw.trim();
  if (TIMEOUT_MS_TO_OEM[t]) return TIMEOUT_MS_TO_OEM[t];
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  // 容差：接近某档即认
  for (const [ms, label] of Object.entries(TIMEOUT_MS_TO_OEM)) {
    const m = Number(ms);
    if (!Number.isFinite(m)) continue;
    if (Math.abs(m - n) <= 1000) return label;
  }
  return null;
}

/** OEM 文案 → settings ms */
export function oemToTimeoutMs(oem: string): string {
  const t = oem.trim();
  if (OEM_TIMEOUT_TO_MS[t]) return OEM_TIMEOUT_TO_MS[t];
  const lower = t.toLowerCase();
  const hit = Object.entries(OEM_TIMEOUT_TO_MS).find(
    ([k]) => k.toLowerCase() === lower,
  );
  if (hit) return hit[1];
  if (/^\d+$/.test(t)) return t;
  // "30 min" / "30minutes"
  const m = lower.match(/^(\d+)\s*(seconds?|minutes?|min|sec|s|m)$/);
  if (m) {
    const n = Number(m[1]);
    const u = m[2];
    if (u.startsWith("m")) return String(n * 60_000);
    return String(n * 1000);
  }
  throw new Error(`未知熄屏超时：${oem}`);
}
