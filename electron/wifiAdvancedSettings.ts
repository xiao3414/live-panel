import type { AppConfig } from "./types.js";
import { adbShell, settingsGet } from "./adb.js";
import {
  detectWifiIniPlatform,
  isBridgeInstalled,
  usdkGetIni,
  usdkGetWifiCountryCode,
  usdkPutIni,
  usdkSetWifiCountryCode,
  type WifiIniPlatform,
} from "./usdkIniBridge.js";

export type TriState = "no_change" | "enable" | "disable";

export type WifiAdvancedRead = {
  platform: WifiIniPlatform;
  bridgeInstalled: boolean;
  powerSaveMode: string | null;
  roamingThreshold: string | null;
  roamingDifference: string | null;
  wifiScanning: boolean | null;
  countryCode: string | null;
  prefer5GHz: string | null;
  bandSelection: string | null;
  channel24: string | null;
  channel5: string | null;
  channel6: string | null;
  readNotes: string[];
};

export type WifiAdvancedApply = {
  powerSaveMode?: string;
  roamingThreshold?: string;
  roamingDifference?: string;
  wifiScanning?: TriState;
  countryCode?: string;
  prefer5GHz?: TriState | "on" | "off" | "no";
  bandSelection?: string;
  channel24?: string;
  channel5?: string;
  channel6?: string;
};

function iniKeys(platform: WifiIniPlatform) {
  if (platform === "mtk") {
    return {
      power: "gParamPowerMode",
      roamTh: "RoamingRCPIGoodValue",
      roamDiff: "RoamingRCPIDelta0",
      band: "Combined_WifiBand",
      channel: "MTK_WifiChannel",
      prefer5: null as string | null,
      ch24: null,
      ch5: null,
    };
  }
  if (platform === "qcom") {
    return {
      power: "QCOM_PowerSave",
      roamTh: "gNeighborLookupThreshold",
      roamDiff: "RoamRssiDiff",
      band: "Combined_WifiBand",
      channel: null,
      prefer5: "gRoamPrefer5GHz",
      ch24: "wifiBandValue24",
      ch5: "wifiBandValue5",
    };
  }
  if (platform === "broadcom") {
    return {
      power: "BT_PowerSave",
      roamTh: "BT_RoamTrigger",
      roamDiff: "BT_RoamDelta",
      band: "BT_WifiBand",
      channel: null,
      prefer5: "BT_AssocPref",
      ch24: null,
      ch5: null,
    };
  }
  return {
    power: "QCOM_PowerSave",
    roamTh: "gNeighborLookupThreshold",
    roamDiff: "RoamRssiDiff",
    band: "Combined_WifiBand",
    channel: "MTK_WifiChannel",
    prefer5: "gRoamPrefer5GHz",
    ch24: "wifiBandValue24",
    ch5: "wifiBandValue5",
  };
}

