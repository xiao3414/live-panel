import { useCallback, useEffect, useState } from "react";
import { messageFromError } from "../utils/formMessage";

type WifiSecurity = "open" | "owe" | "wpa2" | "wpa3" | "wep";
type TriState = "no_change" | "enable" | "disable";
type WlanAction =
  | "no_change"
  | "set_profile"
  | "remove_profile"
  | "remove_all_profiles"
  | "delete_specific";
type IpAssignment = "no_change" | "dhcp" | "static" | "unknown";
type ProxyMode = "no_change" | "none" | "pac" | "static" | "unknown";
type MacRandom = "no_change" | "allow" | "disallow";

type GeneralSettings = {
  wifiEnabled: boolean | null;
  ssid: string | null;
  security: WifiSecurity | null;
  securityLabel: string;
  hidden: boolean | null;
  passwordNote: string;
  ipAssignment: IpAssignment;
  staticIp: string | null;
  prefixLength: string | null;
  gateway: string | null;
  dns1: string | null;
  dns2: string | null;
  proxyMode: ProxyMode;
  proxyPacUrl: string | null;
  proxyHost: string | null;
  proxyPort: string | null;
  proxyExclusiveList: string | null;
  wifiRandomMac: MacRandom | null;
  networkId: string | null;
};

type Props = {
  title?: string;
  verifyPath?: string;
  embedded?: boolean;
  /** 换机后触发重新读取 */
  deviceSerial?: string;
  readOnly?: boolean;
};

