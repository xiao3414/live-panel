import type { AppConfig } from "./types.js";
import { adbShell } from "./adb.js";
import {
  scanBridgeGetProperty,
  scanBridgeLoadAllProperties,
} from "./scanBridge.js";

type ProfileCache = {
  at: number;
  props: Map<string, string>;
  note?: string;
};

let cache: ProfileCache | null = null;
let loadInFlight: Promise<ProfileCache> | null = null;
const CACHE_MS = 12_000;

/** 触发模式以 ContentProvider 单条查询为准（dump 多 profile 时更可靠） */
const PROPERTY_PREFER_DIRECT_QUERY = new Set(["TRIGGERING_MODES"]);

export function invalidateScanWedgeCache() {
  cache = null;
}

async function tryExportActiveProfile(config: AppConfig): Promise<void> {
  await tryAdbShell(
    config,
    "mkdir -p /sdcard/Urovo/Scanwedge /sdcard/livepanel",
    5000,
  );
  const exports = [
    "am broadcast -a com.ubx.datawedge.EXPORT_SCANNER_CONFIG -n com.ubx.datawedge/.service.ImportExoprtReceiver --es ACTION_EXTRA_EXPORT_FILE_PATH /sdcard/livepanel/scanner_property.xml",
    "am broadcast -a com.urovo.scanner.scanwedge.api.EXPORT_PROFILE --es path /sdcard/Urovo/Scanwedge/active_profile.xml",
    "am broadcast -a com.urovo.scanwedge.api.EXPORT_PROFILE --es path /sdcard/Urovo/Scanwedge/active_profile.xml",
  ];
  for (const cmd of exports) {
    await tryAdbShell(config, cmd, 8000);
  }
}

function parsePropertyXml(xml: string): Map<string, string> {
  const props = new Map<string, string>();
  const re =
    /<property\s+[^>]*name="([^"]+)"[^>]*>([^<]*)<\/property>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    props.set(m[1]!, m[2]!.trim());
  }
  return props;
}

async function tryAdbShell(
  config: AppConfig,
  cmd: string,
  timeoutMs: number,
): Promise<string> {
  try {
    return (await adbShell(config, cmd, timeoutMs)).trim();
  } catch {
    return "";
  }
}

async function loadProfileXmlOnce(config: AppConfig): Promise<ProfileCache> {
  const now = Date.now();

  const bridge = await scanBridgeLoadAllProperties(config);
  if (bridge.props.size > 0) {
    cache = { at: now, props: bridge.props };
    return cache;
  }

  await tryExportActiveProfile(config);

  const attempts = [
    "cat /sdcard/livepanel/scanner_property.xml",
    "cat /sdcard/Urovo/Scanwedge/active_profile.xml",
    "cat /sdcard/Urovo/ScanWedge/active_profile.xml",
    "cat /sdcard/scanwedge/active_profile.xml",
    "cat /sdcard/Default_scanner_property.xml",
    "cat /sdcard/ProfileLists_scanner_property.xml",
    "cat /data/local/tmp/livepanel_scan_profile.xml",
    "cat /sdcard/Download/active_profile.xml",
  ];

  for (const cmd of attempts) {
    const xml = await tryAdbShell(config, `${cmd} 2>/dev/null`, 10_000);
    if (xml.includes("<property") && xml.includes("name=")) {
      cache = { at: now, props: parsePropertyXml(xml) };
      return cache;
    }
  }

  const pkgLines = await tryAdbShell(
    config,
    "pm list packages 2>/dev/null | grep -iE 'scanwedge|scan.wedge|urovo.scan'",
    8000,
  );
  const pkgs = pkgLines
    .split("\n")
    .map((l) => l.replace(/^package:/, "").trim())
    .filter(Boolean);
  for (const pkg of pkgs) {
    const xml = await tryAdbShell(
      config,
      `run-as ${pkg} sh -c "cat shared_prefs/*.xml shared_prefs/*/*.xml 2>/dev/null | head -c 600000"`,
      16_000,
    );
    if (xml.includes("SCANNER_ENABLE") || xml.includes("<property")) {
      cache = { at: now, props: parsePropertyXml(xml) };
      return cache;
    }
    for (const sub of [
      "files/Profile",
      "files/profile",
      "files",
      "databases",
    ]) {
      const xml2 = await tryAdbShell(
        config,
        `run-as ${pkg} sh -c "cat ${sub}/*.xml 2>/dev/null | head -c 600000"`,
        16_000,
      );
      if (xml2.includes("<property") && xml2.includes("name=")) {
        cache = { at: now, props: parsePropertyXml(xml2) };
        return cache;
      }
    }
  }

  const suXml = await tryAdbShell(
    config,
    "su 0 cat /data/local/tmp/livepanel_scan_profile.xml 2>/dev/null",
    8000,
  );
  if (suXml.includes("<property")) {
    cache = { at: now, props: parsePropertyXml(suXml) };
    return cache;
  }

  const hint = bridge.note
    ? bridge.note
    : "未读到 DataWedge/ScanWedge 配置（DT630 需升级 USDK 桥接并点「刷新设备」）";
  cache = {
    at: now,
    props: new Map(),
    note: hint,
  };
  return cache;
}

