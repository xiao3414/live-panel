import type { ReactNode } from "react";
import type { LayoutWidgetUi } from "../types";

type Props = {
  title: string;
  titleSub?: string;
  oemPath?: string;
  ui?: LayoutWidgetUi;
  verifyPath?: string;
  /** 期望对比着色 */
  expectStatus?: "match" | "mismatch" | "unread" | "platform_locked";
  expectCaption?: string;
  /** 为 true 时在标题下显示英文项名 */
  showEnSub?: boolean;
  children: ReactNode;
  minimizedSummary?: string;
  onToggleCollapse?: () => void;
  onToggleMinimize?: () => void;
  onTogglePin?: () => void;
  onRemove?: () => void;
  /** 标题左键仍为拖动；右键触发回退 */
  onTitleRevert?: () => void;
};

export function WidgetShell({
  title,
  titleSub,
  oemPath,
  ui,
  verifyPath,
  expectStatus,
  expectCaption,
  showEnSub,
  children,
  minimizedSummary,
  onToggleCollapse,
  onToggleMinimize,
  onTogglePin,
  onRemove,
  onTitleRevert,
}: Props) {
  const collapsed = ui?.collapsed;
  const minimized = ui?.minimized;
  const pinned = ui?.pinned;
  const hideBody = collapsed || minimized;

  return (
    <div
      className={`widget-shell ${pinned ? "widget-shell--pinned" : ""} ${minimized ? "widget-shell--minimized" : ""} ${collapsed ? "widget-shell--collapsed" : ""}${expectStatus === "mismatch" ? " widget-shell--expect-mismatch" : ""}${expectStatus === "unread" ? " widget-shell--expect-unread" : ""}${expectStatus === "platform_locked" ? " widget-shell--expect-platform" : ""}${expectStatus === "match" ? " widget-shell--expect-match" : ""}`}
    >
      <div className="widget-shell__head">
        <div className="widget-shell__titleblock">
          {oemPath ? (
            <span className="widget-shell__oem-path">{oemPath}</span>
          ) : null}
          <span
            className="widget-shell__drag-handle widget-shell__title-main"
            title={
              titleSub
                ? `${title}\n${titleSub}${pinned ? "" : "\n左键拖动 · 右键撤回布局"}`
                : pinned
                  ? "已固定位置"
                  : onTitleRevert
                    ? "左键拖动 · 右键撤回上一步布局移动"
                    : "拖动标题移动"
            }
            onContextMenu={(e) => {
              if (!onTitleRevert) return;
              e.preventDefault();
              e.stopPropagation();
              onTitleRevert();
            }}
          >
            {title}
          </span>
          {showEnSub && titleSub ? (
            <span className="widget-shell__title-sub" title={titleSub}>
              {titleSub}
            </span>
          ) : null}
          {expectStatus && expectStatus !== "match" ? (
            <span
              className={`widget-shell__expect-badge widget-shell__expect-badge--${expectStatus}`}
              title={expectCaption}
            >
              {expectStatus === "mismatch"
                ? "与配置不符"
                : expectStatus === "platform_locked"
                  ? "平台强制"
                  : "未读到"}
            </span>
          ) : null}
        </div>
        <div className="widget-shell__tools">
          {verifyPath ? (
            <button
              type="button"
              className="widget-shell__btn widget-shell__btn--info"
              title={`核对路径：${verifyPath}`}
              aria-label="核对路径"
            >
              i
            </button>
          ) : null}
          <button
            type="button"
            className="widget-shell__btn"
            title={collapsed ? "展开" : "折叠收纳"}
            onClick={onToggleCollapse}
          >
            {collapsed ? "▸" : "▾"}
          </button>
          <div className="widget-shell__more">
            <button
              type="button"
              className="widget-shell__btn widget-shell__more-trigger"
              title="更多操作"
              aria-label="更多操作"
            >
              ⋯
            </button>
            <div className="widget-shell__more-panel" role="menu">
              <button
                type="button"
                className="widget-shell__more-item"
                role="menuitem"
                onClick={onToggleMinimize}
              >
                {minimized ? "还原窗口" : "最小化"}
              </button>
              <button
                type="button"
                className={`widget-shell__more-item ${pinned ? "active" : ""}`}
                role="menuitem"
                onClick={onTogglePin}
              >
                {pinned ? "取消固定" : "固定位置"}
              </button>
              <button
                type="button"
                className="widget-shell__more-item widget-shell__more-item--danger"
                role="menuitem"
                onClick={onRemove}
              >
                从面板移除
              </button>
            </div>
          </div>
        </div>
      </div>
      {minimized && minimizedSummary ? (
        <div className="widget-shell__peek">{minimizedSummary}</div>
      ) : null}
      {!hideBody ? (
        <div className="widget-shell__body">{children}</div>
      ) : null}
    </div>
  );
}
