import type { LayoutWidget, ProbeMeta } from "../types";

export const SCANNER_PANEL_LAYOUT_ID = "oem20-data-capture-scanner-panel";

/** 仅 1 个字段的模块：栅格宽度（避免窄屏 w=4 占满一行） */
export function soloScanBlockWidth(layoutCols: number): number {
  if (layoutCols <= 4) return 2;
  if (layoutCols <= 6) return 2;
  if (layoutCols <= 10) return 3;
  return 3;
}

/** 模块内表单列数（与 CSS grid-widget--scan-* 一致） */
export function scanFormColumns(blockW: number): number {
  if (blockW >= 10) return 4;
  if (blockW >= 6) return 2;
  return 1;
}

/** 单块高度：按块宽分列后估算行数（rowHeight≈64 + margin 10） */
export function scannerBlockHeight(
  memberCount: number,
  blockW = 12,
): number {
  if (memberCount <= 0) return 1;
  if (memberCount === 1) return 1;
  const cols = scanFormColumns(blockW);
  const fieldRows = Math.ceil(memberCount / cols);
  const bodyRows = Math.ceil(fieldRows * 1.15);
  return Math.max(2, Math.min(1 + bodyRows, 48));
}

/**
 * OEM 模块表单（Display/Sound 等）CSS 固定 2 列，不能按 Scan 的 4 列估高，
 * 否则屏保/外接屏等底部字段会被 widget overflow:hidden 裁掉。
 */
export function oemModuleFormBlockHeight(memberCount: number): number {
  if (memberCount <= 0) return 1;
  if (memberCount === 1) return 2;
  const cols = 2;
  const fieldRows = Math.ceil(memberCount / cols);
  // 字段行 + 分组 legend + 底部操作条；mismatch 文案会加高
  const bodyRows = Math.ceil(fieldRows * 1.45) + 4;
  return Math.max(3, Math.min(bodyRows, 48));
}

export function scannerBlockFootprint(
  memberCount: number,
  layoutCols = 12,
): { w: number; h: number } {
  let w: number;
  if (memberCount <= 1) w = soloScanBlockWidth(layoutCols);
  else if (memberCount <= 2) w = 4;
  else if (memberCount <= 4) w = 6;
  else w = layoutCols;
  return { w, h: scannerBlockHeight(memberCount, w) };
}

export function estimateScannerBlockRows(
  memberCount: number,
  blockW: number,
  layoutCols = 12,
): number {
  const { h } = scannerBlockFootprint(
    memberCount,
    layoutCols,
  );
  const atWidth = scannerBlockHeight(memberCount, blockW);
  return Math.max(h, atWidth);
}

function memberCountForWidget(
  w: LayoutWidget,
  probeMeta: Map<string, ProbeMeta>,
): number {
  const meta = probeMeta.get(w.probeIds[0]);
  return meta?.memberIds?.length ?? 1;
}

function sotiKey(w: LayoutWidget, index: number): number {
  const o = (w as LayoutWidget & { sotiOrder?: number }).sotiOrder;
  return o != null ? o : index;
}

/** 仅含 1 个 toggle 字段的 Scanner 模块（扫描开关、悬浮按钮等） */
export function isSoloToggleScanModule(
  w: LayoutWidget,
  probeMeta: Map<string, ProbeMeta>,
): boolean {
  const meta = probeMeta.get(w.probeIds[0]);
  if (meta?.displayType !== "scan_module_form") return false;
  const members = meta.memberIds;
  if (!members || members.length !== 1) return false;
  return probeMeta.get(members[0])?.displayType === "toggle";
}

function gridHForWidget(
  w: LayoutWidget,
  memberCount: number,
  layoutCols: number,
): number {
  const { w: gw, h: gh } = scannerBlockFootprint(memberCount, layoutCols);
  const atW = scannerBlockHeight(memberCount, gw);
  const minH = Math.max(gh, atW);
  return Math.max(minH, w.h ?? minH);
}

/** Security 式装箱：小模块 4 列宽并排，大模块占满行 */
export function packScannerWidgets(
  widgets: LayoutWidget[],
  probeMeta: Map<string, ProbeMeta>,
  cols = 12,
): LayoutWidget[] {
  const sorted = [...widgets].sort(
    (a, b) =>
      sotiKey(a, widgets.indexOf(a)) - sotiKey(b, widgets.indexOf(b)),
  );
  const soloToggles = sorted.filter((w) =>
    isSoloToggleScanModule(w, probeMeta),
  );
  const soloToggleIds = new Set(soloToggles.map((w) => w.id));
  const packOrder = [
    ...soloToggles,
    ...sorted.filter((w) => !soloToggleIds.has(w.id)),
  ];

  let x = 0;
  let y = 0;
  let rowH = 0;
  const placed = new Map<string, LayoutWidget>();

  for (const w of packOrder) {
    const n = memberCountForWidget(w, probeMeta);
    const { w: gw } = scannerBlockFootprint(n, cols);
    const gh = gridHForWidget(w, n, cols);
    if (x + gw > cols) {
      y += rowH;
      x = 0;
      rowH = 0;
    }
    placed.set(w.id, { ...w, x, y, w: gw, h: gh });
    x += gw;
    rowH = Math.max(rowH, gh);
    if (x >= cols) {
      y += rowH;
      x = 0;
      rowH = 0;
    }
  }

  return widgets.map((w) => placed.get(w.id) ?? w);
}

export function normalizeScannerLayout(
  widgets: LayoutWidget[],
  probeMeta: Map<string, ProbeMeta>,
  cols = 12,
): LayoutWidget[] {
  return packScannerWidgets(widgets, probeMeta, cols);
}

export function scannerLayoutDrifted(
  widgets: LayoutWidget[],
  probeMeta: Map<string, ProbeMeta>,
  cols = 12,
): boolean {
  const norm = normalizeScannerLayout(widgets, probeMeta, cols);
  const byId = new Map(widgets.map((w) => [w.id, w]));
  for (const n of norm) {
    const o = byId.get(n.id);
    if (!o) return true;
    if (o.x !== n.x || o.y !== n.y || o.w !== n.w) return true;
    const minH = scannerBlockHeight(
      memberCountForWidget(n, probeMeta),
      n.w,
    );
    if ((o.h ?? minH) < minH) return true;
  }
  return false;
}
