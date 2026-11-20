/**
 * 从 OEM 2.0 Scan-1.json（与 261009 APK scanStep 同 schema）生成：
 * - registry/scan/oem20_scan_manifest.json
 * - registry/modules/oem20_scan_probes.yaml
 * - layouts/oem20-data-capture-scanner-panel.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { SCAN_OEM_I18N } from "./scan_oem_i18n_map.mjs";
import { SCAN_OEM_ENUM_LABELS } from "./scan_oem_enum_labels.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
execSync("node tools/build_scan_wedge_property_map.mjs", {
  cwd: ROOT,
  stdio: "inherit",
});
const SCAN_JSON = path.join(
  ROOT,
  "policies/oem20/data-capture/Scan-1.json",
);
const WEDGE_MAP_PATH = path.join(
  ROOT,
  "registry/scan/scan_wedge_property_map.json",
);

function probeIdFromOemPath(oemPath) {
  if (!oemPath.includes(".")) return `scan.${oemPath}`;
  return `scan.${oemPath.replace(/\./g, "__")}`;
}

function camelToTitle(s) {
  return s
    .replace(/([A-Z])/g, " $1")
    .replace(/[-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function sectionOf(oemPath) {
  const top = oemPath.split(".")[0];
  const map = {
    scanSwitch: "Scan",
    scanFloatingButton: "Scan",
    scanTriggerMode: "Scan",
    scannerSelectionStep: "Scanner Selection",
    continuousScanningSet: "Continuous scanning set",
    multipleBarcodeParameters: "Multibarcode Config",
    outputMode: "Output Mode",
    readerParameters: "Reader parameters",
    udiDataFormat: "UDI Data Format",
    basicDataFormat: "Basic Data Format",
    barcodeSettings: "Barcode settings",
    ocrScan: "OCR Scan",
    featureSet: "Feature Set",
  };
  return map[top] ?? "Scan";
}

function inferDisplay(oemPath, sample) {
  // 有显式枚举表时优先 enum（避免 sound=Short 被推断成 text/toggle）
  const enumLabels = SCAN_OEM_ENUM_LABELS[oemPath];
  if (enumLabels && Object.keys(enumLabels).length > 0) return "enum";
  if (typeof sample === "number") return "text";
  if (Array.isArray(sample)) return "text";
  const leaf = oemPath.split(".").pop() ?? oemPath;
  if (
    /Trigger|Selection|ModeSelect|CentroidSort|outputModeSelect|keyboardType|Template|DecodeMode|Typeface|CharacterType|Encoding|Verification|Inverse|Boundary|SecurityLevel|QuietZone|Symbolog|FormatSwitch|tokenFormat|tokenSeparator|convertCharacterCase|barcodeIdentifier|additionalFormatting|imageEnhanceMode|lowContrastMode/i.test(
      oemPath,
    ) &&
    typeof sample === "string" &&
    sample.length > 0 &&
    sample !== "No change"
  ) {
    return "enum";
  }
  if (
    /Enable|Switch|floating|Torch|Target|Multibarcode|fullReadMode|pasteBoard|parseUrl|tcpNetwork|lowPower|lowContrast|fuzzy|GsCodeSet|applicationIdentifier|disallow/i.test(
      leaf,
    ) ||
    (typeof sample === "string" &&
      /^(Enable|Disable|No change)$/i.test(sample))
  ) {
    return "toggle";
  }
  return "text";
}

/** SOTI / OEM scanStep 顶层模块标题（与 Scan-1.json 键序一致） */
const TOP_LEVEL_SECTION = {
  scanSwitch: {
    en: "Scan Switch",
    zh: "扫描开关",
  },
  scanFloatingButton: {
    en: "Floating Scan Button",
    zh: "悬浮扫描按钮",
  },
  scannerSelectionStep: {
    en: "Scanner Selection",
    zh: "扫码头选择",
  },
  scanTriggerMode: {
    en: "Scan Trigger Mode",
    zh: "扫描触发模式",
  },
  continuousScanningSet: {
    en: "Continuous Scanning Set",
    zh: "连续扫描设置",
  },
  multipleBarcodeParameters: {
    en: "Multibarcode Config",
    zh: "多条码配置",
  },
  outputMode: {
    en: "Output Mode",
    zh: "输出方式",
  },
  readerParameters: {
    en: "Reader Parameters",
    zh: "读取器参数",
  },
  udiDataFormat: {
    en: "UDI Data Format",
    zh: "UDI 数据格式",
  },
  basicDataFormat: {
    en: "Basic Data Format",
    zh: "基本数据格式",
  },
  barcodeSettings: {
    en: "Symbology Settings",
    zh: "条码制式",
  },
  ocrScan: {
    en: "OCR Scan",
    zh: "OCR 扫描",
  },
  featureSet: {
    en: "Special Settings",
    zh: "特色设置",
  },
};

