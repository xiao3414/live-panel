/**
 * Scan-1 / Scan-2 成对策略（推送 + 对比）：
 * - 开关类：Scan-1 = Enable（开），Scan-2 = Disable（关）；scanSwitch 在 Scan-2 仍 Enable（OEM 在扫描关时往往不下发 enum）
 * - 选择类（enum / OEM 枚举项）：Scan-1、Scan-2 各选一条合法选项
 * - 数值/文本参数：两文件相同（取自官方模板默认值），推送任一侧后对比应无差异
 *
 * 运行：node tools/build_scan_compare_fixtures.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCAN_OEM_ENUM_LABELS } from "./scan_oem_enum_labels.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OEM_BUNDLE_ID = "com.urovo.oemconfigs2";
const VENDOR_SCAN1 = path.resolve(
  "D:/test_tools/OEM2.0/定制配置文件/6. Data Capture&Peripherals/1. Scan/Scan-1.json",
);
const OUT_DIR = path.resolve(
  __dirname,
  "../../../04_配置模板库/OEM/4_Scan",
);
const POLICY_SCAN1 = path.resolve(
  __dirname,
  "../policies/oem20/data-capture/Scan-1.json",
);
const POLICY_SCAN2 = path.resolve(
  __dirname,
  "../policies/oem20/data-capture/Scan-2.json",
);
const MANIFEST = path.resolve(
  __dirname,
  "../registry/scan/oem20_scan_manifest.json",
);

/** 选择类：Scan-1 选项 A，Scan-2 选项 B（OEM 配置文件中的字符串） */
const ENUM_PAIRS = {
  /** Scan-1=后置（DT630 出厂常见），Scan-2=引擎；推送 Scan-2 后应切到引擎 */
  "scannerSelectionStep.internalSelection": ["Rear camera", "Scan engine"],
  "scannerSelectionStep.scanEngineStep.scanEngineViewFinderTarget": [
    "Enable",
    "Disable",
  ],
  "scannerSelectionStep.rearCameraStep.rearCameraTorchControl": [
    "Disable",
    "Enable",
  ],
  "scannerSelectionStep.rearCameraStep.rearCameraViewFinderWindow": [
    "Expanded",
    "Regular",
  ],
  "scannerSelectionStep.rearCameraStep.rearCameraViewFinderTarget": [
    "Enable",
    "Disable",
  ],
  scanTriggerMode: [
    "Short press decode or timeout",
    "Hand-free continuous",
  ],
  "multipleBarcodeParameters.barcodeCentroidSort": [
    "Top to bottom",
    "Vertical priority",
  ],
  /** 与设备 WEDGE_INTENT_ENABLE 0/1/2 及面板 labels 对齐（勿再写 Enable/Disable） */
  "outputMode.outputModeSelect": ["Intent Output", "Keyboard Output"],
  "outputMode.keyBoardOutputMode.keyboardType": [
    "Text Box Optimization",
    "Input Method Software",
  ],
  "outputMode.keyBoardOutputMode.sound": ["Short", "Sharp"],
  "outputMode.keyBoardOutputMode.operationKeyCharacters": [
    "Carriage Return",
    "Tab",
  ],
  /** OEM 手册取值为 Off / Normal Video；On 作别名保留在 labels */
  "ocrScan.ocrDecodeMode": ["Off", "Normal Video"],
  "ocrScan.ocrTemplate": ["User Defined", "Foundation"],
  /** 长度无独立 wedge 属性，不进成对对比（避免误绑 DEC_OCR_MODE） */
};

/** DT630 实况常见值（与官方模板数值不一致时，两 JSON 共用，便于推送后对比） */
const DT630_SHARED_NUMERIC = {
  "readerParameters.otherSettingsStep.imageContrastLevel": 10,
  "barcodeSettings.interleaved2of5Step.interleaved2of5Length1": 2,
  "barcodeSettings.gs1DataBarFamilyStep.gs1ExpandedLength1": 2,
};

function loadVendorInner() {
  const outer = JSON.parse(fs.readFileSync(VENDOR_SCAN1, "utf8"));
  return JSON.parse(outer.appConfiguration);
}

