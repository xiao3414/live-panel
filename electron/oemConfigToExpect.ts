/** 与 src/oemConfigToExpect.ts 同步（主进程解析 OEM JSON） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadScanManifestItems } from "./scanManifest.js";

const SYSTEM_PROBE_MAP_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../registry/system/oem20_system_probe_map.json",
);
const NETWORK_49_PROBE_MAP_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../registry/system/oem20_network_49_probe_map.json",
);

function loadSystemProbeMap(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(SYSTEM_PROBE_MAP_PATH, "utf8")) as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function loadNetwork49ProbeMap(): Record<string, string> {
  try {
    return JSON.parse(
      fs.readFileSync(NETWORK_49_PROBE_MAP_PATH, "utf8"),
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

export type ExpectEntry = { value: string; hint?: string };
export type ExpectTemplate = {
  version: number;
  id: string;
  name: string;
  description?: string;
  scope?: { layoutId?: string; module?: string };
  expectations: Record<string, ExpectEntry>;
  source?: { kind: "oem_app_configuration"; path?: string };
};

export const OEM_SECURITY_PROBE_MAP: Record<
  string,
  { probeId: string; note?: string }
> = {
  allowFactoryReset: { probeId: "sec.allow_factory_reset" },
  lockScreenEnable: { probeId: "sec.screen_lock" },
  lockScreenSet: { probeId: "sec.screen_lock_set" },
  lockScreenSetPassword: { probeId: "sec.screen_lock_password" },
  lockScreenTimeout: { probeId: "sec.screen_lock_timeout" },
  googlePlayProtect: { probeId: "sec.google_play_protect" },
  appUnknownSource: { probeId: "sec.unknown_source" },
  appOverUsb: { probeId: "sec.verify_apps_usb" },
  passCodeApp: { probeId: "sec.scan_key_pass" },
  disallowScreenshot: { probeId: "sec.disallow_screenshot" },
  screenPinning: { probeId: "sec.screen_pinning" },
  volumeKeyEnable: { probeId: "sec.volume_key" },
  cameraEnable: { probeId: "sec.camera_access" },
  microphoneAccess: { probeId: "sec.microphone_access" },
  clipboardEnable: { probeId: "sec.clipboard_access" },
  showPasswordWhenTyping: { probeId: "sec.show_passwords" },
  locationAccess: { probeId: "sec.location_access" },
  externalMountedMemory: { probeId: "sec.external_sd" },
  USBEnable: { probeId: "sec.usb" },
  USBMode: { probeId: "sec.usb_mode" },
  ADBEnable: { probeId: "sec.adb" },
  lockScreenNotificationPrivacyMode: { probeId: "" },
};

type ParsedOemSecurity = Record<string, string>;

type OemAppConfigurationInner = {
  securityRestriction?: ParsedOemSecurity;
  systemConfiguration?: Record<string, unknown>;
  networkConfiguration?: Record<string, unknown>;
  dataCapturePeripherals?: {
    scanStep?: Record<string, unknown>;
    dockingStationStep?: Record<string, unknown>;
  };
};

function parseOemAppConfigurationInner(text: string): OemAppConfigurationInner {
  const outer = JSON.parse(text) as {
    appConfiguration?: string;
  };
  if (!outer?.appConfiguration || typeof outer.appConfiguration !== "string") {
    throw new Error("不是 OEM 配置文件：缺少 appConfiguration 字符串");
  }
  return JSON.parse(outer.appConfiguration) as OemAppConfigurationInner;
}

function parseOemAppConfigurationText(text: string): ParsedOemSecurity {
  const inner = parseOemAppConfigurationInner(text);
  const sec = inner.securityRestriction;
  if (!sec || typeof sec !== "object") {
    throw new Error("appConfiguration 内未找到 securityRestriction");
  }
  return sec;
}

function countOemConfiguredFields(obj: unknown): number {
  if (!obj || typeof obj !== "object") return 0;
  let n = 0;
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t && t !== "No change") n++;
    } else if (typeof v === "number" && !Number.isNaN(v)) n++;
    else if (v && typeof v === "object") n += countOemConfiguredFields(v);
  }
  return n;
}

function getNested(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function oemScanInternalSelectionRaw(v: string): string {
  const t = v.trim().toLowerCase();
  if (t.includes("rear")) return "rear_camera";
  if (t.includes("engine")) return "scan_engine";
  return v.trim().replace(/\s+/g, "_").toLowerCase();
}

function oemScanTriggerModeRaw(v: string): string {
  const t = v.trim().toLowerCase();
  if (t.includes("hand-free") || t.includes("hand free"))
    return "hand_free_continuous";
  if (t.includes("continuous trigger")) return "hand_free_continuous";
  if (t.includes("continuous") && t.includes("short press"))
    return "short_press_continuous";
  if (t.includes("short press")) return "short_press_decode_or_timeout";
  if (t.includes("continuous") && t.includes("long press"))
    return "long_press_continuous_release_stop";
  if (t.includes("long press")) return "long_press_release_stop";
  return v.trim().replace(/\s+/g, "_").toLowerCase();
}

function oemScanViewFinderWindowRaw(v: string): string {
  const t = v.trim().toLowerCase();
  if (t.includes("full")) return "full_screen";
  if (t.includes("expand")) return "expanded";
  if (t.includes("regular")) return "regular";
  return v.trim().replace(/\s+/g, "_").toLowerCase();
}

function oemScanContinuousModeRaw(v: string): string {
  const t = v.trim().toLowerCase();
  if (t.includes("repeatable")) return "repeatable_decoding";
  if (t.includes("non repeating") || t.includes("non-repeating"))
    return "continuous_non_repeating";
  if (t.includes("no duplicate") || t.includes("cache"))
    return "no_duplicate_in_cache";
  return v.trim().replace(/\s+/g, "_").toLowerCase();
}

export function oemScanValueToExpectRaw(
  oemPath: string,
  oemValue: string | number | unknown[],
): string {
  if (Array.isArray(oemValue)) {
    return oemValue.length ? JSON.stringify(oemValue) : "";
  }
  if (typeof oemValue === "number") return String(oemValue);
  const v = String(oemValue ?? "").trim();
  if (!v || v === "No change") return "";
  if (oemPath.endsWith("internalSelection"))
    return oemScanInternalSelectionRaw(v);
  if (oemPath === "scanTriggerMode") return oemScanTriggerModeRaw(v);
  if (oemPath.endsWith("rearCameraViewFinderWindow"))
    return oemScanViewFinderWindowRaw(v);
  if (oemPath.endsWith("continuousScanningMode"))
    return oemScanContinuousModeRaw(v);
  if (oemPath.endsWith("barcodeCentroidSort")) {
    const t = v.toLowerCase();
    if (t.includes("top")) return "top_to_bottom";
    if (t.includes("left")) return "left_to_right";
    if (t.includes("vertical")) return "vertical_priority";
  }
  if (oemPath === "outputMode.outputModeSelect") {
    const t = v.toLowerCase();
    if (t.includes("intent") && t.includes("keyboard")) return "2";
    if (t.includes("intent")) return "1";
    if (t.includes("keyboard")) return "0";
  }
  if (oemPath === "outputMode.keyBoardOutputMode.keyboardType") {
    const t = v.toLowerCase();
    if (t.includes("input method")) return "1";
    if (t.includes("physical")) return "2";
    if (t.includes("text box")) return "0";
  }
  if (oemPath === "outputMode.keyBoardOutputMode.sound") {
    const t = v.toLowerCase();
    if (t === "sharp") return "2";
    if (t === "short") return "1";
    if (t === "none") return "0";
  }
  if (oemPath === "outputMode.keyBoardOutputMode.operationKeyCharacters") {
    const t = v.toLowerCase();
    if (t.includes("carriage")) return "1";
    if (t.includes("line feed")) return "2";
    if (t.includes("tab")) return "3";
    if (t === "none") return "0";
  }
  if (/^(enable|disable)$/i.test(v)) {
    return v.toLowerCase() === "enable" ? "1" : "0";
  }
  return v;
}

export function expectTemplateFromOemScanStep(
  scanStep: Record<string, unknown>,
  meta: {
    id: string;
    name: string;
    description?: string;
    sourcePath?: string;
  },
): ExpectTemplate {
  const expectations: Record<string, ExpectEntry> = {};
  for (const item of loadScanManifestItems()) {
    const path = item.oemPath.split(".");
    const rawVal = getNested(scanStep, path);
    if (rawVal == null || rawVal === "") continue;
    if (typeof rawVal === "string" && rawVal.trim() === "No change") continue;
    if (Array.isArray(rawVal) && rawVal.length === 0) continue;
    const raw = oemScanValueToExpectRaw(item.oemPath, rawVal as string | number);
    if (!raw) continue;
    expectations[item.probeId] = {
      value: raw,
      hint: `${item.oemPath}=${String(rawVal)}`,
    };
  }
  const n = Object.keys(expectations).length;
  return {
    version: 1,
    id: meta.id,
    name: meta.name,
    description:
      meta.description ??
      (n === 0
        ? "未解析到可对比项（scanStep 均为 No change）。"
        : `推送 Scan-1 或 Scan-2 后，请在面板选择同一 JSON 对比：应全部一致（${n} 项）。Scan-1 偏「开/选项 A」，Scan-2 偏「关/选项 B」；文本与数值两文件相同。`),
    scope: {
      layoutId: "oem20-data-capture-scanner-panel",
      module: "Data Capture & Peripherals / Scanner",
    },
    expectations,
    source: meta.sourcePath
      ? { kind: "oem_app_configuration", path: meta.sourcePath }
      : undefined,
  };
}

type OemImportKind = "scan" | "security" | "docking" | "system" | "network49";

function getByPath(root: unknown, oemPath: string): unknown {
  const parts = oemPath.split(".");
  let cur: unknown = root;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function oemSystemValueToExpectRaw(oemValue: unknown): string {
  if (oemValue == null) return "";
  if (typeof oemValue === "boolean") return oemValue ? "1" : "0";
  // OEM schema 默认值 0（指针速度/阈值等）不当作已配置
  if (typeof oemValue === "number" && oemValue === 0) return "";
  const v = String(oemValue).trim();
  if (!v || v === "No change" || v === "None") return "";
  if (/^(enable|auto)$/i.test(v)) return "1";
  if (/^(disable|manual)$/i.test(v)) return "0";
  return v;
}

/** 按文件名收敛到 System 子模块，避免 Date & Time JSON 带上全量 systemConfiguration */
function systemImportScope(fileName?: string): {
  pathPrefix: string | null;
  layoutId: string;
} {
  const n = (fileName ?? "").toLowerCase();
  if (/date|time|clock|ntp/.test(n)) {
    return {
      pathPrefix: "clockStep.",
      layoutId: "oem20-system-date-time-panel",
    };
  }
  if (/sound|volume|audio/.test(n)) {
    return { pathPrefix: "soundStep.", layoutId: "oem20-system-sound-panel" };
  }
  if (/display|brightness|font|screensaver|wallpaper/.test(n)) {
    return {
      pathPrefix: "displayStep.",
      layoutId: "oem20-system-display-panel",
    };
  }
  if (/touch|glove/.test(n)) {
    return {
      pathPrefix: "touchModeStep.",
      layoutId: "oem20-system-touch-mode-panel",
    };
  }
  if (/notif/.test(n)) {
    return {
      pathPrefix: "notificationStep.",
      layoutId: "oem20-system-notification-panel",
    };
  }
  if (/language|input|ime/.test(n)) {
    return {
      pathPrefix: "languageInputStep.",
      layoutId: "oem20-system-language-input-panel",
    };
  }
  if (/system\s*ui|导航|gesture/.test(n) || /system-ui/.test(n)) {
    return {
      pathPrefix: "systemUiStep.",
      layoutId: "oem20-system-ui-panel",
    };
  }
  if (/power|battery|charg/.test(n)) {
    return {
      pathPrefix: "powerManagementStep.",
      layoutId: "oem20-system-power-management-panel",
    };
  }
  return {
    pathPrefix: null,
    layoutId: "oem20-system-configuration",
  };
}

