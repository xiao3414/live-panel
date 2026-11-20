import { useEffect, useRef, type ReactNode } from "react";
import { pixelHeightToGridRows } from "../layout/pixelHeightToGridRows";

type Props = {
  widgetId: string;
  gridRowHeight: number;
  marginY: number;
  minGridRows: number;
  storedGridRows: number;
  onNeedHeight: (widgetId: string, gridRows: number) => void;
  children: ReactNode;
};

/** Scanner 块：按实际内容增高网格行，避免块内裁切 */
export function ScanWidgetAutoSize({
  widgetId,
  gridRowHeight,
  marginY,
  minGridRows,
  storedGridRows,
  onNeedHeight,
  children,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    lastSent.current = storedGridRows;
  }, [storedGridRows]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const shell = root.querySelector<HTMLElement>(".widget-shell");
      const body = shell?.querySelector<HTMLElement>(".widget-shell__body");
      const head = shell?.querySelector<HTMLElement>(".widget-shell__head");
      if (!shell || !body) return;
      const px = (head?.offsetHeight ?? 0) + body.scrollHeight + 2;
      const need = Math.max(
        minGridRows,
        pixelHeightToGridRows(px, gridRowHeight, marginY),
      );
      if (need !== lastSent.current) {
        lastSent.current = need;
        onNeedHeight(widgetId, need);
      }
    };

    let raf = 0;
    const schedule = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    for (const el of root.querySelectorAll(
      ".scan-module-form, .oem-module-form, .docking-station-form, .wifi-form-card, .oem-block-compare, .probe-card",
    )) {
      ro.observe(el);
    }
    schedule();

    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [widgetId, gridRowHeight, marginY, minGridRows, onNeedHeight]);

  return <div ref={rootRef} className="scan-widget-autosize">{children}</div>;
}
