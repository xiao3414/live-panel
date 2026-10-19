import type { AppConfig } from "./types.js";
import { adbShell, settingsGet } from "./adb.js";
import {
  connectWifiNetwork,
  type WifiConnectPayload,
  type WifiSecurity,
} from "./wifiNetwork.js";

export type WlanAction =
  | "no_change"
  | "set_profile"
  | "remove_profile"
  | "remove_all_profiles"
  | "delete_specific";

export type IpAssignment = "dhcp" | "static" | "unknown";
export type ProxyMode = "none" | "pac" | "static" | "unknown";
export type TriState = "no_change" | "enable" | "disable";
export type MacRandomChoice = "no_change" | "allow" | "disallow";
export type SecurityChoice = WifiSecurity | "no_change";

export type WifiGeneralSettingsRead = {
  wifiEnabled: boolean | null;
  ssid: string | null;
  security: WifiSecurity | null;
  securityLabel: string;
  hidden: boolean | null;
  passwordNote: string;
  ipAssignment: IpAssignment;
  staticIp: string | null;
  prefixLength: string | null;
  gateway: string | null;
  dns1: string | null;
  dns2: string | null;
  proxyMode: ProxyMode;
  proxyPacUrl: string | null;
  proxyHost: string | null;
  proxyPort: string | null;
  proxyExclusiveList: string | null;
  wifiRandomMac: MacRandomChoice | null;
  networkId: string | null;
};

export type WifiGeneralSettingsApply = {
  wlanAction?: WlanAction;
  wifiState?: TriState;
  ssid?: string;
  password?: string;
  security?: SecurityChoice;
  hidden?: TriState;
  ipAssignment?: IpAssignment;
  staticIp?: string;
  prefixLength?: string;
  gateway?: string;
  dns1?: string;
  dns2?: string;
  proxyMode?: ProxyMode;
  proxyPacUrl?: string;
  proxyHost?: string;
  proxyPort?: string;
  proxyExclusiveList?: string;
  wifiRandomMac?: MacRandomChoice;
};

function parseLinkBlock(dumpsys: string): {
  ip: string | null;
  prefix: string | null;
  gateway: string | null;
  dns1: string | null;
  dns2: string | null;
} {
  const m = dumpsys.match(
    /mLinkProperties \{[^}]*LinkAddresses: \[[^\]]*?(?:fe80:[^,]+,\s*)?([\d.]+)\/(\d+)/,
  );
  const ip = m?.[1] ?? null;
  const prefix = m?.[2] ?? null;
  const gw = dumpsys.match(/0\.0\.0\.0\/0 -> ([\d.]+)/)?.[1] ?? null;
  const dns = [...dumpsys.matchAll(/DnsAddresses: \[[^\]]*?\/([\d.]+)/g)].map(
    (x) => x[1],
  );
  return {
    ip,
    prefix,
    gateway: gw,
    dns1: dns[0] ?? null,
    dns2: dns[1] ?? null,
  };
}

async function readNetworkId(
  config: AppConfig,
  ssid: string | null,
): Promise<string | null> {
  if (!ssid) return null;
  const out = await adbShell(config, "cmd wifi list-networks", 8000);
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^(\d+)\s+(\S+)/);
    if (m && m[2] === ssid) return m[1];
  }
  return null;
}

function parseProxy(httpProxy: string): {
  mode: ProxyMode;
  host: string | null;
  port: string | null;
  pac: string | null;
} {
  if (!httpProxy || httpProxy === "null" || httpProxy === ":0") {
    return { mode: "none", host: null, port: null, pac: null };
  }
  if (httpProxy.startsWith("pac+")) {
    return { mode: "pac", host: null, port: null, pac: httpProxy.slice(4) };
  }
  const m = httpProxy.match(/^([\w.-]+):(\d+)$/);
  if (m) return { mode: "static", host: m[1], port: m[2], pac: null };
  return { mode: "unknown", host: httpProxy, port: null, pac: null };
}

