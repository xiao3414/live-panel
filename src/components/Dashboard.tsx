import { useCallback, useMemo } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import type { LayoutFile, LayoutWidget, ProbeMeta, ProbeResult } from "../types";
import { gridLayoutHeight } from "../layout/autoArrange";
import { ProbeWidgetBody } from "./ProbeWidgetBody";
import { LayoutSectionBand } from "./LayoutSectionBand";
import type { CompareRow } from "../expectCompare";
import { isCompareAbnormal } from "../expectCompare";
import { probeBlockTitle } from "../probeTitles";
import { WidgetShell } from "./WidgetShell";

type Props = {
  layout: LayoutFile;
  gridCols: number;
  gridRowHeight: number;
  probeMeta: Map<string, ProbeMeta>;
  values: Map<string, ProbeResult>;
  width: number;
  /** 顶栏面包屑已表达层级时，隐藏布局内 section 条 */
  hideLayoutSections?: boolean;
  onWriteProbe?: (probeId: string, mode: "on" | "off") => void;
  onWriteProbeValue?: (probeId: string, value: string) => void;
  writingProbeId?: string | null;
  onLayoutChange?: (widgets: LayoutWidget[]) => void;
  /** 标题区右键：回退一步布局 */
  onLayoutRevert?: () => boolean;
  onWidgetUiChange?: (widgetId: string, patch: Partial<LayoutWidget["ui"]>) => void;
  onRemoveWidget?: (widgetId: string) => void;
  deviceSerial?: string;
  readOnly?: boolean;
  compareByProbeId?: Map<string, CompareRow>;
  /** 开启后隐藏一致项与平台强制项，只保留不符/未读到块 */
  expectShowAbnormalOnly?: boolean;
  showEnSubtitles?: boolean;
};

