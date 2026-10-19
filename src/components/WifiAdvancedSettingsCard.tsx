import { useCallback, useEffect, useState } from "react";
import { UsdkBridgeHint } from "./UsdkBridgeHint";

type TriState = "no_change" | "enable" | "disable";
type Prefer5 = TriState | "on" | "off" | "no";

type AdvancedRead = {
  platform: string;
  bridgeInstalled: boolean;
  powerSaveMode: string | null;
  roamingThreshold: string | null;
  roamingDifference: string | null;
  wifiScanning: boolean | null;
  countryCode: string | null;
  prefer5GHz: string | null;
  bandSelection: string | null;
  channel24: string | null;
  channel5: string | null;
  channel6: string | null;
  readNotes: string[];
};

type Props = {
  verifyPath?: string;
  embedded?: boolean;
  deviceSerial?: string;
  readOnly?: boolean;
};

const BAND_LABELS: Record<string, string> = {
  "0": "2.4G+5G",
  "1": "2.4G",
  "2": "5G",
  "3": "6G only",
  "4": "2.4G+6G",
  "5": "5G+6G",
  "6": "2.4G+5G+6G",
};

export function WifiAdvancedSettingsCard({
  verifyPath,
  embedded,
  deviceSerial,
  readOnly,
}: Props) {
  const api = window.livePanel;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const [powerSave, setPowerSave] = useState("");
  const [roamTh, setRoamTh] = useState("");
  const [roamDiff, setRoamDiff] = useState("");
  const [wifiScanning, setWifiScanning] = useState<TriState>("no_change");
  const [country, setCountry] = useState("");
  const [prefer5, setPrefer5] = useState<Prefer5>("no_change");
  const [band, setBand] = useState("");
  const [ch24, setCh24] = useState("");
  const [ch5, setCh5] = useState("");
  const [ch6, setCh6] = useState("");

  const applyReadToSummary = (g: AdvancedRead) => {
    setNotes(g.readNotes ?? []);
    const parts = [
      `平台 ${g.platform}`,
      g.bridgeInstalled ? "USDK 桥接已安装" : "无 USDK 桥接",
      g.wifiScanning != null ? `Scanning ${g.wifiScanning ? "开" : "关"}` : null,
      g.countryCode ? `Country ${g.countryCode}` : null,
      g.bandSelection != null
        ? `Band ${BAND_LABELS[g.bandSelection] ?? g.bandSelection}`
        : null,
    ].filter(Boolean);
    setSummary(parts.join(" · "));
  };

  const load = useCallback(
    async (preserveForm = false) => {
      if (typeof api.readWifiAdvancedSettings !== "function") {
        setMsg("请完全退出并重启 LivePanel");
        return;
      }
      setBusy(true);
      try {
        const g = (await api.readWifiAdvancedSettings()) as AdvancedRead;
        if (!preserveForm) {
          setPowerSave(g.powerSaveMode ?? "");
          setRoamTh(g.roamingThreshold ?? "");
          setRoamDiff(g.roamingDifference ?? "");
          setCountry(g.countryCode ?? "");
          setBand(g.bandSelection ?? "");
          setCh24(g.channel24 ?? "");
          setCh5(g.channel5 ?? "");
          setCh6(g.channel6 ?? "");
          setWifiScanning("no_change");
          setPrefer5("no_change");
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
    if (typeof api.applyWifiAdvancedSettings !== "function") return;
    setBusy(true);
    setMsg(null);
    try {
      await api.applyWifiAdvancedSettings({
        powerSaveMode: powerSave.trim() || undefined,
        roamingThreshold: roamTh.trim() || undefined,
        roamingDifference: roamDiff.trim() || undefined,
        wifiScanning,
        countryCode: country.trim() || undefined,
        prefer5GHz: prefer5,
        bandSelection: band.trim() || undefined,
        channel24: ch24.trim() || undefined,
        channel5: ch5.trim() || undefined,
        channel6: ch6.trim() || undefined,
      });
      setMsg("已下发（INI 项需 USDK 桥接 APK）");
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
      {!embedded ? (
        <p className="wifi-form-sub">OEM 2.0 · WiFi Advanced Option</p>
      ) : null}
      {!embedded && summary ? (
        <p className="wifi-form-readonly">设备当前：{summary}</p>
      ) : null}
      {notes.includes("bridge_missing") ? (
        <UsdkBridgeHint compact={embedded} context="漫游/省电/频段 INI" />
      ) : null}
      {notes
        .filter((n) => n !== "bridge_missing")
        .slice(0, embedded ? 1 : notes.length)
        .map((n) => (
          <p key={n} className="probe-card__support warn">
            {n}
          </p>
        ))}

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>漫游 / 省电</legend>
        <label className="wifi-form-field">
          Power Save Mode（INI 0/1/2）
          <input value={powerSave} onChange={(e) => setPowerSave(e.target.value)} />
        </label>
        <div className="wifi-form-grid">
          <label className="wifi-form-field">
            Roaming Threshold
            <input value={roamTh} onChange={(e) => setRoamTh(e.target.value)} />
          </label>
          <label className="wifi-form-field">
            Roaming Difference
            <input value={roamDiff} onChange={(e) => setRoamDiff(e.target.value)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>扫描 / 国家 / 5G</legend>
        <label className="wifi-form-field">
          WiFi Scanning
          <select
            value={wifiScanning}
            onChange={(e) => setWifiScanning(e.target.value as TriState)}
          >
            <option value="no_change">No change</option>
            <option value="enable">Enable</option>
            <option value="disable">Disable</option>
          </select>
        </label>
        <label className="wifi-form-field">
          WiFi Country Code
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="如 CN" />
        </label>
        <label className="wifi-form-field">
          5GHz Priority Mode
          <select
            value={prefer5}
            onChange={(e) => setPrefer5(e.target.value as Prefer5)}
          >
            <option value="no_change">No change</option>
            <option value="on">ON</option>
            <option value="off">OFF</option>
            <option value="no">No</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>频段 / 信道</legend>
        <label className="wifi-form-field">
          Wifi Band Selection（INI 0–6）
          <input value={band} onChange={(e) => setBand(e.target.value)} />
        </label>
        <div className="wifi-form-grid">
          <label className="wifi-form-field">
            2.4GHz Channel
            <input value={ch24} onChange={(e) => setCh24(e.target.value)} />
          </label>
          <label className="wifi-form-field">
            5GHz Channel
            <input value={ch5} onChange={(e) => setCh5(e.target.value)} />
          </label>
          <label className="wifi-form-field">
            6GHz Channel
            <input value={ch6} onChange={(e) => setCh6(e.target.value)} placeholder="写回待确认" />
          </label>
        </div>
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
