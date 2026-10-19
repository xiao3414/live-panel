import { useState } from "react";
import type { PanelScheme } from "../livePanel.d";
import type { OemL2Node, OemL4Node, PanelPreset } from "../navigation/oemNavTree";
import { SchemeSaveDialog } from "./SchemeSaveDialog";

type Props = {
  l2: OemL2Node;
  userSchemes: PanelScheme[];
  canSaveScheme: boolean;
  schemeApiReady: boolean;
  schemeMessage?: string | null;
  schemeSaving?: boolean;
  onOpen: (item: OemL4Node) => void;
  onAddToPanel: (item: OemL4Node) => void;
  onApplyBuiltinPreset: (preset: PanelPreset) => void;
  onSaveCurrentScheme: (name: string) => void;
  onApplyUserScheme: (scheme: PanelScheme) => void;
  onDeleteUserScheme: (schemeId: string) => void;
};

function formatSavedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function OemL4Catalog({
  l2,
  userSchemes,
  canSaveScheme,
  schemeApiReady,
  schemeMessage,
  schemeSaving,
  onOpen,
  onAddToPanel,
  onApplyBuiltinPreset,
  onSaveCurrentScheme,
  onApplyUserScheme,
  onDeleteUserScheme,
}: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const items = l2.l4Items ?? [];
  const presets = l2.panelPresets ?? [];

  return (
    <section className="composer-bottom">
      <div className="composer-bottom__card">
        <header className="composer-bottom__head">
          <h3 className="composer-bottom__title">添加与方案</h3>
          <p className="composer-bottom__desc">
            点配置项名称进入 L4 单项页；右侧图标加入组合面板。上方工具栏可排版与清空。
          </p>
        </header>

        {(presets.length > 0 || userSchemes.length > 0 || schemeApiReady) && (
          <div className="composer-bottom__row">
            {presets.length > 0 ? (
              <div className="composer-bottom__group">
                <span className="composer-bottom__glabel">内置快捷</span>
                <div className="composer-bottom__chips">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="composer-chip"
                      onClick={() => onApplyBuiltinPreset(p)}
                    >
                      {p.label.replace(/^快捷：/, "")}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="composer-bottom__group composer-bottom__group--grow">
              <span className="composer-bottom__glabel">我的方案</span>
              <div className="composer-bottom__scheme-row">
                {userSchemes.map((s) => (
                  <span key={s.id} className="composer-scheme-tag">
                    <button
                      type="button"
                      className="composer-scheme-tag__apply"
                      onClick={() => onApplyUserScheme(s)}
                      title={`${s.widgets.length} 块 · ${formatSavedAt(s.savedAt)}`}
                    >
                      {s.name}
                    </button>
                    <button
                      type="button"
                      className="composer-scheme-tag__del"
                      aria-label={`删除 ${s.name}`}
                      onClick={() => onDeleteUserScheme(s.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className="composer-chip composer-chip--accent"
                  disabled={!canSaveScheme || !schemeApiReady || schemeSaving}
                  onClick={() => setSaveOpen(true)}
                >
                  + 保存当前面板
                </button>
              </div>
            </div>
          </div>
        )}

        {schemeMessage ? (
          <p
            className={`composer-bottom__msg ${schemeMessage.includes("已保存") ? "ok" : ""}`}
          >
            {schemeMessage}
          </p>
        ) : null}

        <ul className="composer-l4-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="composer-l4-list__main"
                onClick={() => onOpen(item)}
              >
                <span className="composer-l4-list__title">{item.title}</span>
                <span className="composer-l4-list__kind">
                  {item.kind === "form" ? "详细配置" : "开关"}
                </span>
              </button>
              <button
                type="button"
                className="composer-l4-list__add"
                title="添加到组合面板"
                aria-label={`添加 ${item.title}`}
                onClick={() => onAddToPanel(item)}
              >
                +
              </button>
            </li>
          ))}
        </ul>
      </div>

      <SchemeSaveDialog
        open={saveOpen}
        busy={schemeSaving}
        onCancel={() => setSaveOpen(false)}
        onConfirm={(name) => {
          onSaveCurrentScheme(name);
          setSaveOpen(false);
        }}
      />
    </section>
  );
}
