import type { AppConfig } from "./types.js";
import { adbShell } from "./adb.js";
import { usdkBroadcast, bridgeErrMessage } from "./usdkBroadcast.js";
import {
  invalidateDockingCapabilityCache,
  resolveDockingHostCapability,
} from "./dockingCapability.js";

type DumpsysEthernetSnap = {
  ipMode: "DHCP" | "Static" | null;
  ethernetOn: boolean | null;
};

/** dumpsys ethernet → 分配方式 / 开关（纠正 USDK 残留静态配置） */
async function readDumpsysEthernet(
  config: AppConfig,
): Promise<DumpsysEthernetSnap> {
  try {
    const dump = await adbShell(config, "dumpsys ethernet", 8000);
    const modeM = dump.match(/IP assignment:\s*(DHCP|STATIC)/i);
    const ipMode = modeM
      ? /static/i.test(modeM[1])
        ? "Static"
        : "DHCP"
      : null;
    let ethernetOn: boolean | null = null;
    if (/Ethernet State:\s*enabled/i.test(dump)) ethernetOn = true;
    else if (/Ethernet State:\s*disabled/i.test(dump)) ethernetOn = false;
    return { ipMode, ethernetOn };
  } catch {
    return { ipMode: null, ethernetOn: null };
  }
}

export function parseDockingBridgeDump(line: string): {
  ok: boolean;
  props: Map<string, string>;
  error?: string;
} {
  const t = line.trim();
  if (!t.startsWith("DOCKPROPS:")) {
    return {
      ok: false,
      props: new Map(),
      error: t.startsWith("ERR:")
        ? t.slice(4)
        : bridgeErrMessage(t, "dockingDumpAll"),
    };
  }
  const props = new Map<string, string>();
  const body = t.slice("DOCKPROPS:".length);
  for (const row of body.split("\n")) {
    const line = row.trim();
    if (!line) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    props.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return { ok: true, props };
}

let cache: { at: number; props: Map<string, string>; note?: string } | null =
  null;
const CACHE_MS = 8_000;

export function invalidateDockingCache() {
  cache = null;
  invalidateDockingCapabilityCache();
}

export async function dockingBridgeLoadAll(
  config: AppConfig,
): Promise<{ props: Map<string, string>; note?: string }> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return { props: cache.props, note: cache.note };
  }
  const line = await usdkBroadcast(config, "dockingDumpAll");
  const parsed = parseDockingBridgeDump(line);
  if (!parsed.ok) {
    cache = {
      at: now,
      props: new Map(),
      note: parsed.error ?? "Docking 桥接读失败",
    };
    return { props: cache.props, note: cache.note };
  }
  const props = new Map(parsed.props);
  // 旧桥接 / USDK 残留静态字段时，用 dumpsys 覆盖实况
  const sys = await readDumpsysEthernet(config);
  if (sys.ipMode) props.set("ipMode", sys.ipMode);
  if (sys.ethernetOn != null) props.set("ethernet", sys.ethernetOn ? "1" : "0");
  cache = { at: now, props };
  return { props };
}

export type DockingFieldRead = {
  raw: string | null;
  note?: string;
  /** 本机无此 Host / API 不可用：不参与 JSON 不符统计 */
  unsupported?: boolean;
  supportMessage?: string;
};

function isNaToken(v: string | null | undefined): boolean {
  if (v == null) return true;
  const t = v.trim().toLowerCase();
  return t === "" || t === "na" || t === "n/a" || t === "unsupported";
}

