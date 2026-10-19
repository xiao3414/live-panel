import { useCallback, useEffect, useState } from "react";
import { UsdkBridgeHint } from "./UsdkBridgeHint";
import { messageFromError } from "../utils/formMessage";

type WhitelistConfigurationAction = "no_change" | "insert" | "clear";

type ReadShape = {
  bridgeInstalled: boolean;
  ssids: string[];
  readNotes: string[];
};

type Props = {
  verifyPath?: string;
  embedded?: boolean;
  deviceSerial?: string;
  readOnly?: boolean;
};

const EMPTY_SLOTS = ["", "", "", "", ""];

export function WifiWhitelistSettingsCard({
  verifyPath,
  embedded,
  deviceSerial,
  readOnly,
}: Props) {
  const api = window.livePanel;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [bridgeInstalled, setBridgeInstalled] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [current, setCurrent] = useState<string[]>([]);
  const [configurationAction, setConfigurationAction] =
    useState<WhitelistConfigurationAction>("no_change");
  const [slots, setSlots] = useState<string[]>(EMPTY_SLOTS);

  const load = useCallback(
    async (preserveForm = false) => {
      if (typeof api.readWifiWhitelistSettings !== "function") {
        setMsg("请完全退出并重启 LivePanel");
        return;
      }
      setBusy(true);
      try {
        const g = (await api.readWifiWhitelistSettings()) as ReadShape;
        setNotes(g.readNotes ?? []);
        setBridgeInstalled(Boolean(g.bridgeInstalled));
        setCurrent(g.ssids ?? []);
        if (!preserveForm) {
          setConfigurationAction("no_change");
        }
        if (!preserveForm) setMsg(null);
      } catch (e) {
        setMsgOk(false);
        setMsg(messageFromError(e));
      } finally {
        setBusy(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void (async () => {
      if (typeof api.ensureDeviceBridge === "function") {
        await api.ensureDeviceBridge();
      }
      await load(false);
    })();
  }, [load, deviceSerial, api]);

  const onApply = async () => {
    if (typeof api.applyWifiWhitelistSettings !== "function") return;
    setBusy(true);
    setMsg(null);
    try {
      await api.applyWifiWhitelistSettings({
        configurationAction,
        ssids: slots,
      });
      setMsgOk(true);
      setMsg("已下发");
      await load(true);
    } catch (e) {
      setMsgOk(false);
      setMsg(messageFromError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`probe-card wifi-form-card ${embedded ? "probe-card--embedded" : ""}`}
    >
      {!bridgeInstalled ? (
        <UsdkBridgeHint compact={embedded} context="WiFi Whitelist" />
      ) : null}
      {notes.length > 0 ? (
        <p className="wifi-form-msg wifi-form-msg--err" role="alert">
          {notes.join(" · ")}
        </p>
      ) : null}

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>设备当前白名单</legend>
        {current.length === 0 ? (
          <p className="wifi-form-readonly wifi-whitelist-empty">未添加项目</p>
        ) : (
          <ul className="wifi-whitelist-current">
            {current.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>Configuration Action</legend>
        <label className="wifi-form-field">
          操作
          <select
            value={configurationAction}
            onChange={(e) =>
              setConfigurationAction(
                e.target.value as WhitelistConfigurationAction,
              )
            }
          >
            <option value="no_change">None</option>
            <option value="insert">Insert WiFi White List</option>
            <option value="clear">Clear Whitelist</option>
          </select>
        </label>
      </fieldset>

      {configurationAction === "insert" ? (
        <fieldset className="wifi-form-section" disabled={busy}>
          <legend>SSID1～SSID5</legend>
          {slots.map((val, i) => (
            <label key={i} className="wifi-form-field">
              SSID{i + 1}
              <input
                value={val}
                onChange={(e) => {
                  const next = [...slots];
                  next[i] = e.target.value;
                  setSlots(next);
                }}
                placeholder="名称"
              />
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="wifi-form-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => void load(false)}
          disabled={busy}
        >
          从设备读取
        </button>
        {!readOnly ? (
          <button
            type="button"
            onClick={onApply}
            disabled={
              busy ||
              !bridgeInstalled ||
              configurationAction === "no_change"
            }
            title={
              !bridgeInstalled
                ? "需安装 device-usdk-bridge 后才能写回"
                : undefined
            }
          >
            写回设备
          </button>
        ) : null}
      </div>
      {msg ? (
        <p
          className={`wifi-form-msg${msgOk ? "" : " wifi-form-msg--err"}`}
          role={msgOk ? "status" : "alert"}
        >
          {msg}
        </p>
      ) : null}
      {verifyPath && !embedded ? (
        <div className="probe-card__hint">核对：{verifyPath}</div>
      ) : null}
    </div>
  );
}