function moduleProbeId(topKey) {
  return `scan.module.${topKey}`;
}

function leavesForTopKey(scanStep, topKey) {
  const v = scanStep[topKey];
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    return [{ oemPath: topKey, sample: v }];
  }
  return walkScanStepLeaves(v, [topKey]);
}

function soloScanBlockWidth(layoutCols) {
  if (layoutCols <= 4) return 2;
  if (layoutCols <= 6) return 2;
  if (layoutCols <= 10) return 3;
  return 3;
}

function scanFormColumns(blockW) {
  if (blockW >= 10) return 4;
  if (blockW >= 6) return 2;
  return 1;
}

function scannerBlockHeight(memberCount, blockW = 12) {
  if (memberCount <= 0) return 1;
  if (memberCount === 1) return 1;
  const cols = scanFormColumns(blockW);
  const fieldRows = Math.ceil(memberCount / cols);
  const bodyRows = Math.ceil(fieldRows * 1.15);
  return Math.max(2, Math.min(1 + bodyRows, 48));
}

/** 与 Security 面板一致：小模块 w=4，中等 w=6，大模块整行 w=12 */
function blockFootprint(memberCount, cols = 12) {
  let w;
  if (memberCount <= 1) w = soloScanBlockWidth(cols);
  else if (memberCount <= 2) w = 4;
  else if (memberCount <= 4) w = 6;
  else w = cols;
  return { w, h: scannerBlockHeight(memberCount, w) };
}

const SOLO_TOGGLE_MODULE_IDS = new Set([
  "scan.module.scanSwitch",
  "scan.module.scanFloatingButton",
]);

function packScanModuleWidgets(modules, cols = 12) {
  const withOrder = modules.map((mod, sotiOrder) => ({ mod, sotiOrder }));
  const soloToggles = withOrder.filter(({ mod }) =>
    SOLO_TOGGLE_MODULE_IDS.has(mod.probeId),
  );
  const rest = withOrder.filter(
    ({ mod }) => !SOLO_TOGGLE_MODULE_IDS.has(mod.probeId),
  );
  const packOrder = [...soloToggles, ...rest];

  const widgets = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  packOrder.forEach(({ mod, sotiOrder }) => {
    const memberCount = mod.memberOemPaths.length;
    const { w, h } = blockFootprint(memberCount, cols);
    if (x + w > cols) {
      y += rowH;
      x = 0;
      rowH = 0;
    }
    widgets.push({
      id: `w_${mod.probeId.replace(/\./g, "_")}`,
      probeIds: [mod.probeId],
      title: mod.en,
      titleZh: mod.zh,
      x,
      y,
      w,
      h,
      sotiOrder,
    });
    x += w;
    rowH = Math.max(rowH, h);
    if (x >= cols) {
      y += rowH;
      x = 0;
      rowH = 0;
    }
  });
  return widgets;
}

function walkScanStepLeaves(obj, prefix = []) {
  const out = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const p = [...prefix, k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out.push(...walkScanStepLeaves(v, p));
    } else {
      out.push({ oemPath: p.join("."), sample: v });
    }
  }
  return out;
}

/** 按 SOTI 顶层键序列出各模块及其叶子（组内 DFS 保持 JSON 键序） */
function buildScanModules(scanStep) {
  const modules = [];
  for (const topKey of Object.keys(scanStep)) {
    const leaves = leavesForTopKey(scanStep, topKey);
    const sec = TOP_LEVEL_SECTION[topKey] ?? {
      en: camelToTitle(topKey),
      zh: camelToTitle(topKey),
    };
    modules.push({
      topKey,
      probeId: moduleProbeId(topKey),
      en: sec.en,
      zh: sec.zh,
      memberOemPaths: leaves.map((l) => l.oemPath),
    });
  }
  return modules;
}

const outer = JSON.parse(fs.readFileSync(SCAN_JSON, "utf8"));
const inner = JSON.parse(outer.appConfiguration);
const scanStep = inner.dataCapturePeripherals?.scanStep;
if (!scanStep) throw new Error("missing scanStep");

const wedgeMap = fs.existsSync(WEDGE_MAP_PATH)
  ? JSON.parse(fs.readFileSync(WEDGE_MAP_PATH, "utf8"))
  : {};

const scanModules = buildScanModules(scanStep);
const leaves = scanModules.flatMap((m) =>
  m.memberOemPaths.map((oemPath) => {
    const sample = manifestSampleFromPath(scanStep, oemPath);
    return { oemPath, sample };
  }),
);

