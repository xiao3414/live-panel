import type { AppConfig } from "./types.js";
import { bridgeErrMessage, usdkBroadcast } from "./usdkBroadcast.js";
import { isBridgeInstalled } from "./usdkIniBridge.js";

export type WhitelistConfigurationAction =
  | "no_change"
  | "insert"
  | "clear";

export type WifiWhitelistRead = {
  bridgeInstalled: boolean;
  ssids: string[];
  readNotes: string[];
};

export type WifiWhitelistApply = {
  configurationAction?: WhitelistConfigurationAction;
  /** OEM SSID1～SSID5，Insert 时非空项会逐个加入白名单 */
  ssids?: string[];
};

function parseListLine(line: string): string[] {
  if (!line || line.startsWith("ERR:")) return [];
  if (line.startsWith("LIST:")) {
    const body = line.slice(5).trim();
    if (!body) return [];
    return body.split("|").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export async function readWifiWhitelistSettings(
  config: AppConfig,
): Promise<WifiWhitelistRead> {
  const bridgeInstalled = await isBridgeInstalled(config);
  const notes: string[] = [];
  if (!bridgeInstalled) {
    return {
      bridgeInstalled: false,
      ssids: [],
      readNotes: [
        "WiFi Whitelist 仅 USDK（DeviceManager.getWifiWhiteList / setWifiWhiteList），请安装桥接 APK",
      ],
    };
  }
  const line = await usdkBroadcast(config, "getWifiWhiteList");
  if (line.startsWith("ERR:")) {
    notes.push(line.slice(4));
    return { bridgeInstalled: true, ssids: [], readNotes: notes };
  }
  return {
    bridgeInstalled: true,
    ssids: parseListLine(line),
    readNotes: notes,
  };
}

export async function applyWifiWhitelistSettings(
  config: AppConfig,
  payload: WifiWhitelistApply,
): Promise<void> {
  const action = payload.configurationAction ?? "no_change";
  if (action === "no_change") return;

  if (!(await isBridgeInstalled(config))) {
    throw new Error("WiFi Whitelist 写回需安装 USDK 桥接 APK");
  }

  if (action === "clear") {
    const line = await usdkBroadcast(config, "setWifiWhiteList", {
      action: "0",
    });
    const err = bridgeErrMessage(line, "清空白名单失败");
    if (err) throw new Error(err);
    return;
  }

  if (action === "insert") {
    const list = (payload.ssids ?? []).map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
      throw new Error("Insert WiFi Whitelist 请至少填写一个 SSID");
    }
    if (list.length > 5) {
      throw new Error("OEM 框架最多 5 个 SSID（SSID1～SSID5）");
    }
    const line = await usdkBroadcast(config, "setWifiWhiteList", {
      action: "1",
      ssids: list.join(","),
    });
    const err = bridgeErrMessage(line, "加入白名单失败");
    if (err) throw new Error(err);
  }
}