export async function readWifiGeneralSettings(
  config: AppConfig,
): Promise<WifiGeneralSettingsRead> {
  const status = await adbShell(config, "cmd wifi status", 8000);
  const dumpsys = await adbShell(config, "dumpsys wifi", 12000);
  let ssid = status.match(/SSID:\s*"([^"]+)"/)?.[1] ?? null;
  if (!ssid) {
    ssid =
      status.match(/Wifi is connected to "([^"]+)"/i)?.[1] ??
      status.match(/connected to "([^"]+)"/i)?.[1] ??
      null;
  }
  if (!ssid) {
    ssid = dumpsys.match(/SSID:\s*"([^"]+)"/)?.[1] ?? null;
  }
  const wifiEnabled = /Wifi is enabled|Wi-Fi is enabled/i.test(status);
  const secMatch = status.match(/Security type:\s*(\d+)/);
  let security: WifiSecurity | null = null;
  let securityLabel = "—";
  if (secMatch) {
    const code = secMatch[1];
    security =
      code === "4" || code === "5"
        ? "wpa3"
        : code === "2" || code === "3"
          ? "wpa2"
          : code === "1"
            ? "wep"
            : code === "0"
              ? "open"
              : null;
    if (/wpa3/i.test(status)) security = "wpa3";
    if (security === "wpa2") securityLabel = "WPA/WPA2 Personal";
    else if (security === "wpa3") securityLabel = "WPA3 Personal";
    else if (security === "wep") securityLabel = "WEP";
    else if (security === "open") securityLabel = "Open";
  }
  const link = parseLinkBlock(dumpsys);
  const ipAssignment: IpAssignment =
    dumpsys.includes("IP assignment: STATIC") ||
    dumpsys.includes("IpAssignment: STATIC")
      ? "static"
      : link.ip
        ? "dhcp"
        : "unknown";

  let httpProxy = "null";
  try {
    httpProxy = await settingsGet(config, "global", "http_proxy");
  } catch {
    /* optional */
  }
  const proxy = parseProxy(httpProxy);

  let macRand: MacRandomChoice | null = null;
  try {
    const mac = await settingsGet(
      config,
      "global",
      "wifi_connected_mac_randomization_enabled",
    );
    if (mac === "1") macRand = "allow";
    if (mac === "0") macRand = "disallow";
  } catch {
    /* optional */
  }

  let hidden: boolean | null = null;
  if (ssid && /hiddenSSID=true/i.test(dumpsys)) hidden = true;
  if (ssid && /hiddenSSID=false/i.test(dumpsys)) hidden = false;

  const networkId = await readNetworkId(config, ssid);

  return {
    wifiEnabled,
    ssid,
    security,
    securityLabel,
    hidden,
    passwordNote: "Password 设备不可读，写回时需填写",
    ipAssignment,
    staticIp: link.ip,
    prefixLength: link.prefix,
    gateway: link.gateway,
    dns1: link.dns1,
    dns2: link.dns2,
    proxyMode: proxy.mode,
    proxyPacUrl: proxy.pac,
    proxyHost: proxy.host,
    proxyPort: proxy.port,
    proxyExclusiveList: null,
    wifiRandomMac: macRand,
    networkId,
  };
}

async function applyWifiState(config: AppConfig, state: TriState) {
  if (state === "no_change") return;
  const cmd =
    state === "enable"
      ? "cmd wifi set-wifi-enabled enabled"
      : "cmd wifi set-wifi-enabled disabled";
  await adbShell(config, cmd, 8000);
}

async function applyProxy(config: AppConfig, body: WifiGeneralSettingsApply) {
  if (!body.proxyMode || body.proxyMode === "unknown") return;
  if (body.proxyMode === "none") {
    await adbShell(config, "settings put global http_proxy :0", 5000);
    return;
  }
  if (body.proxyMode === "pac" && body.proxyPacUrl?.trim()) {
    await adbShell(
      config,
      `settings put global http_proxy pac+${body.proxyPacUrl.trim()}`,
      5000,
    );
    return;
  }
  if (
    body.proxyMode === "static" &&
    body.proxyHost?.trim() &&
    body.proxyPort?.trim()
  ) {
    await adbShell(
      config,
      `settings put global http_proxy ${body.proxyHost.trim()}:${body.proxyPort.trim()}`,
      5000,
    );
  }
}

function hiddenToBool(v: TriState | undefined): boolean | undefined {
  if (!v || v === "no_change") return undefined;
  return v === "enable";
}

async function applyMacRandom(config: AppConfig, v: MacRandomChoice | undefined) {
  if (!v || v === "no_change") return;
  const val = v === "allow" ? "1" : "0";
  await adbShell(
    config,
    `settings put global wifi_connected_mac_randomization_enabled ${val}`,
    5000,
  );
}

async function forgetAllNetworks(config: AppConfig) {
  const out = await adbShell(config, "cmd wifi list-networks", 8000);
  const ids = new Set<string>();
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^(\d+)\s+/);
    if (m) ids.add(m[1]);
  }
  for (const id of ids) {
    await adbShell(config, `cmd wifi forget-network ${id}`, 8000);
  }
}

export async function applyWifiGeneralSettings(
  config: AppConfig,
  body: WifiGeneralSettingsApply,
): Promise<void> {
  await applyWifiState(config, body.wifiState ?? "no_change");

  const action = body.wlanAction ?? "no_change";
  if (action === "remove_all_profiles") {
    await forgetAllNetworks(config);
    return;
  }

  if (
    (action === "remove_profile" || action === "delete_specific") &&
    body.ssid?.trim()
  ) {
    const id = await readNetworkId(config, body.ssid.trim());
    if (id) await adbShell(config, `cmd wifi forget-network ${id}`, 8000);
    return;
  }

  if (action === "set_profile" && body.ssid?.trim()) {
    const sec: WifiSecurity =
      body.security && body.security !== "no_change" ? body.security : "wpa2";
    const payload: WifiConnectPayload = {
      ssid: body.ssid.trim(),
      security: sec,
      password: body.password,
      hidden: hiddenToBool(body.hidden),
    };
    await connectWifiNetwork(config, payload);
  }

  await applyProxy(config, body);
  await applyMacRandom(config, body.wifiRandomMac);

  if (body.ipAssignment === "static" && body.staticIp?.trim()) {
    throw new Error(
      "静态 IP 暂不支持 ADB 一键写回（请用 OEMConfig 推送或系统 Wi‑Fi 高级设置）；其余项已应用",
    );
  }
}