function manifestSampleFromPath(root, oemPath) {
  const parts = oemPath.split(".");
  let cur = root;
  for (const p of parts) {
    cur = cur?.[p];
  }
  return cur;
}
const missingI18n = [];
const manifest = leaves.map(({ oemPath, sample }) => {
  const leaf = oemPath.split(".").pop() ?? oemPath;
  const i18n = SCAN_OEM_I18N[oemPath];
  if (!i18n) missingI18n.push(oemPath);
  const titleEn = i18n?.en ?? camelToTitle(leaf);
  const titleZh = i18n?.zh ?? titleEn;
  return {
    oemPath,
    probeId: probeIdFromOemPath(oemPath),
    title: titleEn,
    titleZh,
    section: sectionOf(oemPath),
    displayType: inferDisplay(oemPath, sample),
    wedgeProperty: wedgeMap[oemPath] ?? wedgeMap[leaf] ?? null,
  };
});
if (missingI18n.length) {
  console.error("[generate_oem20_scan_panel] 缺少中英对照:", missingI18n);
  process.exit(1);
}

fs.mkdirSync(path.join(ROOT, "registry/scan"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "registry/scan/oem20_scan_manifest.json"),
  JSON.stringify(
    {
      version: 1,
      source: "policies/oem20/data-capture/Scan-1.json",
      apkRef: "Urovo_OEMConfig_2.0.0.261009_1744.apk",
      itemCount: manifest.length,
      items: manifest,
    },
    null,
    2,
  ),
  "utf8",
);

const yamlLines = [
  "# OEM 2.0 Scanner — 自动生成（129 项 · SOTI 顺序 · 261009 APK）",
  "# 重新生成: node tools/generate_oem20_scan_panel.mjs",
  "module: Data Capture & Peripherals / Scanner",
  "frameworkRef: 03_接口与配置映射/OEMConfig_2.0_产品框架/Data Capture _ Peripherals.md",
  "probes:",
];

const manifestByProbe = new Map(manifest.map((m) => [m.probeId, m]));

for (const mod of scanModules) {
  const members = mod.memberOemPaths.map(
    (p) => manifestByProbe.get(probeIdFromOemPath(p))?.probeId,
  ).filter(Boolean);
  yamlLines.push(`  - id: ${mod.probeId}
    l1: Data Capture & Peripherals
    module: Data Capture & Peripherals / Scanner
    item: ${mod.en}
    itemZh: ${mod.zh}
    display:
      type: scan_module_form
    probe:
      kind: static
      members:
${members.map((id) => `        - ${id}`).join("\n")}
    enabled: true
    refreshMs: 12000`);
}

for (const item of manifest) {
  const enumLabels = SCAN_OEM_ENUM_LABELS[item.oemPath];
  let labelsBlock = "";
  if (item.displayType === "toggle") {
    labelsBlock = `\n    labels:\n      '1': 启用\n      '0': 禁用`;
  } else if (enumLabels && Object.keys(enumLabels).length) {
    labelsBlock =
      "\n    labels:\n" +
      Object.entries(enumLabels)
        .map(([k, v]) => `      ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
        .join("\n");
  }
  const labels = labelsBlock;
  const runner = item.wedgeProperty
    ? `\n    probe:\n      kind: scan.field\n      oemPath: ${item.oemPath}\n      property: ${item.wedgeProperty}`
    : `\n    probe:\n      kind: scan.field\n      oemPath: ${item.oemPath}`;
  yamlLines.push(`  - id: ${item.probeId}
    l1: Data Capture & Peripherals
    module: Data Capture & Peripherals / Scanner
    item: ${item.title}
    itemZh: ${item.titleZh}
    display:
      type: ${item.displayType}${labels}${runner}
    verifyPath: DT630
    refreshMs: 12000`);
}

fs.writeFileSync(
  path.join(ROOT, "registry/modules/oem20_scan_probes.yaml"),
  `${yamlLines.join("\n")}\n`,
  "utf8",
);

const cols = 12;
const widgets = packScanModuleWidgets(scanModules, cols);

const layout = {
  version: 1,
  name: "OEM2.0 · Data Capture · Scanner",
  oemModule: "Data Capture & Peripherals",
  description: `DT630 · Scanner ${manifest.length} 项 · ${scanModules.length} 个 SOTI 模块块（261009 APK）`,
  grid: {
    cols: 12,
    rowHeight: 64,
    margin: [10, 10],
    compactType: "vertical",
  },
  layoutVersion: 16,
  refresh: { globalMs: 12000, pauseWhenHidden: true },
  widgets,
};

fs.writeFileSync(
  path.join(ROOT, "layouts/oem20-data-capture-scanner-panel.json"),
  `${JSON.stringify(layout, null, 2)}\n`,
  "utf8",
);

console.log(`[generate_oem20_scan_panel] ${manifest.length} probes, layout widgets ${widgets.length}`);
