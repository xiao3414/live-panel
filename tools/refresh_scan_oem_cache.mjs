/**
 * 用最新 Scan-1/2/3 源文件刷新 %AppData%/live-panel/oem-config-cache
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.resolve(
  ROOT,
  "../../04_配置模板库/OEM/4_Scan",
);
/** Windows 下 APPDATA 已是 …\\AppData\\Roaming，勿再拼 Roaming */
const CACHE_DIR = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming"),
  "live-panel",
  "oem-config-cache",
);
const MANIFEST = path.join(ROOT, "registry/scan/oem20_scan_manifest.json");

function getNested(obj, parts) {
  let cur = obj;
  for (const k of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  return cur;
}

function oemScanInternalSelectionRaw(v) {
  const t = v.trim().toLowerCase();
  if (t.includes("rear")) return "rear_camera";
  if (t.includes("engine")) return "scan_engine";
  return v.trim().replace(/\s+/g, "_").toLowerCase();
}

function oemScanTriggerModeRaw(v) {
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

function oemScanViewFinderWindowRaw(v) {
  const t = v.trim().toLowerCase();
  if (t.includes("full")) return "full_screen";
  if (t.includes("expand")) return "expanded";
  if (t.includes("regular")) return "regular";
  return v.trim().replace(/\s+/g, "_").toLowerCase();
}

function oemScanContinuousModeRaw(v) {
  const t = v.trim().toLowerCase();
  if (t.includes("repeatable")) return "repeatable_decoding";
  if (t.includes("non repeating") || t.includes("non-repeating"))
    return "continuous_non_repeating";
  if (t.includes("no duplicate") || t.includes("cache"))
    return "no_duplicate_in_cache";
  return v.trim().replace(/\s+/g, "_").toLowerCase();
}

function oemScanValueToExpectRaw(oemPath, oemValue) {
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

function expectTemplateFromOemScanStep(scanStep, meta) {
  const items = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).items;
  const expectations = {};
  for (const item of items) {
    const pathParts = item.oemPath.split(".");
    const rawVal = getNested(scanStep, pathParts);
    if (rawVal == null || rawVal === "") continue;
    if (typeof rawVal === "string" && rawVal.trim() === "No change") continue;
    if (Array.isArray(rawVal) && rawVal.length === 0) continue;
    const raw = oemScanValueToExpectRaw(item.oemPath, rawVal);
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
    description: `推送 ${meta.fileName} 后选同一 JSON 对比，应全部一致（${n} 项）。`,
    scope: {
      layoutId: "oem20-data-capture-scanner-panel",
      module: "Data Capture & Peripherals / Scanner",
    },
    expectations,
    source: { kind: "oem_app_configuration", path: meta.sourcePath },
  };
}

function expectTemplateFromFile(content, sourcePath, fileName) {
  const outer = JSON.parse(content);
  const inner = JSON.parse(outer.appConfiguration);
  const scanStep = inner.dataCapturePeripherals?.scanStep;
  if (!scanStep) throw new Error("missing scanStep");
  return expectTemplateFromOemScanStep(scanStep, {
    id: fileName.replace(/\.json$/i, ""),
    name: fileName,
    sourcePath,
    fileName,
  });
}

const files = ["Scan-1.json", "Scan-2.json", "Scan-3.json"];
fs.mkdirSync(CACHE_DIR, { recursive: true });

for (const fileName of files) {
  const sourcePath = path.join(SRC_DIR, fileName);
  if (!fs.existsSync(sourcePath)) {
    console.warn("[refresh_scan_oem_cache] skip missing", sourcePath);
    continue;
  }
  const content = fs.readFileSync(sourcePath, "utf8");
  const st = fs.statSync(sourcePath);
  const template = expectTemplateFromFile(content, sourcePath, fileName);
  const envelope = {
    version: 1,
    meta: {
      fileName,
      sourcePath,
      mtimeMs: st.mtimeMs,
      size: st.size,
      importedAt: new Date().toISOString(),
    },
    template,
  };
  fs.writeFileSync(
    path.join(CACHE_DIR, fileName),
    JSON.stringify(envelope, null, 2),
    "utf8",
  );
  const n = Object.keys(template.expectations).length;
  console.log(`[refresh_scan_oem_cache] ${fileName} → ${n} expectations`);
}
