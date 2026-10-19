import { useEffect, useState } from "react";
import { l1ModuleSummary } from "../navigation/oemProject";
import type { OemL1Node } from "../navigation/oemNavTree";

const COLLAPSE_STORAGE_KEY = "livepanel.configSidebarCollapsed";

function readCollapsed(): boolean {
  try {
    return sessionStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function moduleAbbr(m: OemL1Node): string {
  const map: Record<string, string> = {
    network: "Net",
    system: "Sys",
    application: "App",
    package: "Pkg",
    security: "Sec",
    "data-capture": "DC",
    "device-maintenance": "DM",
    profile: "Prf",
  };
  return map[m.id] ?? m.label.slice(0, 2);
}

type Props = {
  modules: OemL1Node[];
  activeL1Id: string | null;
  onBackProjectHome: () => void;
  onSelectL1: (l1Id: string) => void;
  /** 侧栏展开/收起后（如触发现场面板自动排版） */
  onToggleCollapse?: () => void;
};

/** 进入「配置项」后的侧栏：仅八大模块，可收起为窄栏 */
export function OemConfigModuleSidebar({
  modules,
  activeL1Id,
  onBackProjectHome,
  onSelectL1,
  onToggleCollapse,
}: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      sessionStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <aside
      className={`oem-config-sidebar${collapsed ? " is-collapsed" : ""}`}
      aria-label="配置模块"
    >
      <div className="oem-config-sidebar__top">
        <button
          type="button"
          className="oem-config-sidebar__back"
          onClick={onBackProjectHome}
          title="返回项目首页"
        >
          <span className="oem-config-sidebar__back-icon" aria-hidden>
            ⌂
          </span>
          <span className="oem-config-sidebar__back-text">项目首页</span>
        </button>
        <button
          type="button"
          className="oem-config-sidebar__toggle"
          onClick={() => {
            setCollapsed((c) => !c);
            onToggleCollapse?.();
          }}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "展开配置模块侧栏" : "收起配置模块侧栏"}
          title={collapsed ? "展开侧栏" : "收起侧栏"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      <div className="oem-config-sidebar__section">配置模块</div>
      <nav className="oem-config-sidebar__nav">
        <ul className="oem-config-sidebar__list">
          {modules.map((m) => {
            const active = activeL1Id === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className={`oem-config-sidebar__item${active ? " is-active" : ""}`}
                  onClick={() => onSelectL1(m.id)}
                  title={`${m.label} · ${l1ModuleSummary(m)}`}
                >
                  <span className="oem-config-sidebar__abbr" aria-hidden>
                    {moduleAbbr(m)}
                  </span>
                  <span className="oem-config-sidebar__label">{m.label}</span>
                  <span className="oem-config-sidebar__meta">{m.children.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