export function WifiNetworkCard({
  title,
  verifyPath,
  embedded,
  deviceSerial,
  readOnly,
}: Props) {
  const api = window.livePanel;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);

  const [wifiState, setWifiState] = useState<TriState>("no_change");
  const [wlanAction, setWlanAction] = useState<WlanAction>("no_change");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState<WifiSecurity | "no_change">(
    "no_change",
  );
  const [hidden, setHidden] = useState<TriState>("no_change");
  const [ipAssignment, setIpAssignment] = useState<IpAssignment>("no_change");
  const [staticIp, setStaticIp] = useState("");
  const [prefixLength, setPrefixLength] = useState("");
  const [gateway, setGateway] = useState("");
  const [dns1, setDns1] = useState("");
  const [dns2, setDns2] = useState("");
  const [proxyMode, setProxyMode] = useState<ProxyMode>("no_change");
  const [proxyPacUrl, setProxyPacUrl] = useState("");
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [proxyExclusiveList, setProxyExclusiveList] = useState("");
  const [wifiRandomMac, setWifiRandomMac] = useState<MacRandom>("no_change");
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [readSummary, setReadSummary] = useState<string | null>(null);

  const applyReadToSummary = (g: GeneralSettings) => {
    setNetworkId(g.networkId);
    const parts = [
      g.wifiEnabled != null ? (g.wifiEnabled ? "Wi‑Fi 开" : "Wi‑Fi 关") : null,
      g.ssid ? `SSID ${g.ssid}` : null,
      g.securityLabel !== "—" ? g.securityLabel : null,
      g.ipAssignment !== "unknown" ? g.ipAssignment.toUpperCase() : null,
      g.wifiRandomMac ? `MAC ${g.wifiRandomMac}` : null,
    ].filter(Boolean);
    setReadSummary(parts.length ? parts.join(" · ") : null);
  };

  /** @param preserveForm 写回成功后为 true：只刷新摘要，不清空/覆盖输入框 */
  const load = useCallback(
    async (preserveForm = false) => {
      if (typeof api.readWifiGeneralSettings !== "function") {
        setMsg("请完全退出并重启 LivePanel（需加载 WiFi General Settings 接口）");
        return;
      }
      setBusy(true);
      try {
        const g = (await api.readWifiGeneralSettings()) as GeneralSettings;
        if (!preserveForm) {
          setWifiState("no_change");
          setWlanAction("no_change");
          setHidden("no_change");
          setIpAssignment("no_change");
          setProxyMode("no_change");
          setWifiRandomMac("no_change");
          setSecurity("no_change");
          if (g.ssid) setSsid(g.ssid);
          setStaticIp(g.staticIp ?? "");
          setPrefixLength(g.prefixLength ?? "");
          setGateway(g.gateway ?? "");
          setDns1(g.dns1 ?? "");
          setDns2(g.dns2 ?? "");
          setProxyPacUrl(g.proxyPacUrl ?? "");
          setProxyHost(g.proxyHost ?? "");
          setProxyPort(g.proxyPort ?? "");
          setProxyExclusiveList(g.proxyExclusiveList ?? "");
        }
        applyReadToSummary(g);
        setMsgOk(true);
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
    void load();
  }, [load, deviceSerial]);

  const onApply = async () => {
    if (typeof api.applyWifiGeneralSettings !== "function") {
      setMsg("请完全退出并重启 LivePanel");
      return;
    }
    if (
      wlanAction === "remove_all_profiles" &&
      !window.confirm("将删除设备上全部已保存 Wi‑Fi，确定？")
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.applyWifiGeneralSettings({
        wifiState,
        wlanAction,
        ssid: ssid.trim() || undefined,
        password: password || undefined,
        security,
        hidden,
        ipAssignment:
          ipAssignment === "no_change" ? undefined : ipAssignment,
        staticIp: staticIp.trim() || undefined,
        prefixLength: prefixLength.trim() || undefined,
        gateway: gateway.trim() || undefined,
        dns1: dns1.trim() || undefined,
        dns2: dns2.trim() || undefined,
        proxyMode: proxyMode === "no_change" ? undefined : proxyMode,
        proxyPacUrl: proxyPacUrl.trim() || undefined,
        proxyHost: proxyHost.trim() || undefined,
        proxyPort: proxyPort.trim() || undefined,
        proxyExclusiveList: proxyExclusiveList.trim() || undefined,
        wifiRandomMac,
      });
      setMsgOk(true);
      setMsg("已下发到设备");
      await load(true);
    } catch (e) {
      setMsgOk(false);
      setMsg(messageFromError(e));
    } finally {
      setBusy(false);
    }
  };

  const needsConnect = Boolean(
    wlanAction === "set_profile" &&
      ssid.trim() &&
      security !== "open" &&
      !password.trim(),
  );

  return (
    <div
      className={`probe-card wifi-form-card ${embedded ? "probe-card--embedded" : ""}`}
    >
      {!embedded && title ? (
        <div className="probe-card__title">{title}</div>
      ) : null}
      {!embedded ? (
        <p className="wifi-form-sub">
          OEM 2.0 · WiFi General Settings（WiFi Networks）
          {networkId != null ? ` · 已保存 networkId=${networkId}` : ""}
        </p>
      ) : null}
      {!embedded && readSummary ? (
        <p className="wifi-form-readonly">设备当前：{readSummary}</p>
      ) : null}

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>开关与动作</legend>
        <label className="wifi-form-field">
          WiFi State
          <select
            value={wifiState}
            onChange={(e) => setWifiState(e.target.value as TriState)}
          >
            <option value="no_change">No change</option>
            <option value="enable">Enable</option>
            <option value="disable">Disable</option>
          </select>
        </label>
        <label className="wifi-form-field">
          WiFi Action
          <select
            value={wlanAction}
            onChange={(e) => setWlanAction(e.target.value as WlanAction)}
          >
            <option value="no_change">No change</option>
            <option value="set_profile">Set Profile</option>
            <option value="remove_profile">Remove Profile</option>
            <option value="remove_all_profiles">Remove All Profiles</option>
            <option value="delete_specific">Delete specific WiFi profile</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>网络</legend>
        <label className="wifi-form-field">
          SSID
          <input value={ssid} onChange={(e) => setSsid(e.target.value)} />
        </label>
        <label className="wifi-form-field">
          Password
          <input
            type="password"
            value={password}
            placeholder="设备不可读；Set Profile 时填写"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="wifi-form-field">
          Security Mode
          <select
            value={security}
            onChange={(e) =>
              setSecurity(e.target.value as WifiSecurity | "no_change")
            }
          >
            <option value="no_change">No change</option>
            <option value="wpa2">WPA/WPA2 Personal</option>
            <option value="wpa3">WPA3 Personal</option>
            <option value="wep">WEP</option>
            <option value="open">Open</option>
          </select>
        </label>
        <label className="wifi-form-field">
          Hidden SSID
          <select
            value={hidden}
            onChange={(e) => setHidden(e.target.value as TriState)}
          >
            <option value="no_change">No change</option>
            <option value="enable">Enable</option>
            <option value="disable">Disable</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>IP</legend>
        <label className="wifi-form-field">
          IP Assignment
          <select
            value={ipAssignment}
            onChange={(e) => setIpAssignment(e.target.value as IpAssignment)}
          >
            <option value="no_change">No change</option>
            <option value="dhcp">DHCP</option>
            <option value="static">Static IP</option>
          </select>
        </label>
        <div className="wifi-form-grid">
          <label className="wifi-form-field">
            Static IP Address
            <input value={staticIp} onChange={(e) => setStaticIp(e.target.value)} />
          </label>
          <label className="wifi-form-field">
            Prefix Length
            <input
              value={prefixLength}
              onChange={(e) => setPrefixLength(e.target.value)}
            />
          </label>
          <label className="wifi-form-field">
            Gateway
            <input value={gateway} onChange={(e) => setGateway(e.target.value)} />
          </label>
          <label className="wifi-form-field">
            DNS Server 1
            <input value={dns1} onChange={(e) => setDns1(e.target.value)} />
          </label>
          <label className="wifi-form-field">
            DNS Server 2
            <input value={dns2} onChange={(e) => setDns2(e.target.value)} />
          </label>
        </div>
        {!embedded ? (
          <p className="wifi-form-hint">
            当前连接 IP/DNS 可从设备读取；Static IP 写回需 OEMConfig（ADB 暂不支持）。
          </p>
        ) : null}
      </fieldset>

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>代理</legend>
        <label className="wifi-form-field">
          Proxy Mode
          <select
            value={proxyMode}
            onChange={(e) => setProxyMode(e.target.value as ProxyMode)}
          >
            <option value="no_change">No change</option>
            <option value="none">None</option>
            <option value="pac">PAC</option>
            <option value="static">STATIC</option>
          </select>
        </label>
        <label className="wifi-form-field">
          PAC file URL
          <input
            value={proxyPacUrl}
            onChange={(e) => setProxyPacUrl(e.target.value)}
          />
        </label>
        <div className="wifi-form-grid">
          <label className="wifi-form-field">
            Host URL
            <input value={proxyHost} onChange={(e) => setProxyHost(e.target.value)} />
          </label>
          <label className="wifi-form-field">
            Port
            <input value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} />
          </label>
        </div>
        <label className="wifi-form-field">
          Exclusive List
          <input
            value={proxyExclusiveList}
            onChange={(e) => setProxyExclusiveList(e.target.value)}
            placeholder="框架字段；设备侧暂无 ADB 读回"
          />
        </label>
      </fieldset>

      <fieldset className="wifi-form-section" disabled={busy}>
        <legend>隐私</legend>
        <label className="wifi-form-field">
          WiFi Random MAC Address
          <select
            value={wifiRandomMac}
            onChange={(e) => setWifiRandomMac(e.target.value as MacRandom)}
          >
            <option value="no_change">No change</option>
            <option value="allow">Allow</option>
            <option value="disallow">Disallow</option>
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
          <button
            type="button"
            onClick={onApply}
            disabled={busy || needsConnect}
            title={needsConnect ? "Set Profile 需填写 Password" : undefined}
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