export async function readWifiAdvancedSettings(
  config: AppConfig,
): Promise<WifiAdvancedRead> {
  const platform = await detectWifiIniPlatform(config);
  const keys = iniKeys(platform);
  const notes: string[] = [];
  const hasBridge = await isBridgeInstalled(config);

  let powerSave: string | null = null;
  let roamTh: string | null = null;
  let roamDiff: string | null = null;
  let band: string | null = null;
  let channel: string | null = null;
  let ch24: string | null = null;
  let ch5: string | null = null;
  let prefer5: string | null = null;

  if (hasBridge) {
    powerSave = (await usdkGetIni(config, keys.power)).value;
    roamTh = (await usdkGetIni(config, keys.roamTh)).value;
    roamDiff = (await usdkGetIni(config, keys.roamDiff)).value;
    band = (await usdkGetIni(config, keys.band)).value;
    if (keys.channel) channel = (await usdkGetIni(config, keys.channel)).value;
    if (keys.ch24) ch24 = (await usdkGetIni(config, keys.ch24)).value;
    if (keys.ch5) ch5 = (await usdkGetIni(config, keys.ch5)).value;
    if (keys.prefer5) prefer5 = (await usdkGetIni(config, keys.prefer5)).value;
  } else {
    notes.push("bridge_missing");
    try {
      const ps = await adbShell(config, "getprop persist.sys.wifi.power.mode", 3000);
      if (ps === "true") powerSave = "2";
      if (ps === "false") powerSave = "0";
    } catch {
      /* optional */
    }
    try {
      const ft = await adbShell(config, "getprop persist.sys.wifi.fast.transition", 3000);
      if (ft === "true") prefer5 = "1";
      if (ft === "false") prefer5 = "0";
    } catch {
      /* optional */
    }
  }

  let wifiScanning: boolean | null = null;
  try {
    const s = await settingsGet(config, "global", "wifi_scan_always_enabled");
    if (s === "1") wifiScanning = true;
    if (s === "0") wifiScanning = false;
  } catch {
    /* optional */
  }

  let countryCode: string | null = null;
  countryCode = await usdkGetWifiCountryCode(config);
  if (!countryCode) {
    try {
      const dumpsys = await adbShell(config, "dumpsys wifi", 8000);
      const m = dumpsys.match(/mCountryCodeFromDriver(\w+)/);
      if (m) countryCode = m[1];
    } catch {
      /* optional */
    }
  }

  return {
    platform,
    bridgeInstalled: hasBridge,
    powerSaveMode: powerSave,
    roamingThreshold: roamTh,
    roamingDifference: roamDiff,
    wifiScanning,
    countryCode,
    prefer5GHz: prefer5,
    bandSelection: band,
    channel24: ch24 ?? (platform === "mtk" ? channel : null),
    channel5: ch5,
    channel6: null,
    readNotes: notes,
  };
}

export async function applyWifiAdvancedSettings(
  config: AppConfig,
  body: WifiAdvancedApply,
): Promise<void> {
  const platform = await detectWifiIniPlatform(config);
  const keys = iniKeys(platform);
  const hasBridge = await isBridgeInstalled(config);

  const wantsIni =
    Boolean(body.powerSaveMode?.trim()) ||
    Boolean(body.roamingThreshold?.trim()) ||
    Boolean(body.roamingDifference?.trim()) ||
    Boolean(body.bandSelection?.trim()) ||
    Boolean(body.channel24?.trim()) ||
    Boolean(body.channel5?.trim()) ||
    (body.prefer5GHz &&
      body.prefer5GHz !== "no_change" &&
      keys.prefer5 != null);

  if (body.wifiScanning && body.wifiScanning !== "no_change") {
    const v = body.wifiScanning === "enable" ? "1" : "0";
    await adbShell(config, `settings put global wifi_scan_always_enabled ${v}`, 5000);
  }

  if (body.countryCode?.trim()) {
    if (!hasBridge) {
      throw new Error(
        "Country Code 写回需 USDK 桥接；请连接设备并等待顶栏「设备 USDK 组件」就绪",
      );
    }
    await usdkSetWifiCountryCode(config, body.countryCode.trim());
  }

  if (wantsIni && !hasBridge) {
    throw new Error(
      "省电/漫游/频段等 INI 写回需 USDK 桥接；请连接设备并等待自动安装完成",
    );
  }

  const put = async (iniKey: string | null, val: string | undefined) => {
    if (!iniKey || val === undefined || val === "") return;
    await usdkPutIni(config, iniKey, val.trim());
  };

  await put(keys.power, body.powerSaveMode);
  await put(keys.roamTh, body.roamingThreshold);
  await put(keys.roamDiff, body.roamingDifference);
  await put(keys.band, body.bandSelection);
  if (body.channel24?.trim()) {
    if (keys.channel) await put(keys.channel, body.channel24);
    else await put(keys.ch24, body.channel24);
  }
  await put(keys.ch5, body.channel5);

  if (body.prefer5GHz && body.prefer5GHz !== "no_change" && keys.prefer5) {
    const v =
      body.prefer5GHz === "enable" || body.prefer5GHz === "on"
        ? "1"
        : body.prefer5GHz === "disable" || body.prefer5GHz === "off"
          ? "0"
          : body.prefer5GHz === "no"
            ? "0"
            : undefined;
    if (v !== undefined) await put(keys.prefer5, v);
  }

  if (body.channel6?.trim()) {
    throw new Error("6GHz Channel 写回需 USDK/OEM 确认 MTK 键名（当前仅读占位）");
  }
}
