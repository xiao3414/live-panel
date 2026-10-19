import { useCallback, useState } from "react";

export type ModuleReadRow = {
  probeId: string;
  item: string;
  module: string;
  kind: "probe" | "form";
  result: {
    ok: boolean;
    display: string;
    error?: string;
  };
};

export type ModuleReadSummary = {
  l1: string;
  catalogPlaceholders: number;
  readableProbeCount: number;
  formCount: number;
  rows: ModuleReadRow[];
  readAt: number;
};

type Props = {
  l1Label: string;
  deviceSerial?: string;
  readOnly?: boolean;
};

export function ModuleReadPanel({ l1Label, deviceSerial, readOnly }: Props) {
  const api = window.livePanel;
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ModuleReadSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onRead = useCallback(async () => {
    if (typeof api.readModuleByL1 !== "function") {
      setErr("请完全退出并重启 LivePanel（需加载模块读取接口）");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const s = (await api.readModuleByL1(l1Label)) as ModuleReadSummary;
      setSummary(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [api, l1Label]);

  const totalReadable =
    (summary?.readableProbeCount ?? 0) + (summary?.formCount ?? 0);

  return (
    <section className="module-read-panel">
      <div className="module-read-panel__head">
        <div>
          <strong>模块读取</strong>
          <span className="module-read-panel__sub">
            {l1Label}
            {readOnly ? " · 当前为只读模式（写回已暂停）" : ""}
          </span>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={busy || !deviceSerial}
          onClick={() => void onRead()}
          title={deviceSerial ? undefined : "请先选择设备"}
        >
          {busy ? "读取中…" : "读取本模块"}
        </button>
      </div>
      {err ? (
        <p className="wifi-form-msg wifi-form-msg--err" role="alert">
          {err}
        </p>
      ) : null}
      {summary ? (
        <>
          <p className="module-read-panel__stats">
            可读探针 {summary.readableProbeCount} · 表单摘要 {summary.formCount}
            · 框架占位 catalog {summary.catalogPlaceholders} 项（待逐条接 ADB/USDK）
          </p>
          {totalReadable === 0 ? (
            <p className="module-read-panel__empty">
              本模块尚无已接线的直读探针；Network 等子域请进入 WLAN 组合面板查看单项。
            </p>
          ) : (
            <div className="module-read-panel__table-wrap">
              <table className="module-read-table">
                <thead>
                  <tr>
                    <th>配置项</th>
                    <th>模块路径</th>
                    <th>设备当前</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((row) => (
                    <tr key={row.probeId} className={row.result.ok ? "" : "module-read-table__err"}>
                      <td>
                        {row.item}
                        {row.kind === "form" ? (
                          <span className="module-read-table__tag">表单</span>
                        ) : null}
                      </td>
                      <td className="module-read-table__path">{row.module}</td>
                      <td>{row.result.display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p className="module-read-panel__hint">
          点击「读取本模块」批量拉取当前 L1 下已注册的 ADB/Settings 探针与表单摘要（不触发写回）。
        </p>
      )}
    </section>
  );
}
