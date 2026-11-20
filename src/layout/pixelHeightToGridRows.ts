/** 内容像素高度 → RGL 行数（含块间 marginY） */
export function pixelHeightToGridRows(
  contentPx: number,
  rowHeight: number,
  marginY: number,
): number {
  if (contentPx <= 0) return 1;
  let h = 1;
  while (h < 200) {
    const total = h * rowHeight + (h - 1) * marginY;
    if (total >= contentPx) return h;
    h++;
  }
  return h;
}