function expectTemplateFromOemSystemConfig(
  sys: Record<string, unknown>,
  meta: {
    id: string;
    name: string;
    sourcePath?: string;
    description?: string;
    fileName?: string;
  },
): ExpectTemplate {
  const map = loadSystemProbeMap();
  const { pathPrefix, layoutId } = systemImportScope(meta.fileName ?? meta.name);
  const expectations: Record<string, ExpectEntry> = {};
  for (const [oemPath, probeId] of Object.entries(map)) {
    if (pathPrefix && !oemPath.startsWith(pathPrefix)) continue;
    const cur = getByPath(sys, oemPath);
    const raw = oemSystemValueToExpectRaw(cur);
    if (!raw) continue;
    expectations[probeId] = { value: raw, hint: `${oemPath}=${cur}` };
  }
  return {
    version: 1,
    id: meta.id,
    name: meta.name,
    description: meta.description,
    scope: {
      layoutId,
      module: "System Configuration",
    },
    expectations,
    source: meta.sourcePath
      ? { kind: "oem_app_configuration", path: meta.sourcePath }
      : undefined,
  };
}

function dockingHasActionToggles(step: Record<string, unknown> | undefined): boolean {
  if (!step) return false;
  for (const k of [
    "bottomHostModeEnable",
    "backHostModeEnable",
    "dockingEthernetMode",
  ]) {
    const v = step[k];
    if (typeof v === "string" && /^(enable|disable)$/i.test(v.trim())) return true;
  }
  return false;
}

