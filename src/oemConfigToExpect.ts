import type { ExpectEntry, ExpectTemplate } from "./expectCompare";

/** OEM appConfiguration.securityRestriction → 实况面板 probeId */
export const OEM_SECURITY_PROBE_MAP: Record<
  string,
  { probeId: string; note?: string }
> = {
  allowFactoryReset: { probeId: "sec.allow_factory_reset" },
  lockScreenEnable: { probeId: "sec.screen_lock" },
  lockScreenSet: { probeId: "sec.screen_lock_set" },
  lockScreenSetPassword: {
    probeId: "sec.screen_lock_password",
    note: "OEM 明文密码；面板仅比对是否已设置 (set)",
  },
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
  lockScreenNotificationPrivacyMode: {
    probeId: "",
    note: "锁屏通知：面板 21 项暂未收录，仅保留在 OEM 源数据",
  },
};

export type OemAppConfigurationFile = {
  bundleId?: string;
  appConfiguration: string;
};

export type ParsedOemSecurity = Record<string, string>;

export function parseOemAppConfigurationText(text: string): ParsedOemSecurity {
  const outer = JSON.parse(text) as OemAppConfigurationFile;
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

/** "10 minutes" / "10min" / "30min" → 毫秒字符串 */
export function parseOemLockTimeoutMs(raw: string): string {
  const t = raw.trim().toLowerCase();
  const m = t.match(/^(\d+)\s*(minutes?|mins?|min|分钟)$/);
  if (m) return String(Number(m[1]) * 60_000);
  if (/^\d+$/.test(t)) return t;
  return raw.trim();
}

export function parseOemUsbModeRaw(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (k.includes("file") && k.includes("transfer")) return "1";
  if (k === "mtp") return "1";
  if (k.includes("no data")) return "0";
  if (k === "ptp") return "2";
  if (k === "midi") return "3";
  return raw.trim();
}

/** 将 OEM securityRestriction 单字段转为期望 raw（已是 probe 语义） */
export function oemSecurityValueToExpectRaw(
  oemKey: string,
  oemValue: string,
): string {
  const v = (oemValue ?? "").trim();
  if (!v || v === "No change") return "";

  if (oemKey === "lockScreenSetPassword") {
    return v.length > 0 ? "set" : "";
  }
  if (oemKey === "lockScreenTimeout") {
    return parseOemLockTimeoutMs(v);
  }
  if (oemKey === "lockScreenSet") {
    return v.toLowerCase() === "pin"
      ? "pin"
      : v.toLowerCase() === "pattern"
        ? "pattern"
        : v.toLowerCase() === "slide"
          ? "slide"
          : v.toLowerCase();
  }
  if (oemKey === "USBMode") {
    return parseOemUsbModeRaw(v);
  }
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

export function expectTemplateFromOemSecurity(
  security: ParsedOemSecurity,
  meta: {
    id: string;
    name: string;
    description?: string;
    sourcePath?: string;
  },
): ExpectTemplate {
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
    id: meta.id,
    name: meta.name,
    description:
      meta.description ??
      (meta.sourcePath
        ? `由 OEM 配置文件自动生成：${meta.sourcePath}`
        : "由 OEM securityRestriction 自动生成"),
    scope: {
      layoutId: "oem20-securityandrestriction-panel",
      module: "Security&Restriction / Security",
    },
    expectations,
    source: meta.sourcePath
      ? {
          kind: "oem_app_configuration",
          path: meta.sourcePath,
        }
      : undefined,
  };
}

export function expectTemplateFromOemConfigFileText(
  fileText: string,
  meta: { sourcePath?: string; fileName?: string },
): ExpectTemplate {
  const security = parseOemAppConfigurationText(fileText);
  const base = meta.fileName?.replace(/\.json$/i, "") ?? "oem-security";
  const id = base.replace(/[^\w.-]+/g, "_").toLowerCase();
  const displayName = meta.fileName ?? `${base}.json`;
  return expectTemplateFromOemSecurity(security, {
    id: `oem-${id}`,
    name: displayName,
    sourcePath: meta.sourcePath,
  });
}