async function loadProfileXml(config: AppConfig): Promise<ProfileCache> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache;
  if (loadInFlight) return loadInFlight;
  loadInFlight = loadProfileXmlOnce(config).finally(() => {
    loadInFlight = null;
  });
  return loadInFlight;
}

export async function prefetchScanWedgeCache(
  config: AppConfig,
): Promise<void> {
  const snap = await loadProfileXml(config);
  for (const name of PROPERTY_PREFER_DIRECT_QUERY) {
    const direct = await scanBridgeGetProperty(config, name);
    if (direct.raw != null && direct.raw !== "" && cache) {
      cache.props.set(name, direct.raw);
    }
  }
  void snap;
}

export async function scanWedgeProperty(
  config: AppConfig,
  propertyName: string,
): Promise<{ raw: string | null; note?: string }> {
  const snap = await loadProfileXml(config);
  const v = snap.props.get(propertyName);
  if (v != null && v !== "") return { raw: v, note: snap.note };
  const direct = await scanBridgeGetProperty(config, propertyName);
  if (direct.raw != null && direct.raw !== "") {
    if (cache) cache.props.set(propertyName, direct.raw);
    return direct;
  }
  return { raw: null, note: direct.note ?? snap.note };
}

/** OEM / 面板统一枚举：Hand-free continuous */
export function normalizeTriggeringModesRaw(v: string | null): string | null {
  if (v == null || v === "") return null;
  const t = v.trim();
  const byNum: Record<string, string> = {
    "0": "short_press_decode_or_timeout",
    /** DT630 / UBX DataWedge 后置等 profile 上常见，与 OEM「Short press decode or timeout」同义 */
    "10": "short_press_decode_or_timeout",
    "1": "short_press_continuous",
    "2": "long_press_release_stop",
    "3": "long_press_continuous_release_stop",
    "4": "hand_free_continuous",
    "8": "hand_free_continuous",
  };
  if (t in byNum) return byNum[t]!;
  const lower = t.toLowerCase();
  if (lower.includes("hand-free") || lower.includes("hand free"))
    return "hand_free_continuous";
  if (lower.includes("short press") && lower.includes("continuous"))
    return "short_press_continuous";
  if (lower.includes("short press")) return "short_press_decode_or_timeout";
  if (lower.includes("long press") && lower.includes("continuous"))
    return "long_press_continuous_release_stop";
  if (lower.includes("long press")) return "long_press_release_stop";
  return t;
}

export function normalizeInternalSelectionFromProps(
  engineType: string | null,
  cameraId: string | null,
): string | null {
  if (cameraId === "1" || cameraId === "2") return "rear_camera";
  if (engineType === "1" || engineType === "0") {
    if (cameraId === "0") return "scan_engine";
  }
  if (engineType === "1") return "scan_engine";
  return null;
}

export function normalizeViewFinderWindowRaw(v: string | null): string | null {
  if (v == null || v === "") return null;
  const t = v.trim();
  const byNum: Record<string, string> = {
    "0": "full_screen",
    "1": "expanded",
    "2": "regular",
  };
  if (t in byNum) return byNum[t]!;
  const lower = t.toLowerCase();
  if (lower.includes("full")) return "full_screen";
  if (lower.includes("expand")) return "expanded";
  if (lower.includes("regular")) return "regular";
  return t;
}

export function normalizeEnableDisableRaw(v: string | null): string | null {
  if (v == null || v === "") return null;
  const lower = v.trim().toLowerCase();
  if (v === "1" || lower === "true" || lower === "enable") return "1";
  if (v === "0" || lower === "false" || lower === "disable") return "0";
  return v;
}