/** System 子模块文件名（勿漏 touch：否则会被全量 scanStep 默认值抢成 Scan） */
const SYSTEM_MODULE_FILE_RE =
  /date|time|clock|ntp|display|sound|volume|audio|touch|glove|notif|language|input|ime|system\s*ui|system-ui|power|battery|charg|system\s*config/i;

const NETWORK_49_FILE_RE =
  /4-9|集合\s*4|private\s*dns|nfc|ethernet|gps|bluetooth|airplane/i;

const NETWORK_49_STEPS = [
  "privateDnsStep",
  "nfcStep",
  "ethernetStep",
  "gpsStep",
  "bluetoothStep",
  "airplaneStep",
] as const;

function countNetwork49Configured(
  net: Record<string, unknown> | undefined,
): number {
  if (!net) return 0;
  let n = 0;
  for (const step of NETWORK_49_STEPS) {
    n += countOemConfiguredFields(net[step]);
  }
  return n;
}

function detectOemImportKind(
  inner: OemAppConfigurationInner,
  fileName?: string,
): OemImportKind {
  const name = fileName ?? "";
  const scanN = countOemConfiguredFields(inner.dataCapturePeripherals?.scanStep);
  const secN = countOemConfiguredFields(inner.securityRestriction);
  const dockN = countOemConfiguredFields(
    inner.dataCapturePeripherals?.dockingStationStep,
  );
  const sysN = countOemConfiguredFields(inner.systemConfiguration);
  const net49N = countNetwork49Configured(inner.networkConfiguration);
  // 文件名优先：Touch/Display/Sound 等 JSON 虽夹带全量 scanStep，仍按 System 解析
  if (SYSTEM_MODULE_FILE_RE.test(name) && inner.systemConfiguration) {
    return "system";
  }
  if (NETWORK_49_FILE_RE.test(name) && net49N > 0) {
    return "network49";
  }
  if (/^scan([-_\s]|$)/i.test(name) || /scanner/i.test(name)) {
    return "scan";
  }
  if (/security|restriction/i.test(name)) {
    return "security";
  }
  // Docking JSON 常夹带 scanStep 默认数值，优先看 Host/Ethernet 动作开关与文件名
  if (
    dockingHasActionToggles(inner.dataCapturePeripherals?.dockingStationStep) ||
    (dockN > 0 && /docking/i.test(name))
  ) {
    return "docking";
  }
  if (sysN > 0 && (SYSTEM_MODULE_FILE_RE.test(name) || sysN >= scanN)) {
    return "system";
  }
  if (net49N > 0 && net49N >= scanN && net49N >= secN) {
    return "network49";
  }
  if (scanN >= secN && scanN >= dockN && scanN > 0) return "scan";
  if (dockN > secN && dockN > 0) return "docking";
  return "security";
}