export async function dockingBridgeGetField(
  config: AppConfig,
  field: string,
): Promise<DockingFieldRead> {
  const cap = await resolveDockingHostCapability(config);
  if (field === "backHost" && !cap.backHost) {
    return {
      raw: null,
      unsupported: true,
      supportMessage:
        cap.backHostNote ?? "本机型不支持背部 Host（仅底部 Host）",
    };
  }
  if (field === "bottomHost" && !cap.bottomHost) {
    return {
      raw: null,
      unsupported: true,
      supportMessage:
        cap.bottomHostNote ?? "本机型不支持底部 Host",
    };
  }

  const snap = await dockingBridgeLoadAll(config);
  const v = snap.props.get(field);
  // DHCP 下静态地址常为空：不算读失败（设置页也会灰显残留值）
  const ipDetailFields = new Set([
    "ipAddress",
    "gateway",
    "netmask",
    "prefixLength",
    "dns1",
    "dns2",
  ]);
  if (ipDetailFields.has(field)) {
    const mode = (snap.props.get("ipMode") ?? "").toLowerCase();
    if (mode.includes("dhcp") && (v == null || isNaToken(v))) {
      return { raw: "", note: "DHCP（无静态地址）" };
    }
  }
  if (v != null && !isNaToken(v)) return { raw: v, note: snap.note };

  // 桥接回报 na / 空：API 缺失或本机无此能力
  if (
    (field === "backHost" || field === "bottomHost") &&
    (v == null || isNaToken(v))
  ) {
    const which = field === "backHost" ? "背部" : "底部";
    return {
      raw: null,
      unsupported: true,
      supportMessage: `本机不支持${which} Host`,
      note: snap.note,
    };
  }

  if (snap.note) return { raw: null, note: snap.note };
  const line = await usdkBroadcast(config, "dockingGetField", { field });
  const t = line.trim();
  if (t.startsWith("VAL:")) {
    const raw = t.slice(4);
    if (isNaToken(raw) && (field === "backHost" || field === "bottomHost")) {
      const which = field === "backHost" ? "背部" : "底部";
      return {
        raw: null,
        unsupported: true,
        supportMessage: `本机不支持${which} Host`,
      };
    }
    return { raw: raw === "" ? null : raw };
  }
  if (t.startsWith("ERR:")) {
    return { raw: null, note: t.slice(4) || "dockingGetField failed" };
  }
  return { raw: null, note: snap.note ?? "dockingGetField 无响应" };
}

export type DockingApplyPayload = {
  bottomHost?: "enable" | "disable" | "no_change";
  backHost?: "enable" | "disable" | "no_change";
  ethernet?: "enable" | "disable" | "no_change";
  ipMode?: "no_change" | "DHCP" | "Static";
  ipAddress?: string;
  gateway?: string;
  netmask?: string;
  dns1?: string;
  dns2?: string;
  proxyHost?: string;
  proxyPort?: string;
  proxyBypass?: string;
  proxyRestore?: "enable" | "disable" | "no_change";
};

function triTo01(
  v: "enable" | "disable" | "no_change" | undefined,
): string | undefined {
  if (v === "enable") return "1";
  if (v === "disable") return "0";
  return undefined;
}

/** 将面板表单写回设备（USDK dockingApply） */
export async function applyDockingSettings(
  config: AppConfig,
  payload: DockingApplyPayload,
): Promise<void> {
  const extras: Record<string, string> = {};
  const bottom = triTo01(payload.bottomHost);
  if (bottom != null) extras.bottomHost = bottom;
  const back = triTo01(payload.backHost);
  if (back != null) extras.backHost = back;
  const eth = triTo01(payload.ethernet);
  if (eth != null) extras.ethernet = eth;

  if (payload.ipMode === "DHCP" || payload.ipMode === "Static") {
    extras.ipMode = payload.ipMode;
  }
  const put = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) extras[k] = t;
  };
  put("ipAddress", payload.ipAddress);
  put("gateway", payload.gateway);
  put("netmask", payload.netmask);
  put("dns1", payload.dns1);
  put("dns2", payload.dns2);
  put("proxyHost", payload.proxyHost);
  put("proxyPort", payload.proxyPort);
  put("proxyBypass", payload.proxyBypass);

  const restore = triTo01(payload.proxyRestore);
  if (restore === "1") extras.proxyRestore = "1";

  if (Object.keys(extras).length === 0) {
    throw new Error("没有需要写回的项（均为 No change / 空）");
  }

  invalidateDockingCache();
  const line = await usdkBroadcast(config, "dockingApply", extras);
  const t = line.trim();
  if (t === "OK" || t.startsWith("OK")) {
    invalidateDockingCache();
    return;
  }
  if (t.startsWith("ERR:")) {
    throw new Error(t.slice(4) || "dockingApply failed");
  }
  throw new Error(
    t
      ? bridgeErrMessage(t, "dockingApply")
      : "dockingApply 无响应：请点「刷新设备」升级 USDK 桥接后重试",
  );
}
