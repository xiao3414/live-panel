import type { AppConfig } from "./types.js";
import { settingsGet, settingsPut } from "./adb.js";
import { bridgeOk, usdkBroadcast } from "./usdkBroadcast.js";
import { isBridgeInstalled } from "./usdkIniBridge.js";

export type TriState = "no_change" | "enable" | "disable";
export type CaptivePortalChoice = "no_change" | "0" | "1" | "2";

export const CAPTIVE_PORTAL_LABELS: Record<string, string> = {
  "0": "Disable detection",
  "1": "Pop up reminder",
  "2": "Automatically disconnect hotspot (no auto reconnect)",
};

export type WifiPreferenceRead = {
  bridgeInstalled: boolean;
  captivePortal: string | null;
  networkAvailableNotification: boolean | null;
  networkMonitoredNotification: boolean | null;
  readNotes: string[];
};

export type WifiPreferenceApply = {
  captivePortal?: CaptivePortalChoice;
  networkAvailableNotification?: TriState;
  networkMonitoredNotification?: TriState;
};

function parseBoolSetting(raw: string | null): boolean | null {
  if (raw == null || raw === "" || raw === "null") return null;
  return raw === "1" || raw === "true";
}

function usdkBool(raw: string): boolean | null {
  if (raw.startsWith("ERR:")) return null;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return null;
}

export async function readWifiPreferenceSettings(
  config: AppConfig,
): Promise<WifiPreferenceRead> {
  const notes: string[] = [];
  const bridgeInstalled = await isBridgeInstalled(config);

  let captivePortal: string | null = null;
  if (bridgeInstalled) {
    const raw = await usdkBroadcast(config, "getCaptivePortalMode");
    if (!raw.startsWith("ERR:") && raw) captivePortal = raw;
    else notes.push("Captive Portal 需 USDK（DeviceManagerEx.getCaptivePortalMode）");
  } else {
    notes.push("未安装 USDK 桥接：Captive Portal 无法读（与 OEM 同路径）");
  }

  let networkAvailableNotification = parseBoolSetting(
    await settingsGet(config, "global", "wifi_networks_available_notification_on"),
  );
  let networkMonitoredNotification = parseBoolSetting(
    await settingsGet(config, "global", "wifi_wakeup_enabled"),
  );

  if (bridgeInstalled) {
    const n1 = await usdkBroadcast(config, "getWifiNotificationEnabled");
    const b1 = usdkBool(n1);
    if (b1 != null) networkAvailableNotification = b1;
    const n2 = await usdkBroadcast(config, "getWifiWakeupEnabled");
    const b2 = usdkBool(n2);
    if (b2 != null) networkMonitoredNotification = b2;
  }

  return {
    bridgeInstalled,
    captivePortal,
    networkAvailableNotification,
    networkMonitoredNotification,
    readNotes: notes,
  };
}

async function applyTriStateSetting(
  config: AppConfig,
  tri: TriState | undefined,
  settingKey: string,
  usdkOp: string,
): Promise<void> {
  if (!tri || tri === "no_change") return;
  const on = tri === "enable";
  const bridgeInstalled = await isBridgeInstalled(config);
  if (bridgeInstalled) {
    const line = await usdkBroadcast(config, usdkOp, {
      value: on ? "true" : "false",
    });
    if (line.startsWith("ERR:")) {
      throw new Error(line.slice(4));
    }
    return;
  }
  await settingsPut(config, "global", settingKey, on ? "1" : "0");
}

export async function applyWifiPreferenceSettings(
  config: AppConfig,
  payload: WifiPreferenceApply,
): Promise<void> {
  if (payload.captivePortal && payload.captivePortal !== "no_change") {
    const line = await usdkBroadcast(config, "setCaptivePortalMode", {
      value: payload.captivePortal,
    });
    if (line.startsWith("ERR:bridge_not_installed")) {
      throw new Error("Captive Portal 写回需安装 USDK 桥接 APK");
    }
    if (line.startsWith("ERR:")) {
      throw new Error(line.slice(4));
    }
    if (!bridgeOk(line)) {
      throw new Error(`Captive Portal 写回失败: ${line || "empty"}`);
    }
  }

  await applyTriStateSetting(
    config,
    payload.networkAvailableNotification,
    "wifi_networks_available_notification_on",
    "setWifiNotificationEnabled",
  );
  await applyTriStateSetting(
    config,
    payload.networkMonitoredNotification,
    "wifi_wakeup_enabled",
    "setWifiWakeupEnabled",
  );
}
