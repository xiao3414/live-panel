import type { LayoutWidget } from "../types";

/** 仅改一块高度；同列且在其下方的块整体下移，避免重叠（不整页重排） */
export function bumpWidgetGridHeight(
  widgets: LayoutWidget[],
  widgetId: string,
  newH: number,
): LayoutWidget[] {
  const target = widgets.find((w) => w.id === widgetId);
  if (!target || target.h === newH) return widgets;

  const oldBottom = target.y + target.h;
  const delta = newH - target.h;
  const colLeft = target.x;
  const colRight = target.x + target.w;

  return widgets.map((w) => {
    if (w.id === widgetId) return { ...w, h: newH };
    if (delta === 0) return w;
    const wRight = w.x + w.w;
    const sameColumn =
      w.x < colRight && wRight > colLeft && w.y >= oldBottom;
    if (sameColumn) return { ...w, y: Math.max(0, w.y + delta) };
    return w;
  });
}