function network49ImportScope(fileName?: string): {
  pathPrefix: string | null;
  layoutId: string;
} {
  const n = (fileName ?? "").toLowerCase();
  if (/4-9|集合/.test(n)) {
    return {
      pathPrefix: null,
      layoutId: "oem20-network-collection-4-9-panel",
    };
  }
  if (/private|dns/.test(n)) {
    return {
      pathPrefix: "privateDnsStep.",
      layoutId: "oem20-network-private-dns",
    };
  }
  if (/nfc/.test(n)) {
    return { pathPrefix: "nfcStep.", layoutId: "oem20-network-nfc" };
  }
  if (/ethernet|eth/.test(n)) {
    return {
      pathPrefix: "ethernetStep.",
      layoutId: "oem20-network-ethernet",
    };
  }
  if (/gps|location/.test(n)) {
    return { pathPrefix: "gpsStep.", layoutId: "oem20-network-gps" };
  }
  if (/bluetooth|bt/.test(n)) {
    return {
      pathPrefix: "bluetoothStep.",
      layoutId: "oem20-network-bluetooth",
    };
  }
  if (/airplane|飞行/.test(n)) {
    return {
      pathPrefix: "airplaneStep.",
      layoutId: "oem20-network-airplane",
    };
  }
  return {
    pathPrefix: null,
    layoutId: "oem20-network-collection-4-9-panel",
  };
}