export function Dashboard({
  layout,
  gridCols,
  gridRowHeight,
  probeMeta,
  values,
  width,
  hideLayoutSections,
  deviceSerial,
  readOnly,
  onWriteProbe,
  onWriteProbeValue,
  writingProbeId,
  onLayoutChange,
  onLayoutRevert,
  onWidgetUiChange,
  onRemoveWidget,
  compareByProbeId,
  expectShowAbnormalOnly,
  showEnSubtitles,
}: Props) {
  const margin = layout.grid.margin ?? [12, 12];
  const visibleWidgets = useMemo(() => {
    if (!hideLayoutSections) return layout.widgets;
    return layout.widgets.filter((w) => {
      const meta = probeMeta.get(w.probeIds[0]);
      return meta?.displayType !== "layout_section";
    });
  }, [layout.widgets, probeMeta, hideLayoutSections]);

  const displayWidgets = useMemo(() => {
    if (!expectShowAbnormalOnly || !compareByProbeId) {
      return visibleWidgets;
    }
    return visibleWidgets.filter((w) => {
      const meta = probeMeta.get(w.probeIds[0]);
      if (meta?.displayType === "layout_section") return false;
      const compareRow = compareByProbeId.get(w.probeIds[0]);
      return isCompareAbnormal(compareRow?.status);
    });
  }, [visibleWidgets, expectShowAbnormalOnly, compareByProbeId]);

  const filtering = Boolean(expectShowAbnormalOnly && compareByProbeId);
  const renderWidgets = filtering ? displayWidgets : visibleWidgets;

  const gridLayout: Layout[] = useMemo(() => {
    if (filtering) {
      const colW = gridCols >= 12 ? 4 : gridCols >= 6 ? 3 : gridCols;
      const perRow = Math.max(1, Math.floor(gridCols / colW));
      return displayWidgets.map((w, i) => {
        const meta = probeMeta.get(w.probeIds[0]);
        const isSection = meta?.displayType === "layout_section";
        const h = isSection ? 1 : gridLayoutHeight(w);
        return {
          i: w.id,
          x: (i % perRow) * colW,
          y: Math.floor(i / perRow) * h,
          w: colW,
          h,
          static: true,
        };
      });
    }
    return visibleWidgets.map((w) => {
      const meta = probeMeta.get(w.probeIds[0]);
      const isSection = meta?.displayType === "layout_section";
      const storedW =
        w.w >= 2 ? w.w : gridCols >= 12 ? 4 : Math.min(gridCols, 3);
      return {
        i: w.id,
        x: w.x,
        y: w.y,
        w: isSection ? w.w : storedW,
        h: isSection ? 1 : gridLayoutHeight(w),
        minW: isSection ? w.w : 2,
        minH: 1,
        static: w.ui?.pinned || isSection,
      };
    });
  }, [
    filtering,
    displayWidgets,
    visibleWidgets,
    probeMeta,
    gridCols,
  ]);

  const widgetById = useMemo(() => {
    const m = new Map(layout.widgets.map((w) => [w.id, w]));
    return m;
  }, [layout.widgets]);

  const renderResults = useCallback(
    (probeIds: string[]) => {
      const id = probeIds[0];
      const meta = probeMeta.get(id);
      if (meta?.displayType === "group" && meta.memberIds?.length) {
        const lines = meta.memberIds.map((mid) => {
          const item = probeMeta.get(mid)?.item ?? mid;
          const v = values.get(mid);
          const text = v?.ok === false ? (v.error ?? "错误") : (v?.display ?? "…");
          return `${item}: ${text}`;
        });
        return [
          {
            probeId: id,
            ok: true,
            raw: null,
            display: lines.join("\n"),
            at: Date.now(),
          },
        ];
      }
      return probeIds.map(
        (pid) =>
          values.get(pid) ?? {
            probeId: pid,
            ok: true,
            raw: null,
            display: "…",
            at: 0,
          },
      );
    },
    [values, probeMeta],
  );

  const titleFor = (widgetId: string, probeIds: string[]) => {
    const w = widgetById.get(widgetId);
    if (probeIds.length === 1) {
      const meta = probeMeta.get(probeIds[0]);
      return probeBlockTitle(
        probeIds[0],
        meta?.item,
        w?.title,
      );
    }
    return { main: w?.title ?? widgetId };
  };

  const peekSummary = (probeIds: string[]) => {
    const r = values.get(probeIds[0]);
    if (!r) return "…";
    if (!r.ok) return r.supportMessage ?? r.error ?? "无法读取";
    const line = r.display.replace(/\s+/g, " ").slice(0, 80);
    return line || "—";
  };

  const handleGridChange = (next: Layout[]) => {
    if (!onLayoutChange) return;
    const updated = layout.widgets.map((w) => {
      const item = next.find((g) => g.i === w.id);
      if (!item) return w;
      const compact = w.ui?.collapsed || w.ui?.minimized;
      return {
        ...w,
        x: item.x,
        y: item.y,
        w: item.w < 2 ? w.w : item.w,
        h: compact ? w.h : item.h,
      };
    });
    onLayoutChange(updated);
  };

  const toggleUi = (
    widgetId: string,
    key: "collapsed" | "minimized" | "pinned",
  ) => {
    const w = widgetById.get(widgetId);
    if (!w || !onWidgetUiChange) return;
    const cur = w.ui?.[key];
    onWidgetUiChange(widgetId, { [key]: !cur });
  };

  if (expectShowAbnormalOnly && compareByProbeId && displayWidgets.length === 0) {
    return (
      <p className="dashboard-compare-empty">
        无异常项：与所选 JSON 一致（含平台强制项，已计为一致）。
      </p>
    );
  }

  return (
    <GridLayout
      className="layout"
      layout={gridLayout}
      cols={gridCols}
      rowHeight={gridRowHeight}
      width={Math.max(320, Math.floor(width))}
      margin={margin}
      compactType={
        filtering ? null : (layout.grid.compactType ?? "vertical")
      }
      draggableHandle=".widget-shell__drag-handle"
      onLayoutChange={filtering ? undefined : handleGridChange}
    >
      {renderWidgets.map((w) => {
        const meta = probeMeta.get(w.probeIds[0]);
        const titleParts = titleFor(w.id, w.probeIds);
        const primaryProbeId = w.probeIds[0];
        const compareRow = compareByProbeId?.get(primaryProbeId);
        const expectCaption =
          compareRow?.status === "platform_locked"
            ? compareRow.platformNote
            : compareRow && compareRow.status !== "match"
              ? `JSON：${compareRow.expectedDisplay} · 设备：${compareRow.actualDisplay ?? compareRow.actualRaw ?? "未读到"}`
              : undefined;

        if (meta?.displayType === "layout_section") {
          if (hideLayoutSections) return null;
          return (
            <div key={w.id} className="grid-widget grid-widget--section">
              <LayoutSectionBand
                l1={meta.sectionL1 ?? "Network Configuration"}
                title={meta.sectionTitle ?? titleParts.main}
                hint={meta.sectionHint}
              />
            </div>
          );
        }

        const shell = (
          <WidgetShell
            title={titleParts.main}
            titleSub={titleParts.sub}
            oemPath={w.oemPath}
            ui={w.ui}
            verifyPath={meta?.verifyPath}
            expectStatus={compareRow?.status}
            expectCaption={expectCaption}
            showEnSub={showEnSubtitles}
            minimizedSummary={peekSummary(w.probeIds)}
            onToggleCollapse={() => toggleUi(w.id, "collapsed")}
            onToggleMinimize={() => toggleUi(w.id, "minimized")}
            onTogglePin={() => toggleUi(w.id, "pinned")}
            onRemove={() => onRemoveWidget?.(w.id)}
            onTitleRevert={
              onLayoutRevert && !filtering ? onLayoutRevert : undefined
            }
          >
            <ProbeWidgetBody
              meta={meta}
              probeIds={w.probeIds}
              results={renderResults(w.probeIds)}
              deviceSerial={deviceSerial}
              onWriteProbe={onWriteProbe}
              onWriteProbeValue={onWriteProbeValue}
              writingProbeId={writingProbeId}
              readOnly={readOnly}
              compareRow={compareRow}
            />
          </WidgetShell>
        );
        return (
          <div key={w.id} className="grid-widget">
            {shell}
          </div>
        );
      })}
    </GridLayout>
  );
}
