import { useEffect, useMemo, useState } from "react";
import type { CompareRow } from "../expectCompare";
import { messageFromError } from "../utils/formMessage";
import type { ProbeMeta, ProbeResult } from "../types";

type TriState = "no_change" | "enable" | "disable";
type IpMode = "no_change" | "DHCP" | "Static";

type Props = {
  meta: ProbeMeta;
  memberIds: string[];
  probeMeta: Map<string, ProbeMeta>;
  values: Map<string, ProbeResult>;
  compareByProbeId?: Map<string, CompareRow>;
  deviceSerial?: string;
  readOnly?: boolean;
};

function rawOf(values: Map<string, ProbeResult>, id: string): string {
  return values.get(id)?.raw?.trim() ?? "";
}

function FieldLabel({
  zh,
  en,
  compare,
  unsupportedNote,
}: {
  zh: string;
  en?: string;
  compare?: CompareRow;
  unsupportedNote?: string;
}) {
  return (
    <span className="docking-form__label-wrap">
      <span className="scan-module-form__label-main">{zh}</span>
      {en ? <span className="scan-module-form__label-sub">{en}</span> : null}
      {unsupportedNote ? (
        <span className="docking-form__exempt">{unsupportedNote}</span>
      ) : null}
      {!unsupportedNote && compare?.status === "mismatch" ? (
        <span className="docking-form__mismatch">
          JSON {compare.expectedDisplay} ≠ 设备 {compare.actualDisplay}
        </span>
      ) : null}
      {!unsupportedNote && compare?.status === "platform_locked" ? (
        <span className="docking-form__exempt">
          {compare.platformNote ?? "机型豁免"}
        </span>
      ) : null}
    </span>
  );
}

function UnsupportedSelect({ note }: { note: string }) {
  return (
    <select value="unsupported" disabled aria-label={note}>
      <option value="unsupported">本机不支持</option>
    </select>
  );
}

