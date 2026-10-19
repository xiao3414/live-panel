import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExpectTemplate, CompareRow } from "../expectCompare";
import { compareTemplateToValues, summarizeCompare } from "../expectCompare";
import { OemCompareDiffTable } from "./OemCompareDiffTable";
import type { ProbeMeta, ProbeResult } from "../types";

type CacheItem = {
  fileName: string;
  sourcePath: string;
  importedAt: string;
  stale: boolean;
};

type Props = {
  probeMeta: Map<string, ProbeMeta>;
  values: Map<string, ProbeResult>;
  template: ExpectTemplate | null;
  onTemplateChange: (t: ExpectTemplate | null) => void;
  showAbnormalOnly: boolean;
  onShowAbnormalOnlyChange: (v: boolean) => void;
  showEnSubtitles: boolean;
  onShowEnSubtitlesChange: (v: boolean) => void;
  onAutoLayout?: () => void;
};

const ACTIVE_KEY = "livepanel.activeOemCompareFile.v2";

export function ExpectCompareBar({
  probeMeta,
  values,
  template,
  onTemplateChange,
  showAbnormalOnly,
  onShowAbnormalOnlyChange,
  showEnSubtitles,
  onShowEnSubtitlesChange,
  onAutoLayout,
}: Props) {
  const [catalog, setCatalog] = useState<CacheItem[]>([]);
  const [activeFile, setActiveFile] = useState(
    () => localStorage.getItem(ACTIVE_KEY) ?? "",
  );
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const api = window.livePanel;

  const rows: CompareRow[] = useMemo(() => {
    if (!template) return [];
    return compareTemplateToValues(template, probeMeta, values);
  }, [template, probeMeta, values]);

  const summary = useMemo(() => summarizeCompare(rows), [rows]);

  const refreshCatalog = useCallback(async () => {
    if (typeof api.listOemConfigCache !== "function") return;
    const list = await api.listOemConfigCache();
    setCatalog(list);
  }, [api]);

  const activateFile = useCallback(
    async (fileName: string) => {
      setActiveFile(fileName);
      if (!fileName) {
        onTemplateChange(null);
        localStorage.removeItem(ACTIVE_KEY);
        setStatusNote(null);
        return;
      }
      localStorage.setItem(ACTIVE_KEY, fileName);
      if (typeof api.loadOemConfigCache !== "function") return;
      const hit = await api.loadOemConfigCache(fileName);
      if (!hit) {
        setStatusNote("缓存缺失，请重新添加 JSON");
        onTemplateChange(null);
        return;
      }
      onTemplateChange(hit.template as ExpectTemplate);
      setStatusNote(
        hit.stale ? "源文件已变更，可点「更新源文件」重新解析" : null,
      );
    },
    [api, onTemplateChange],
  );

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (template || !activeFile) return;
    void activateFile(activeFile);
  }, [activeFile, template, activateFile]);

  const onAddJson = useCallback(async () => {
    if (typeof api.pickAndImportOemConfig === "function") {
      const r = await api.pickAndImportOemConfig();
      if (!r) return;
      await refreshCatalog();
      setStatusNote(
        r.fromCache ? `已使用缓存：${r.meta.fileName}` : `已导入：${r.meta.fileName}`,
      );
      await activateFile(r.meta.fileName);
      return;
    }
    alert("请通过 LivePanel 桌面版添加 OEM JSON（需 Electron 缓存 API）");
  }, [api, activateFile, refreshCatalog]);

  const onRefreshSource = useCallback(async () => {
    if (!activeFile || typeof api.refreshOemConfigCache !== "function") return;
    try {
      const r = await api.refreshOemConfigCache(activeFile);
      onTemplateChange(r.template as ExpectTemplate);
      await refreshCatalog();
      setStatusNote(`已更新：${r.meta.fileName}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }, [activeFile, api, onTemplateChange, refreshCatalog]);

  const onRemoveCache = useCallback(async () => {
    if (!activeFile || typeof api.removeOemConfigCache !== "function") return;
    const ok = window.confirm(`从实况面板移除缓存「${activeFile}」？（不删除磁盘上的 OEM 文件）`);
    if (!ok) return;
    await api.removeOemConfigCache(activeFile);
    await refreshCatalog();
    await activateFile("");
  }, [activeFile, api, activateFile, refreshCatalog]);

  const activeMeta = catalog.find((c) => c.fileName === activeFile);
  const mismatchRows = rows.filter((r) => r.status === "mismatch");
  const unreadRows = rows.filter((r) => r.status === "unread");

  return (
    <div className="expect-compare-bar">
      <div className="expect-compare-bar__row">
        <span className="expect-compare-bar__label">OEM 配置对比</span>
        <label className="expect-compare-bar__check" title="悬停中文标题也可看英文">
          <input
            type="checkbox"
            checked={showEnSubtitles}
            onChange={(e) => onShowEnSubtitlesChange(e.target.checked)}
          />
          英文项名
        </label>
        <select
          className="expect-compare-bar__select"
          value={activeFile}
          onChange={(e) => void activateFile(e.target.value)}
          title="已导入的配置保存在实况面板内，切换设备无需重复读文件"
        >
          <option value="">— 不对比 —</option>
          {catalog.map((c) => (
            <option key={c.fileName} value={c.fileName}>
              {c.stale ? "⚠ " : ""}
              {c.fileName}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void onAddJson()}>
          添加 JSON…
        </button>
        {activeFile ? (
          <>
            <button
              type="button"
              className="secondary"
              disabled={!activeMeta?.stale}
              title={
                activeMeta?.stale
                  ? activeMeta.sourcePath
                  : "源文件未变更时无需更新"
              }
              onClick={() => void onRefreshSource()}
            >
              更新源文件
            </button>
            <button
              type="button"
              className="secondary expect-compare-bar__danger"
              onClick={() => void onRemoveCache()}
            >
              移除缓存
            </button>
            <label className="expect-compare-bar__check">
              <input
                type="checkbox"
                checked={showAbnormalOnly}
                onChange={(e) => onShowAbnormalOnlyChange(e.target.checked)}
              />
              仅显示异常
            </label>
            {onAutoLayout ? (
              <button
                type="button"
                className="secondary expect-compare-bar__auto-layout"
                title="按窗口宽度重新排列所有配置块（不修改 JSON 对比结果）"
                onClick={onAutoLayout}
              >
                自动排版
              </button>
            ) : null}
            <span
              className={
                summary.mismatch > 0
                  ? "expect-compare-bar__stat expect-compare-bar__stat--err"
                  : "expect-compare-bar__stat"
              }
            >
              一致 {summary.match}/{summary.total}
              {summary.platformLocked > 0
                ? `（含平台强制 ${summary.platformLocked}）`
                : ""}
              {summary.mismatch > 0 ? ` · 异常 ${summary.mismatch}` : ""}
              {summary.unread > 0 ? ` · 未读到 ${summary.unread}` : ""}
            </span>
          </>
        ) : null}
      </div>
      {statusNote ? (
        <p className="expect-compare-bar__desc">{statusNote}</p>
      ) : activeMeta?.sourcePath ? (
        <p className="expect-compare-bar__desc" title={activeMeta.sourcePath}>
          缓存：{activeMeta.fileName}
          {activeMeta.stale ? " · 源文件已变更" : " · 与源文件同步"}
        </p>
      ) : null}
      {template && (mismatchRows.length > 0 || unreadRows.length > 0) ? (
        <details className="expect-compare-bar__details" open={summary.mismatch > 0}>
          <summary>差异清单（{mismatchRows.length + unreadRows.length}）</summary>
          <OemCompareDiffTable
            rows={[...mismatchRows, ...unreadRows]}
            probeMeta={probeMeta}
          />
        </details>
      ) : null}
    </div>
  );
}
