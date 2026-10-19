import type { AppConfig } from "./types.js";
import { adbShell } from "./adb.js";

export type WifiSecurity = "open" | "owe" | "wpa2" | "wpa3" | "wep";

export type WifiProfileRead = {
  ssid: string | null;
  security: WifiSecurity | null;
  securityTypeCode: string | null;
  securityLabel: string;
  hidden: boolean | null;
  passwordNote: string;
};

export type WifiConnectPayload = {
  ssid: string;
  security: WifiSecurity;
  password?: string;
  hidden?: boolean;
};

const SECURITY_CODE_TO_KIND: Record<string, WifiSecurity> = {
  "0": "open",
  "1": "wep",
  "2": "wpa2",
  "3": "wpa2",
  "4": "wpa3",
  "5": "wpa3",
  "6": "wpa3",
};

const SECURITY_LABELS: Record<WifiSecurity, string> = {
  open: "Open / 开放",
  owe: "OWE / 增强开放",
  wpa2: "WPA/WPA2 Personal",
  wpa3: "WPA3 Personal",
  wep: "WEP",
};

function shellQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parseSecurityFromStatus(status: string): {
  code: string | null;
  kind: WifiSecurity | null;
} {
  const m = status.match(/Security type:\s*(\d+)/i);
  if (!m) {
    if (/wpa3-sae/i.test(status)) return { code: "4", kind: "wpa3" };
    if (/wpa2-psk/i.test(status)) return { code: "2", kind: "wpa2" };
    return { code: null, kind: null };
  }
  const code = m[1];
  return { code, kind: SECURITY_CODE_TO_KIND[code] ?? null };
}

function parseSsidFromStatus(status: string): string | null {
  const m = status.match(/SSID:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

async function parseHidden(
  config: AppConfig,
  ssid: string | null,
): Promise<boolean | null> {
  if (!ssid) return null;
  try {
    const out = await adbShell(
      config,
      `dumpsys wifi | grep -A2 '${ssid.replace(/'/g, `'\\''`)}' | grep -i hidden | head -1`,
      5000,
    );
    if (/hiddenSSID=true|hidden.*true/i.test(out)) return true;
    if (/hiddenSSID=false|hidden.*false/i.test(out)) return false;
  } catch {
    /* optional */
  }
  return null;
}

export async function readWifiProfile(
  config: AppConfig,
): Promise<WifiProfileRead> {
  const status = await adbShell(config, "cmd wifi status", 8000);
  const ssid = parseSsidFromStatus(status);
  const { code, kind } = parseSecurityFromStatus(status);
  const hidden = await parseHidden(config, ssid);
  return {
    ssid,
    security: kind,
    securityTypeCode: code,
    securityLabel: kind ? SECURITY_LABELS[kind] : "—",
    hidden,
    passwordNote: "设备侧不可读取（与 OEM 策略一致，仅可写回）",
  };
}

export async function connectWifiNetwork(
  config: AppConfig,
  payload: WifiConnectPayload,
): Promise<void> {
  const ssid = payload.ssid.trim();
  if (!ssid) throw new Error("SSID 不能为空");

  const sec = payload.security;
  const needsPass = sec === "wpa2" || sec === "wpa3" || sec === "wep";
  if (needsPass && !payload.password?.trim()) {
    throw new Error("该安全类型需要填写 Password");
  }

  const flags = payload.hidden ? " -h" : "";
  let cmd: string;
  if (needsPass) {
    cmd = `cmd wifi connect-network ${shellQuote(ssid)} ${sec} ${shellQuote(payload.password!.trim())}${flags}`;
  } else {
    cmd = `cmd wifi connect-network ${shellQuote(ssid)} ${sec}${flags}`;
  }

  await adbShell(config, cmd, 20000);
}
