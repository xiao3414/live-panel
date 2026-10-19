type Props = {
  panelCount: number;
  onOpenLibrary: () => void;
  onAutoLayout: () => void;
  onRestoreDefault: () => void;
  onClearPanel: () => void;
};

export function PanelComposerToolbar({
  panelCount,
  onOpenLibrary,
  onAutoLayout,
  onRestoreDefault,
  onClearPanel,
}: Props) {
  return (
    <div className="panel-composer-toolbar">
      <div className="panel-composer-toolbar__stat">
        <span className="panel-composer-toolbar__label">组合面板</span>
        <span className="panel-composer-toolbar__count">{panelCount} 块</span>
      </div>
      <div className="panel-composer-toolbar__actions" role="toolbar" aria-label="面板操作">
        <button type="button" className="secondary" onClick={onOpenLibrary}>
          模块库
        </button>
        <button type="button" className="secondary" onClick={onAutoLayout}>
          自动排版
        </button>
        <button type="button" className="secondary" onClick={onRestoreDefault}>
          还原默认
        </button>
        <button
          type="button"
          className="secondary panel-composer-toolbar__danger"
          disabled={panelCount === 0}
          onClick={onClearPanel}
        >
          清空面板
        </button>
      </div>
    </div>
  );
}