function oemNetwork49ValueToExpectRaw(oemValue: unknown): string {
  if (oemValue == null) return "";
  if (typeof oemValue === "boolean") return oemValue ? "1" : "0";
  const v = String(oemValue).trim();
  if (!v || v === "No change" || v === "None") return "";
  if (/^(enable)$/i.test(v)) return "1";
  if (/^(disable)$/i.test(v)) return "0";
  // Private DNS Mode 等枚举原文保留
  return v;
}

function expectTemplateFromOemNetwork49(
  net: Record<string, unknown>,
  meta: {
    id: string;
    name: string;
    sourcePath?: string;
    description?: string;
    fileName?: string;
  },
): ExpectTemplate {
  const map = loadNetwork49ProbeMap();
  const { pathPrefix, layoutId } = network49ImportScope(
    meta.fileName ?? meta.name,
  );
  const expectations: Record<string, ExpectEntry> = {};
  for (const [oemPath, probeId] of Object.entries(map)) {
    if (pathPrefix && !oemPath.startsWith(pathPrefix)) continue;
    const cur = getByPath(net, oemPath);
    const raw = oemNetwork49ValueToExpectRaw(cur);
    if (!raw) continue;
    expectations[probeId] = { value: raw, hint: `${oemPath}=${cur}` };
  }
  return {
    version: 1,
    id: meta.id,
    name: meta.name,
    description: meta.description,
    scope: {
      layoutId,
      module: "Network Configuration",
    },
    expectations,
    source: meta.sourcePath
      ? { kind: "oem_app_configuration", path: meta.sourcePath }
      : undefined,
  };
}

