import { useCallback, useEffect, useState } from "react";
import { UsdkBridgeHint } from "./UsdkBridgeHint";

type TriState = "no_change" | "enable" | "disable";
type CaptivePortalChoice = "no_change" | "0" | "1" | "2";

const CAPTIVE_PORTAL_LABELS: Record<string, string> = {
  "0": "Disable detection",
  "1": "Pop up reminder",
  "2": "Automatically disconnect hotspot (no auto reconnect)",
};

type Props = {
  verifyPath?: string;
  embedded?: boolean;
  deviceSerial?: string;
  readOnly?: boolean;
};

type ReadShape = {
  bridgeInstalled: boolean;
  captivePortal: string | null;
  networkAvailableNotification: boolean | null;
  networkMonitoredNotification: boolean | null;
  readNotes: string[];
};

export function WifiPreferenceSettingsCard({
  verifyPath,
  embedded,
  deviceSerial,
  readOnly,
}: Props) {
  const api = window.livePanel;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const [summary, setSummary] = useState<string | null>(null);
  const [captivePortal, setCaptivePortal] = useState<CaptivePortalChoice>("no_change");
  const [networkAvailable, setNetworkAvailable] = useState<TriState>("no_change");
  const [networkMonitored, setNetworkMonitored] = useState<TriState>("no_change");

  const applyReadToSummary = (g: ReadShape) => {
    setNotes(g.readNotes ?? []);
    const parts: string[] = [];
    if (g.captivePortal != null) {
      parts.push(
        `Captive Portal ${CAPTIVE_PORTAL_LABELS[g.captivePortal] ?? g.captivePortal}`,
      );
    }
    if (g.networkAvailableNotification != null) {
      parts.push(
        `Available Notification ${g.networkAvailableNotification ? "Enable" : "Disable"}`,
      );
    }
    if (g.networkMonitoredNotification != null) {
      parts.push(
        `Monitored Notification ${g.networkMonitoredNotification ? "Enable" : "Disable"}`,
      );
    }
    setSummary(parts.length ? parts.join(" · ") : null);
  };

  const load = useCallback(
    async (preserveForm = false) => {
      if (typeof api.readWifiPreferenceSettings !== "function") {
        setMsg("请完全退出并重启 LivePanel");
        return;
      }
      setBusy(true);
      try {
        const g = (await api.readWifiPreferenceSettings()) as ReadShape;
        if (!preserveForm) {
          setCaptivePortal("no_change");
          setNetworkAvailable("no_change");
          setNetworkMonitored("no_change");
        }
        applyReadToSummary(g);
        if (!preserveForm) setMsg(null);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void load();
  }, [load, deviceSerial]);

  const onApply = async () => {
    if (typeof api.applyWifiPreferenceSettings !== "function") return;
    setBusy(true);
    setMsg(null);
    try {
      await api.applyWifiPreferenceSettings({
        captivePortal,
        networkAvailableNotification: networkAvailable,
        networkMonitoredNotification: networkMonitored,
      });
      setMsg("已下发");
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`probe-card wifi-form-card ${embedded ? "probe-card--embedded" : ""}`}
    >
      {!embedded && summary ? (
        <p className="wifi-form-readonly">设备当前：{summary}</p>
      ) : null}
      {notes.some((n) => n.includes("USDK") || n.includes("桥接")) ? (
        <UsdkBridgeHint compact={embedded} context="Captive Portal" />
      ) : null}

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>Captive Portal</legend>
        <label className="wifi-form-field">
          模式（OEM 2.0）
          <select
            value={captivePortal}
            onChange={(e) =>
              setCaptivePortal(e.target.value as CaptivePortalChoice)
            }
          >
            <option value="no_change">No change</option>
            <option value="0">{CAPTIVE_PORTAL_LABELS["0"]}</option>
            <option value="1">{CAPTIVE_PORTAL_LABELS["1"]}</option>
            <option value="2">{CAPTIVE_PORTAL_LABELS["2"]}</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>通知</legend>
        <label className="wifi-form-field">
          Network Available Notification
          <select
            value={networkAvailable}
            onChange={(e) => setNetworkAvailable(e.target.value as TriState)}
          >
            <option value="no_change">No change</option>
            <option value="enable">Enable</option>
            <option value="disable">Disable</option>
          </select>
        </label>
        <label className="wifi-form-field">
          Network Monitored Notification
          <select
            value={networkMonitored}
            onChange={(e) => setNetworkMonitored(e.target.value as TriState)}
          >
            <option value="no_change">No change</option>
            <option value="enable">Enable</option>
            <option value="disable">Disable</option>
          </select>
        </label>
      </fieldset>

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
          <button type="button" onClick={onApply} disabled={busy}>
            写回设备
          </button>
        ) : null}
      </div>
      {msg ? <p className="wifi-form-msg">{msg}</p> : null}
      {verifyPath && !embedded ? (
        <div className="probe-card__hint">核对：{verifyPath}</div>
      ) : null}
    </div>
  );
}
