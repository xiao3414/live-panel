/** 与 electron/displayOem.ts 对齐的 Display 对比辅助 */

const FONT_SCALE_TO_OEM: Record<string, string> = {
  "0.85": "Small",
  "0.9": "Small",
  "1": "Default",
  "1.0": "Default",
  "1.15": "Large",
  "1.2": "Large",
  "1.3": "Largest",
  "1.30": "Largest",
  "1.5": "Largest",
};

const FONT_NAME_TO_OEM: Record<string, string> = {
  small: "Small",
  default: "Default",
  large: "Large",
  largest: "Largest",
};

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

const TIMEOUT_NAME_TO_OEM: Record<string, string> = {
  never: "Never",
  "15 seconds": "15 seconds",
  "30 seconds": "30 seconds",
  "1 minute": "1 minute",
  "2 minutes": "2 minutes",
  "5 minutes": "5 minutes",
  "10 minutes": "10 minutes",
  "30 minutes": "30 minutes",
};

export function isDisplayFontProbe(probeId: string): boolean {
  return probeId === "syscfg.displayStep__setFontSize";
}

export function isDisplayTimeoutProbe(probeId: string): boolean {
  return probeId === "syscfg.displayStep__displayTimeout";
}

export function isStayAwakeProbe(probeId: string): boolean {
  return probeId === "syscfg.displayStep__displayStayAwake";
}

export function isBrightnessProbe(probeId: string): boolean {
  return probeId === "syscfg.displayStep__displayBackLightLevel";
}

export function isAutoBrightnessProbe(probeId: string): boolean {
  return probeId === "syscfg.displayStep__displayAutoBrightness";
}

/** stay_on_while_plugged_in：0=Disable，非 0=Enable */
export function normalizeStayAwakeRaw(v: string): string {
  const t = v.trim().toLowerCase();
  if (t === "enable" || t === "on" || t === "true") return "Enable";
  if (t === "disable" || t === "off" || t === "false") return "Disable";
  const n = Number(t);
  if (Number.isFinite(n)) return n === 0 ? "Disable" : "Enable";
  return v.trim();
}

export function normalizeDisplayFontRaw(v: string): string {
  const t = v.trim();
  const byName = FONT_NAME_TO_OEM[t.toLowerCase()];
  if (byName) return byName;
  const n = Number(t);
  if (Number.isFinite(n)) {
    if (Math.abs(n - 1.3) < 0.05 || Math.abs(n - 1.5) < 0.05) return "Largest";
    if (Math.abs(n - 1.15) < 0.05 || Math.abs(n - 1.2) < 0.05) return "Large";
    if (Math.abs(n - 1.0) < 0.05) return "Default";
    if (Math.abs(n - 0.85) < 0.05 || Math.abs(n - 0.9) < 0.05) return "Small";
  }
  return FONT_SCALE_TO_OEM[t] ?? t;
}

export function normalizeDisplayTimeoutRaw(v: string): string {
  const t = v.trim();
  const byName = TIMEOUT_NAME_TO_OEM[t.toLowerCase()];
  if (byName) return byName;
  if (TIMEOUT_MS_TO_OEM[t]) return TIMEOUT_MS_TO_OEM[t];
  const n = Number(t);
  if (Number.isFinite(n)) {
    for (const [ms, label] of Object.entries(TIMEOUT_MS_TO_OEM)) {
      if (Math.abs(Number(ms) - n) <= 1000) return label;
    }
  }
  return t;
}