export const OEM_DOCKING_PROBE_MAP: Record<string, string> = {
  bottomHostModeEnable: "dock.bottom_host",
  backHostModeEnable: "dock.back_host",
  dockingEthernetMode: "dock.ethernet",
  "dockingEthernetConfigureStep.dockingEthernetIpMode": "dock.eth_ip_mode",
  "dockingEthernetConfigureStep.dockingEthernetIpAddress": "dock.eth_ip",
  "dockingEthernetConfigureStep.dockingEthernetGateway": "dock.eth_gateway",
  "dockingEthernetConfigureStep.dockingEthernetNetmask": "dock.eth_netmask",
  "dockingEthernetConfigureStep.dockingEthernetDns1": "dock.eth_dns1",
  "dockingEthernetConfigureStep.dockingEthernetDns2": "dock.eth_dns2",
  "dockingEthernetConfigureStep.dockingEthernetProxyHostname":
    "dock.eth_proxy_host",
  "dockingEthernetConfigureStep.dockingEthernetProxyPort": "dock.eth_proxy_port",
  "dockingEthernetConfigureStep.dockingEthernetProxyBypass":
    "dock.eth_proxy_bypass",
  "dockingEthernetConfigureStep.dockingEthernetProxyRestoreDefault":
    "dock.eth_proxy_restore",
};

function oemDockingValueToExpectRaw(oemPath: string, oemValue: unknown): string {
  if (oemValue == null) return "";
  if (typeof oemValue === "boolean") return oemValue ? "1" : "0";
  const v = String(oemValue).trim();
  if (!v || v === "No change" || v === "None") return "";
  if (oemPath.endsWith("ProxyRestoreDefault")) {
    if (/^(true|1|enable|yes)$/i.test(v)) return "1";
    if (/^(false|0|disable|no)$/i.test(v)) return "0";
  }
  if (/^(enable|disable)$/i.test(v)) {
    return v.toLowerCase() === "enable" ? "1" : "0";
  }
  if (oemPath.endsWith("IpMode")) {
    if (/static/i.test(v)) return "Static";
    if (/dhcp/i.test(v)) return "DHCP";
  }
  return v;
}

function expectTemplateFromOemDockingStep(
  step: Record<string, unknown>,
  meta: { id: string; name: string; sourcePath?: string; description?: string },
): ExpectTemplate {
  const expectations: Record<string, ExpectEntry> = {};
  for (const [oemPath, probeId] of Object.entries(OEM_DOCKING_PROBE_MAP)) {
    const parts = oemPath.split(".");
    let cur: unknown = step;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[p];
    }
    const raw = oemDockingValueToExpectRaw(oemPath, cur);
    if (!raw) continue;
    // 恢复代理为一次性动作，不参与实况对比
    if (probeId === "dock.eth_proxy_restore") continue;
    expectations[probeId] = {
      value: raw,
      hint: `${oemPath}=${cur}`,
    };
  }
  return {
    version: 1,
    id: meta.id,
    name: meta.name,
    description: meta.description,
    scope: {
      layoutId: "oem20-data-capture-docking-panel",
      module: "Data Capture & Peripherals / Docking Station",
    },
    expectations,
    source: meta.sourcePath
      ? { kind: "oem_app_configuration", path: meta.sourcePath }
      : undefined,
  };
}

function parseOemLockTimeoutMs(raw: string): string {
  const t = raw.trim().toLowerCase();
  const m = t.match(/^(\d+)\s*(minutes?|mins?|min|分钟)$/);
  if (m) return String(Number(m[1]) * 60_000);
  if (/^\d+$/.test(t)) return t;
  return raw.trim();
}

function parseOemUsbModeRaw(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (k.includes("file") && k.includes("transfer")) return "1";
  if (k === "mtp") return "1";
  if (k.includes("no data")) return "0";
  if (k === "ptp") return "2";
  if (k === "midi") return "3";
  return raw.trim();
}

