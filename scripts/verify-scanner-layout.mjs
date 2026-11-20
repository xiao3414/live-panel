/**
 * Scanner 布局验收：装箱坐标、版本、与 Security 一致间距参数
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const layoutPath = path.join(
  ROOT,
  "layouts/oem20-data-capture-scanner-panel.json",
);
const yamlPath = path.join(
  ROOT,
  "registry/modules/oem20_scan_probes.yaml",
);

function memberCountsFromYaml(yaml) {
  const counts = new Map();
  let cur = null;
  let n = 0;
  for (const line of yaml.split("\n")) {
    const idm = line.match(/^  - id: (scan\.module\.\S+)/);
    if (idm) {
      if (cur) counts.set(cur, n);
      cur = idm[1];
      n = 0;
      continue;
    }
    if (cur && /^\s+- scan\./.test(line)) n++;
  }
  if (cur) counts.set(cur, n);
  return counts;
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

function scannerBlockFootprint(memberCount, layoutCols = 12) {
  let w;
  if (memberCount <= 1) w = soloScanBlockWidth(layoutCols);
  else if (memberCount <= 2) w = 4;
  else if (memberCount <= 4) w = 6;
  else w = layoutCols;
  return { w, h: scannerBlockHeight(memberCount, w) };
}

const SOLO_TOGGLE_MODULE_IDS = new Set([
  "scan.module.scanSwitch",
  "scan.module.scanFloatingButton",
]);

function packWidgets(widgets, memberCounts, cols = 12) {
  const sorted = [...widgets].sort(
    (a, b) => (a.sotiOrder ?? 0) - (b.sotiOrder ?? 0),
  );
  const soloToggles = sorted.filter((w) =>
    SOLO_TOGGLE_MODULE_IDS.has(w.probeIds[0]),
  );
  const rest = sorted.filter((w) => !SOLO_TOGGLE_MODULE_IDS.has(w.probeIds[0]));
  const packOrder = [...soloToggles, ...rest];
  let x = 0;
  let y = 0;
  let rowH = 0;
  const out = [];
  for (const w of packOrder) {
    const n = memberCounts.get(w.probeIds[0]) ?? 1;
    const { w: gw, h: gh } = scannerBlockFootprint(n, cols);
    if (x + gw > cols) {
      y += rowH;
      x = 0;
      rowH = 0;
    }
    out.push({ id: w.id, probeIds: w.probeIds, x, y, w: gw, h: gh });
    x += gw;
    rowH = Math.max(rowH, gh);
    if (x >= cols) {
      y += rowH;
      x = 0;
      rowH = 0;
    }
  }
  return out;
}

const layout = JSON.parse(fs.readFileSync(layoutPath, "utf8"));
const yaml = fs.readFileSync(yamlPath, "utf8");
const memberCounts = memberCountsFromYaml(yaml);

let failed = false;
const fail = (msg) => {
  console.error("[verify:scanner-layout]", msg);
  failed = true;
};

if (layout.layoutVersion !== 16) {
  fail(`layoutVersion should be 16, got ${layout.layoutVersion}`);
}

const margin = layout.grid?.margin;
if (!margin || margin[0] !== 10 || margin[1] !== 10) {
  fail(`grid.margin should be [10,10], got ${JSON.stringify(margin)}`);
}
if (layout.grid?.rowHeight !== 64) {
  fail(`rowHeight should be 64, got ${layout.grid?.rowHeight}`);
}
if (layout.grid?.compactType !== "vertical") {
  fail(`compactType should be vertical, got ${layout.grid?.compactType}`);
}

const expected = packWidgets(layout.widgets, memberCounts, 12);
const byId = new Map(layout.widgets.map((w) => [w.id, w]));

for (const exp of expected) {
  const act = byId.get(exp.id);
  if (!act) {
    fail(`missing widget ${exp.id}`);
    continue;
  }
  for (const key of ["x", "y", "w", "h"]) {
    if (act[key] !== exp[key]) {
      fail(
        `${act.titleZh ?? exp.id}: ${key}=${act[key]} expected ${exp[key]}`,
      );
    }
  }
}

const topRow = layout.widgets.filter((w) => w.y === 0 && w.h === 1 && w.w === 3);
if (topRow.length < 2) {
  fail(`expected at least 2 compact cards on row y=0, got ${topRow.length}`);
}

if (!failed) {
  console.log(
    `[verify:scanner-layout] OK — ${layout.widgets.length} modules, packed, v16`,
  );
}
process.exit(failed ? 1 : 0);
