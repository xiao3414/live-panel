/** 根据主区域宽度选择栅格列数与行高（react-grid-layout） */
export function responsiveGrid(containerWidth: number): {
  cols: number;
  rowHeight: number;
  breakpoint: "xl" | "lg" | "md" | "sm";
} {
  const w = Math.max(320, containerWidth);
  if (w >= 1180) {
    return { cols: 12, rowHeight: 76, breakpoint: "xl" };
  }
  if (w >= 880) {
    return { cols: 10, rowHeight: 72, breakpoint: "lg" };
  }
  if (w >= 560) {
    return { cols: 6, rowHeight: 68, breakpoint: "md" };
  }
  return { cols: 4, rowHeight: 64, breakpoint: "sm" };
}
