import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  defaultName?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (name: string) => void;
};

export function SchemeSaveDialog({
  open,
  defaultName = "我的面板方案",
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultName]);

  if (!open) return null;

  return (
    <div className="scheme-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="scheme-dialog"
        role="dialog"
        aria-labelledby="scheme-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="scheme-dialog-title">保存面板方案</h3>
        <p className="scheme-dialog__hint">
          将保存当前面板上的块与排版（仅本机、按 WLAN 等作用域分开）。
        </p>
        <label className="scheme-dialog__field">
          方案名称
          <input
            ref={inputRef}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
              if (e.key === "Escape") onCancel();
            }}
          />
        </label>
        <div className="scheme-dialog__actions">
          <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => onConfirm(name.trim())}
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
