import type { LayoutCatalogEntry } from "../livePanel.d";

type Props = {
  open: boolean;
  entries: LayoutCatalogEntry[];
  onClose: () => void;
  onAdd: (entry: LayoutCatalogEntry) => void;
};

export function WidgetLibrary({ open, entries, onClose, onAdd }: Props) {
  if (!open) return null;

  const byModule = new Map<string, LayoutCatalogEntry[]>();
  for (const e of entries) {
    const list = byModule.get(e.module) ?? [];
    list.push(e);
    byModule.set(e.module, list);
  }

  return (
    <div className="widget-library-backdrop" onClick={onClose} role="presentation">
      <aside
        className="widget-library"
        onClick={(ev) => ev.stopPropagation()}
        aria-label="模块库"
      >
        <header className="widget-library__head">
          <h2>模块库</h2>
          <p>从库中添加到面板；移除的块会出现在「已收纳」。</p>
          <button type="button" className="secondary" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="widget-library__list">
          {entries.length === 0 ? (
            <p className="widget-library__empty">当前布局已包含库中全部模块。</p>
          ) : (
            [...byModule.entries()].map(([mod, list]) => (
              <section key={mod} className="widget-library__section">
                <h3>{mod}</h3>
                <ul>
                  {list.map((e) => (
                    <li key={`${e.source}-${e.probeId}`}>
                      <span>
                        {e.widget.title ?? e.probeId}
                        {e.source === "stash" ? (
                          <em className="widget-library__tag">已收纳</em>
                        ) : null}
                      </span>
                      <button type="button" onClick={() => onAdd(e)}>
                        添加到面板
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
