import type { LayoutWidget, ProbeMeta } from "../types";

export type SizeKind = "xl" | "lg" | "md" | "sm";

export function widgetSizeKind(meta?: ProbeMeta): SizeKindWithSection {
  const t = meta?.displayType;
  if (
    t === "wifi_general_settings_form" ||
    t === "wifi_advanced_settings_form" ||
    t === "wifi_network_form" ||
    t === "wifi_preference_settings_form" ||
    t === "wifi_whitelist_settings_form"
  ) {
    return "xl";
  }
  if (t === "layout_section") return "section";
  if (t === "catalog") return "lg";
  if (t === "group") return "md";
  if (t === "toggle") return "sm";
  return "md";
}

type SizeKindWithSection = SizeKind | "section";

const KIND_ORDER: Record<SizeKindWithSection, number> = {
  section: -1,
  xl: 0,
  lg: 1,
  md: 2,
  sm: 3,
};

function fullDimensions(
  kind: SizeKindWithSection,
  cols: number,
): { w: number; h: number } {
  if (kind === "section") {
    return { w: cols, h: 1 };
  }
  switch (kind) {
    case "xl":
      if (cols >= 10) return { w: Math.min(6, cols), h: 8 };
      if (cols >= 6) return { w: cols, h: 9 };
      return { w: cols, h: 10 };
    case "lg":
      if (cols >= 10) return { w: 4, h: 4 };
      if (cols >= 6) return { w: cols, h: 4 };
      return { w: cols, h: 5 };
    case "sm":
      if (cols >= 10) return { w: 2, h: 2 };
      if (cols >= 6) return { w: 3, h: 2 };
      return { w: cols, h: 2 };
    case "md":
    default:
      if (cols >= 10) return { w: 3, h: 2 };
      if (cols >= 6) return { w: 3, h: 2 };
      return { w: cols, h: 2 };
  }
}

/** 网格占位高度（与 Dashboard gridLayout 一致） */
export function gridLayoutHeight(w: LayoutWidget): number {
  if (w.ui?.minimized) return 2;
  if (w.ui?.collapsed) return 1;
  return Math.max(1, w.h);
}

function layoutFootprint(
  w: LayoutWidget,
  meta: ProbeMeta | undefined,
  cols: number,
): { gw: number; gh: number; storedH: number } {
  const kind = widgetSizeKind(meta);
  const full = fullDimensions(kind, cols);
  const storedH = Math.max(w.h, full.h);
  const minimized = Boolean(w.ui?.minimized);
  const collapsed = Boolean(w.ui?.collapsed);

  if (minimized) {
    return {
      gw: Math.min(cols, 3),
      gh: 2,
      storedH,
    };
  }
  if (collapsed) {
    return {
      gw: Math.min(cols, 3),
      gh: 1,
      storedH,
    };
  }
  return { gw: Math.min(full.w, cols), gh: full.h, storedH: full.h };
}

type Occ = Set<string>;

function occKey(x: number, y: number) {
  return `${x},${y}`;
}

function canPlace(
  occ: Occ,
  x: number,
  y: number,
  gw: number,
  gh: number,
  cols: number,
): boolean {
  if (x < 0 || x + gw > cols) return false;
  for (let dy = 0; dy < gh; dy++) {
    for (let dx = 0; dx < gw; dx++) {
      if (occ.has(occKey(x + dx, y + dy))) return false;
    }
  }
  return true;
}

function markPlace(occ: Occ, x: number, y: number, gw: number, gh: number) {
  for (let dy = 0; dy < gh; dy++) {
    for (let dx = 0; dx < gw; dx++) {
      occ.add(occKey(x + dx, y + dy));
    }
  }
}

function findSlot(
  occ: Occ,
  gw: number,
  gh: number,
  cols: number,
  startY = 0,
): { x: number; y: number } {
  let y = startY;
  for (;;) {
    for (let x = 0; x <= cols - gw; x++) {
      if (canPlace(occ, x, y, gw, gh, cols)) return { x, y };
    }
    y++;
  }
}

/** 二维装箱；折叠/最小化只占 1～2 行，保留展开时的 storedH */
export function autoArrangeWidgets(
  widgets: LayoutWidget[],
  probeMeta: Map<string, ProbeMeta>,
  cols: number,
): LayoutWidget[] {
  const occ: Occ = new Set();
  const placed = new Map<string, LayoutWidget>();

  const pinned = widgets.filter((w) => w.ui?.pinned);
  const rest = widgets.filter((w) => !w.ui?.pinned);

  for (const w of pinned) {
    const meta = probeMeta.get(w.probeIds[0]);
    const { gw, gh, storedH } = layoutFootprint(w, meta, cols);
    const x = Math.min(w.x, Math.max(0, cols - gw));
    const y = Math.max(0, w.y);
    markPlace(occ, x, y, gw, gh);
    placed.set(w.id, { ...w, x, y, w: gw, h: storedH });
  }

  const compact = rest.filter(
    (w) => w.ui?.collapsed || w.ui?.minimized,
  );
  const expanded = rest.filter(
    (w) => !w.ui?.collapsed && !w.ui?.minimized,
  );

  compact.sort((a, b) =>
    (a.title ?? a.id).localeCompare(b.title ?? b.id, "zh-CN"),
  );

  for (const w of compact) {
    const meta = probeMeta.get(w.probeIds[0]);
    const { gw, gh, storedH } = layoutFootprint(w, meta, cols);
    const { x, y } = findSlot(occ, gw, gh, cols, 0);
    markPlace(occ, x, y, gw, gh);
    placed.set(w.id, { ...w, x, y, w: gw, h: storedH });
  }

  const sortedExpanded = [...expanded].sort((a, b) => {
    const ma = probeMeta.get(a.probeIds[0]);
    const mb = probeMeta.get(b.probeIds[0]);
    const ka = widgetSizeKind(ma);
    const kb = widgetSizeKind(mb);
    if (KIND_ORDER[ka] !== KIND_ORDER[kb]) {
      return KIND_ORDER[ka] - KIND_ORDER[kb];
    }
    return (a.title ?? a.id).localeCompare(b.title ?? b.id, "zh-CN");
  });

  for (const w of sortedExpanded) {
    const meta = probeMeta.get(w.probeIds[0]);
    const { gw, gh, storedH } = layoutFootprint(w, meta, cols);
    const { x, y } = findSlot(occ, gw, gh, cols, 0);
    markPlace(occ, x, y, gw, gh);
    placed.set(w.id, { ...w, x, y, w: gw, h: storedH });
  }

  return widgets.map((w) => placed.get(w.id) ?? w);
}

/** RGL 子项缺失或 compact 写回后常见：整列 w=1、x=0 */
export function isLayoutProbablyCorrupt(
  widgets: LayoutWidget[],
  cols: number,
): boolean {
  if (widgets.length < 4) return false;
  let narrow = 0;
  for (const w of widgets) {
    if (w.w < 2 || w.x < 0 || w.x + w.w > cols + 1) narrow++;
  }
  if (narrow >= Math.ceil(widgets.length * 0.45)) return true;
  const allFirstCol = widgets.filter((w) => w.x === 0).length === widgets.length;
  const allThin = widgets.filter((w) => w.w <= 1).length >= widgets.length - 1;
  if (allFirstCol && allThin) return true;
  return false;
}