function oemSecurityValueToExpectRaw(oemKey: string, oemValue: string): string {
  const v = (oemValue ?? "").trim();
  if (!v || v === "No change") return "";
  if (oemKey === "lockScreenSetPassword") return v.length > 0 ? "set" : "";
  if (oemKey === "lockScreenTimeout") return parseOemLockTimeoutMs(v);
  if (oemKey === "lockScreenSet") {
    return v.toLowerCase() === "pin"
      ? "pin"
      : v.toLowerCase() === "pattern"
        ? "pattern"
        : v.toLowerCase() === "slide"
          ? "slide"
          : v.toLowerCase();
  }
  if (oemKey === "USBMode") return parseOemUsbModeRaw(v);
  if (oemKey === "disallowScreenshot") {
    if (/disallow/i.test(v)) return "1";
    if (/allow/i.test(v)) return "0";
  }
  if (/^(enable|disable|disallow|allow)$/i.test(v)) {
    const lower = v.toLowerCase();
    if (lower === "enable" || lower === "allow") return "1";
    if (lower === "disable" || lower === "disallow") return "0";
  }
  return v;
}

export function expectTemplateFromOemConfigFileText(
  fileText: string,
  meta: { sourcePath?: string; fileName?: string },
): ExpectTemplate {
  const inner = parseOemAppConfigurationInner(fileText);
  const fileName = meta.fileName ?? "oem-config.json";
  const id = fileName.replace(/\.json$/i, "").replace(/[^\w.-]+/g, "_").toLowerCase();
  const kind = detectOemImportKind(inner, fileName);

  if (kind === "docking" && inner.dataCapturePeripherals?.dockingStationStep) {
    return expectTemplateFromOemDockingStep(
      inner.dataCapturePeripherals.dockingStationStep,
      {
        id: `oem-${id}`,
        name: fileName,
        sourcePath: meta.sourcePath,
        description: meta.sourcePath
          ? `缓存自：${meta.sourcePath}`
          : undefined,
      },
    );
  }

  if (kind === "system" && inner.systemConfiguration) {
    return expectTemplateFromOemSystemConfig(inner.systemConfiguration, {
      id: `oem-${id}`,
      name: fileName,
      fileName,
      sourcePath: meta.sourcePath,
      description: meta.sourcePath
        ? `缓存自：${meta.sourcePath}`
        : undefined,
    });
  }

  if (kind === "network49" && inner.networkConfiguration) {
    return expectTemplateFromOemNetwork49(inner.networkConfiguration, {
      id: `oem-${id}`,
      name: fileName,
      fileName,
      sourcePath: meta.sourcePath,
      description: meta.sourcePath
        ? `缓存自：${meta.sourcePath}`
        : undefined,
    });
  }

  if (kind === "scan" && inner.dataCapturePeripherals?.scanStep) {
    return expectTemplateFromOemScanStep(
      inner.dataCapturePeripherals.scanStep,
      {
        id: `oem-${id}`,
        name: fileName,
        sourcePath: meta.sourcePath,
        description: meta.sourcePath
          ? `缓存自：${meta.sourcePath}`
          : undefined,
      },
    );
  }

  const security = inner.securityRestriction;
  if (!security || typeof security !== "object") {
    throw new Error(
      "appConfiguration 内未找到可解析的 dockingStationStep / scanStep / systemConfiguration / networkConfiguration(4-9) / securityRestriction",
    );
  }
  const expectations: Record<string, ExpectEntry> = {};
  for (const [oemKey, map] of Object.entries(OEM_SECURITY_PROBE_MAP)) {
    if (!map.probeId) continue;
    const oemVal = security[oemKey];
    if (oemVal == null || oemVal === "" || oemVal === "No change") continue;
    const raw = oemSecurityValueToExpectRaw(oemKey, String(oemVal));
    if (raw === "") continue;
    const hint =
      oemKey === "lockScreenSetPassword" && security.lockScreenSetPassword
        ? `OEM=${security.lockScreenSetPassword}（面板不读明文）`
        : `${oemKey}=${oemVal}`;
    expectations[map.probeId] = { value: raw, hint };
  }
  return {
    version: 1,
    id: `oem-${id}`,
    name: fileName,
    description: meta.sourcePath
      ? `缓存自：${meta.sourcePath}`
      : undefined,
    scope: {
      layoutId: "oem20-securityandrestriction-panel",
      module: "Security&Restriction / Security",
    },
    expectations,
    source: meta.sourcePath
      ? { kind: "oem_app_configuration", path: meta.sourcePath }
      : undefined,
  };
}