function getNested(obj, parts) {
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function setNested(obj, oemPath, value) {
  const parts = oemPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function pairFromLabels(oemPath) {
  const labels = SCAN_OEM_ENUM_LABELS[oemPath];
  if (!labels) return null;
  const seen = new Set();
  const display = [];
  for (const v of Object.values(labels)) {
    if (typeof v !== "string" || /^\d+$/.test(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    display.push(v);
  }
  if (display.length >= 2) return [display[0], display[1]];
  return null;
}

function resolveBaseline(vendorStep, oemPath) {
  if (oemPath in DT630_SHARED_NUMERIC) {
    return DT630_SHARED_NUMERIC[oemPath];
  }
  const raw = getNested(vendorStep, oemPath.split("."));
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim() && raw !== "No change") return raw;
  if (oemPath === "readerParameters.minimumLengthOfOneDimensionalCodeValue") {
    return 1;
  }
  return raw;
}

/**
 * Scan-2 若关 scanSwitch，DT630 OEM 常只改开关、不写扫码头/输出/OCR 等 → 对比永远剩 6 条。
 * 成对「关」侧改由 scanFloatingButton 等其余 toggle 承担；主扫描开关两包均 Enable。
 */
const TOGGLE_FORCE_ENABLE = new Set(["scanSwitch"]);

/** 官方模板里已是 Enable/Disable 的才是真正的开关项；No change 的 toggle 不能强行写 Enable */
function isVendorEnableDisableLeaf(vendorStep, oemPath) {
  const raw = getNested(vendorStep, oemPath.split("."));
  if (typeof raw !== "string") return false;
  const t = raw.trim();
  return t === "Enable" || t === "Disable";
}

function buildScanStep(profile, vendorStep, items) {
  const scanStep = structuredClone(vendorStep);
  for (const item of items) {
    const p = item.oemPath;
    let value;
    const enumPair = ENUM_PAIRS[p] ?? pairFromLabels(p);
    if (enumPair && (item.displayType === "enum" || ENUM_PAIRS[p])) {
      value = profile === 1 ? enumPair[0] : enumPair[1];
    } else if (
      item.displayType === "toggle" &&
      isVendorEnableDisableLeaf(vendorStep, p)
    ) {
      if (profile === 2 && TOGGLE_FORCE_ENABLE.has(p)) {
        value = "Enable";
      } else {
        value = profile === 1 ? "Enable" : "Disable";
      }
    } else if (item.displayType === "toggle") {
      continue;
    } else {
      value = resolveBaseline(vendorStep, p);
      if (value === "No change" || value === "" || value == null) continue;
    }
    setNested(scanStep, p, value);
  }
  for (const [p, pair] of Object.entries(ENUM_PAIRS)) {
    if (items.some((i) => i.oemPath === p)) continue;
    setNested(scanStep, p, profile === 1 ? pair[0] : pair[1]);
  }
  sanitizeScanStepForOem(scanStep);
  return scanStep;
}

/** 官方模板里超大数字会被 JSON.stringify 成科学计数法，导致 OEM 拒收整段 scanStep */
function sanitizeScanStepForOem(scanStep) {
  const ocr = scanStep.ocrScan;
  if (!ocr || typeof ocr !== "object") return;
  const custom = ocr.ocrCustomTemplate;
  if (
    typeof custom === "number" ||
    (typeof custom === "string" &&
      (custom.includes("e+") || custom.includes("E+") || custom.length > 128))
  ) {
    ocr.ocrCustomTemplate = "No change";
  }
}

function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof target[k] === "object" &&
      target[k] &&
      !Array.isArray(target[k])
    ) {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

function writeScanFixture(name, scanStep) {
  const inner = loadVendorInner();
  inner.dataCapturePeripherals.scanStep = scanStep;
  const out = {
    bundleId: OEM_BUNDLE_ID,
    appConfiguration: JSON.stringify(inner),
  };
  const text = JSON.stringify(out);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), text, "utf8");
  if (name === "Scan-1" || name === "Scan-2") {
    const policyPath = name === "Scan-1" ? POLICY_SCAN1 : POLICY_SCAN2;
    fs.mkdirSync(path.dirname(policyPath), { recursive: true });
    fs.writeFileSync(policyPath, text, "utf8");
  }
}

function coverageUnion(fileNames, items) {
  const hit = new Map();
  for (const f of fileNames) {
    const inner = JSON.parse(
      JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), "utf8"))
        .appConfiguration,
    );
    const scan = inner.dataCapturePeripherals.scanStep;
    for (const item of items) {
      const v = getNested(scan, item.oemPath.split("."));
      const ok =
        (typeof v === "string" && v.trim() && v !== "No change") ||
        (typeof v === "number" && !Number.isNaN(v)) ||
        (Array.isArray(v) && v.length > 0);
      if (ok) hit.set(item.oemPath, f);
    }
  }
  return { hit, total: items.length };
}

if (!fs.existsSync(VENDOR_SCAN1)) {
  console.error("缺少官方模板:", VENDOR_SCAN1);
  process.exit(1);
}

const vendorInner = loadVendorInner();
const vendorStep = vendorInner.dataCapturePeripherals.scanStep;
const items = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).items;

const scanStep1 = buildScanStep(1, vendorStep, items);
const scanStep2 = buildScanStep(2, vendorStep, items);

writeScanFixture("Scan-1", scanStep1);
writeScanFixture("Scan-2", scanStep2);

/** Scan-3：扩展用例（非 Scan-1/2 推送主路径） */
const scan3 = buildScanStep(1, vendorStep, items);
deepMerge(scan3, {
  scanTriggerMode: "Long press release stop",
  scannerSelectionStep: { internalSelection: "Rear camera" },
});
writeScanFixture("Scan-3", scan3);

const { hit, total } = coverageUnion(
  ["Scan-1.json", "Scan-2.json", "Scan-3.json"],
  items,
);
console.log(`已写入 ${OUT_DIR}`);
console.log(`bundleId=${OEM_BUNDLE_ID}`);
console.log(
  "Scan-1/2：toggle Scan-1=Enable、Scan-2=Disable（scanSwitch 两包均 Enable）；选择类各一条；数值一致。",
);
console.log(`Manifest 并集覆盖：${hit.size}/${total}`);
const miss = items.filter((i) => !hit.has(i.oemPath)).map((i) => i.oemPath);
if (miss.length) {
  console.log("仍为 No change 的路径（示例）:", miss.slice(0, 12));
}
