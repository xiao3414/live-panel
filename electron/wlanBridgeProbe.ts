import type { AppConfig } from "./types.js";
import { isBridgeInstalled } from "./deviceBridge.js";
import { usdkBroadcast } from "./usdkBroadcast.js";
import { adbShell, settingsGet } from "./adb.js";

export type WlanBridgeProbe = {
  bridgeInstalled: boolean;
  usdkPing: "ok" | "err" | "skip";
  usdkDetail?: string;
  adbWifiStatus: "ok" | "err";
  adbDetail?: string;
  settingsProbe: "ok" | "err" | "skip";
};

export async function probeWlanBridge(
  config: AppConfig,
): Promise<WlanBridgeProbe> {
  const bridgeInstalled = await isBridgeInstalled(config);
  const out: WlanBridgeProbe = {
    bridgeInstalled,
    usdkPing: "skip",
    adbWifiStatus: "err",
    settingsProbe: "skip",
  };

  try {
    const status = await adbShell(config, "cmd wifi status", 8000);
    out.adbWifiStatus = "ok";
    out.adbDetail = status.split(/\r?\n/)[0]?.slice(0, 120) ?? status.slice(0, 120);
  } catch (e) {
    out.adbDetail = e instanceof Error ? e.message : String(e);
  }

  try {
    await settingsGet(config, "global", "wifi_scan_always_enabled");
    out.settingsProbe = "ok";
  } catch {
    out.settingsProbe = "err";
  }

  if (!bridgeInstalled) {
    out.usdkDetail = "桥接 APK 未安装";
    return out;
  }

  const line = await usdkBroadcast(config, "getWifiWhiteList");
  if (line.startsWith("ERR:bridge_not_installed")) {
    out.usdkPing = "err";
    out.usdkDetail = "广播未到达桥接";
    return out;
  }
  if (line.startsWith("ERR:")) {
    out.usdkPing = "err";
    out.usdkDetail = line.slice(4);
    return out;
  }
  out.usdkPing = "ok";
  out.usdkDetail = line.startsWith("LIST:") ? "getWifiWhiteList 正常" : line.slice(0, 80);
  return out;
}
