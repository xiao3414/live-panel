/** 与 src/oemConfigToExpect.ts 同步（主进程解析 OEM JSON） */
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

function parseOemAppConfigurationText(text: string): ParsedOemSecurity {
  const outer = JSON.parse(text) as {
    appConfiguration?: string;
  };
  if (!outer?.appConfiguration || typeof outer.appConfiguration !== "string") {
    throw new Error("不是 OEM 配置文件：缺少 appConfiguration 字符串");
  }
  const inner = JSON.parse(outer.appConfiguration) as {
    securityRestriction?: ParsedOemSecurity;
  };
  const sec = inner.securityRestriction;
  if (!sec || typeof sec !== "object") {
    throw new Error("appConfiguration 内未找到 securityRestriction");
  }
  return sec;
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
  const security = parseOemAppConfigurationText(fileText);
  const fileName = meta.fileName ?? "oem-security.json";
  const id = fileName.replace(/\.json$/i, "").replace(/[^\w.-]+/g, "_").toLowerCase();
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