export function DockingStationFormCard({
  meta,
  memberIds,
  probeMeta,
  values,
  compareByProbeId,
  deviceSerial,
  readOnly,
}: Props) {
  const api = window.livePanel;
  const has = (id: string) => memberIds.includes(id);

  const backUnsupported =
    values.get("dock.back_host")?.supportStatus === "unsupported";
  const bottomUnsupported =
    values.get("dock.bottom_host")?.supportStatus === "unsupported";

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);

  const [bottomHost, setBottomHost] = useState<TriState>("no_change");
  const [backHost, setBackHost] = useState<TriState>("no_change");
  const [ethernet, setEthernet] = useState<TriState>("no_change");
  const [ipMode, setIpMode] = useState<IpMode>("no_change");
  const [ipAddress, setIpAddress] = useState("");
  const [gateway, setGateway] = useState("");
  const [netmask, setNetmask] = useState("");
  const [dns1, setDns1] = useState("");
  const [dns2, setDns2] = useState("");
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [proxyBypass, setProxyBypass] = useState("");
  const [proxyRestore, setProxyRestore] = useState<TriState>("no_change");

  const readStamp = useMemo(() => {
    return memberIds
      .map((id) => {
        const r = values.get(id);
        return `${id}:${r?.raw ?? ""}:${r?.at ?? 0}:${r?.supportStatus ?? ""}`;
      })
      .join("|");
  }, [memberIds, values]);

  const deviceHint = useMemo(() => {
    const parts: string[] = [];
    if (has("dock.bottom_host") && !bottomUnsupported) {
      const r = rawOf(values, "dock.bottom_host");
      if (r === "1" || r === "0") {
        parts.push(`底部 Host ${r === "1" ? "开" : "关"}`);
      }
    }
    if (has("dock.ethernet")) {
      const r = rawOf(values, "dock.ethernet");
      if (r === "1" || r === "0") {
        parts.push(`以太网 ${r === "1" ? "开" : "关"}`);
      }
    }
    const ip = rawOf(values, "dock.eth_ip");
    if (ip) parts.push(ip);
    return parts.length ? parts.join(" · ") : null;
  }, [values, memberIds, bottomUnsupported]);

  const fillFromReads = (resetActions: boolean) => {
    if (resetActions) {
      setBottomHost("no_change");
      setBackHost("no_change");
      setEthernet("no_change");
      setProxyRestore("no_change");
      // 有 JSON 不符时，下拉预填期望值，方便直接写回
      const ipCmp = compareByProbeId?.get("dock.eth_ip_mode");
      if (ipCmp?.status === "mismatch") {
        const exp = (ipCmp.expectedRaw || ipCmp.expectedDisplay || "").trim();
        setIpMode(/static/i.test(exp) ? "Static" : /dhcp/i.test(exp) ? "DHCP" : "no_change");
      } else {
        setIpMode("no_change");
      }
    }
    setIpAddress(rawOf(values, "dock.eth_ip"));
    setGateway(rawOf(values, "dock.eth_gateway"));
    setNetmask(rawOf(values, "dock.eth_netmask"));
    setDns1(rawOf(values, "dock.eth_dns1"));
    setDns2(rawOf(values, "dock.eth_dns2"));
    setProxyHost(rawOf(values, "dock.eth_proxy_host"));
    setProxyPort(rawOf(values, "dock.eth_proxy_port"));
    setProxyBypass(rawOf(values, "dock.eth_proxy_bypass"));
  };

  useEffect(() => {
    if (busy) return;
    fillFromReads(true);
    setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceSerial, readStamp]);

  const onApply = async () => {
    if (typeof api.applyDockingSettings !== "function") {
      setMsgOk(false);
      setMsg("请完全退出并重启 LivePanel（需加载 Docking 写回接口）");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const changed = (formVal: string, probeId: string) => {
        const t = formVal.trim();
        if (!t) return undefined;
        if (t === rawOf(values, probeId)) return undefined;
        return t;
      };
      const ipTouched =
        ipMode !== "no_change" ||
        Boolean(changed(ipAddress, "dock.eth_ip")) ||
        Boolean(changed(gateway, "dock.eth_gateway")) ||
        Boolean(changed(netmask, "dock.eth_netmask")) ||
        Boolean(changed(dns1, "dock.eth_dns1")) ||
        Boolean(changed(dns2, "dock.eth_dns2"));
      const proxyTouched =
        Boolean(changed(proxyHost, "dock.eth_proxy_host")) ||
        Boolean(changed(proxyPort, "dock.eth_proxy_port")) ||
        Boolean(changed(proxyBypass, "dock.eth_proxy_bypass"));
      await api.applyDockingSettings({
        bottomHost: bottomUnsupported ? "no_change" : bottomHost,
        backHost: backUnsupported ? "no_change" : backHost,
        ethernet,
        ipMode: ipTouched ? (ipMode === "no_change" ? undefined : ipMode) : "no_change",
        ipAddress: ipTouched
          ? ipAddress.trim() || undefined
          : undefined,
        gateway: ipTouched ? gateway.trim() || undefined : undefined,
        netmask: ipTouched ? netmask.trim() || undefined : undefined,
        dns1: ipTouched ? dns1.trim() || undefined : undefined,
        dns2: ipTouched ? dns2.trim() || undefined : undefined,
        proxyHost: proxyTouched
          ? proxyHost.trim() || undefined
          : undefined,
        proxyPort: proxyTouched
          ? proxyPort.trim() || undefined
          : undefined,
        proxyBypass: proxyTouched
          ? proxyBypass.trim() || undefined
          : undefined,
        proxyRestore,
      });
      setMsgOk(true);
      setMsg("已下发到设备；请点「立即刷新」核对实况");
      setBottomHost("no_change");
      setBackHost("no_change");
      setEthernet("no_change");
      setIpMode("no_change");
      setProxyRestore("no_change");
    } catch (e) {
      setMsgOk(false);
      setMsg(messageFromError(e));
    } finally {
      setBusy(false);
    }
  };

  const itemZh = (id: string, fallback: string) =>
    probeMeta.get(id)?.itemZh ?? fallback;
  const itemEn = (id: string) => probeMeta.get(id)?.item;

  return (
    <div className="probe-card wifi-form-card docking-station-form">
      {deviceHint ? (
        <p className="wifi-form-readonly">设备当前：{deviceHint}</p>
      ) : null}

      <fieldset className="wifi-form-section" disabled={busy || readOnly}>
        <legend>主机模式</legend>
        {has("dock.bottom_host") ? (
          <label className="wifi-form-field">
            <FieldLabel
              zh={itemZh("dock.bottom_host", "底部主机模式")}
              en={itemEn("dock.bottom_host")}
              compare={compareByProbeId?.get("dock.bottom_host")}
              unsupportedNote={
                bottomUnsupported
                  ? values.get("dock.bottom_host")?.supportMessage ??
                    "本机不支持"
                  : undefined
              }
            />
            {bottomUnsupported ? (
              <UnsupportedSelect
                note={
                  values.get("dock.bottom_host")?.supportMessage ??
                  "本机不支持"
                }
              />
            ) : (
              <select
                value={bottomHost}
                onChange={(e) => setBottomHost(e.target.value as TriState)}
              >
                <option value="no_change">No change</option>
                <option value="enable">Enable</option>
                <option value="disable">Disable</option>
              </select>
            )}
          </label>
        ) : null}
        {has("dock.back_host") ? (
          <label className="wifi-form-field">
            <FieldLabel
              zh={itemZh("dock.back_host", "背部主机模式")}
              en={itemEn("dock.back_host")}
              compare={compareByProbeId?.get("dock.back_host")}
              unsupportedNote={
                backUnsupported
                  ? values.get("dock.back_host")?.supportMessage ??
                    "本机不支持（仅底部 Host）"
                  : undefined
              }
            />
            {backUnsupported ? (
              <UnsupportedSelect
                note={
                  values.get("dock.back_host")?.supportMessage ??
                  "本机不支持（仅底部 Host）"
                }
              />
            ) : (
              <select
                value={backHost}
                onChange={(e) => setBackHost(e.target.value as TriState)}
              >
                <option value="no_change">No change</option>
                <option value="enable">Enable</option>
                <option value="disable">Disable</option>
              </select>
            )}
          </label>
        ) : null}
        {has("dock.ethernet") ? (
          <label className="wifi-form-field">
            <FieldLabel
              zh={itemZh("dock.ethernet", "以太网")}
              en={itemEn("dock.ethernet")}
              compare={compareByProbeId?.get("dock.ethernet")}
            />
            <select
              value={ethernet}
              onChange={(e) => setEthernet(e.target.value as TriState)}
            >
              <option value="no_change">No change</option>
              <option value="enable">Enable</option>
              <option value="disable">Disable</option>
            </select>
          </label>
        ) : null}
      </fieldset>

      <fieldset className="wifi-form-section" disabled={busy || readOnly}>
        <legend>以太网 IP</legend>
        {has("dock.eth_ip_mode") ? (
          <label className="wifi-form-field">
            <FieldLabel
              zh={itemZh("dock.eth_ip_mode", "IP 分配方式")}
              en={itemEn("dock.eth_ip_mode")}
              compare={compareByProbeId?.get("dock.eth_ip_mode")}
            />
            <select
              value={ipMode}
              onChange={(e) => setIpMode(e.target.value as IpMode)}
            >
              <option value="no_change">No change</option>
              <option value="DHCP">DHCP</option>
              <option value="Static">Static</option>
            </select>
          </label>
        ) : null}
        {rawOf(values, "dock.eth_ip_mode") === "DHCP" || ipMode === "DHCP" ? (
          <p className="wifi-form-hint">
            当前为 DHCP：下方地址多为上次静态残留（系统设置里也会灰显），写回 Static
            时才会生效。
          </p>
        ) : null}
        <div className="wifi-form-grid">
          {has("dock.eth_ip") ? (
            <label className="wifi-form-field">
              <FieldLabel
                zh={itemZh("dock.eth_ip", "IP 地址")}
                en={itemEn("dock.eth_ip")}
                compare={compareByProbeId?.get("dock.eth_ip")}
              />
              <input
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
              />
            </label>
          ) : null}
          {has("dock.eth_gateway") ? (
            <label className="wifi-form-field">
              <FieldLabel
                zh={itemZh("dock.eth_gateway", "网关地址")}
                en={itemEn("dock.eth_gateway")}
                compare={compareByProbeId?.get("dock.eth_gateway")}
              />
              <input
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
              />
            </label>
          ) : null}
          {has("dock.eth_netmask") ? (
            <label className="wifi-form-field">
              <FieldLabel
                zh={itemZh("dock.eth_netmask", "子网掩码")}
                en={itemEn("dock.eth_netmask")}
                compare={compareByProbeId?.get("dock.eth_netmask")}
              />
              <input
                value={netmask}
                onChange={(e) => setNetmask(e.target.value)}
              />
            </label>
          ) : null}
          {has("dock.eth_dns1") ? (
            <label className="wifi-form-field">
              <FieldLabel
                zh={itemZh("dock.eth_dns1", "DNS 地址 1")}
                en={itemEn("dock.eth_dns1")}
                compare={compareByProbeId?.get("dock.eth_dns1")}
              />
              <input value={dns1} onChange={(e) => setDns1(e.target.value)} />
            </label>
          ) : null}
          {has("dock.eth_dns2") ? (
            <label className="wifi-form-field">
              <FieldLabel
                zh={itemZh("dock.eth_dns2", "DNS 地址 2")}
                en={itemEn("dock.eth_dns2")}
                compare={compareByProbeId?.get("dock.eth_dns2")}
              />
              <input value={dns2} onChange={(e) => setDns2(e.target.value)} />
            </label>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="wifi-form-section" disabled={busy || readOnly}>
        <legend>以太网代理</legend>
        {has("dock.eth_proxy_host") ? (
          <label className="wifi-form-field">
            <FieldLabel
              zh={itemZh("dock.eth_proxy_host", "代理主机名")}
              en={itemEn("dock.eth_proxy_host")}
              compare={compareByProbeId?.get("dock.eth_proxy_host")}
            />
            <input
              value={proxyHost}
              onChange={(e) => setProxyHost(e.target.value)}
            />
          </label>
        ) : null}
        <div className="wifi-form-grid">
          {has("dock.eth_proxy_port") ? (
            <label className="wifi-form-field">
              <FieldLabel
                zh={itemZh("dock.eth_proxy_port", "代理端口")}
                en={itemEn("dock.eth_proxy_port")}
                compare={compareByProbeId?.get("dock.eth_proxy_port")}
              />
              <input
                value={proxyPort}
                onChange={(e) => setProxyPort(e.target.value)}
              />
            </label>
          ) : null}
          {has("dock.eth_proxy_bypass") ? (
            <label className="wifi-form-field">
              <FieldLabel
                zh={itemZh("dock.eth_proxy_bypass", "代理旁路")}
                en={itemEn("dock.eth_proxy_bypass")}
                compare={compareByProbeId?.get("dock.eth_proxy_bypass")}
              />
              <input
                value={proxyBypass}
                onChange={(e) => setProxyBypass(e.target.value)}
              />
            </label>
          ) : null}
        </div>
        {has("dock.eth_proxy_restore") ? (
          <label className="wifi-form-field">
            <FieldLabel
              zh={itemZh("dock.eth_proxy_restore", "恢复代理默认")}
              en={itemEn("dock.eth_proxy_restore")}
            />
            <select
              value={proxyRestore}
              onChange={(e) => setProxyRestore(e.target.value as TriState)}
            >
              <option value="no_change">No change</option>
              <option value="enable">Enable（执行恢复）</option>
              <option value="disable">Disable</option>
            </select>
          </label>
        ) : null}
      </fieldset>

      <div className="wifi-form-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            fillFromReads(true);
            setMsg(null);
          }}
        >
          从读数填充
        </button>
        {!readOnly ? (
          <button type="button" disabled={busy} onClick={() => void onApply()}>
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
      {meta.verifyPath ? (
        <p className="wifi-form-hint">{meta.verifyPath}</p>
      ) : null}
    </div>
  );
}
