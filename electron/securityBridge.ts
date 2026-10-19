import type { AppConfig } from "./types.js";
import { usdkBroadcast, bridgeErrMessage } from "./usdkBroadcast.js";

export function parseSecurityBridgeLine(line: string): {
  ok: boolean;
  raw: string | null;
  error?: string;
} {
  const t = line.trim();
  if (!t) {
    return { ok: false, raw: null, error: "bridge_no_response" };
  }
  if (t.startsWith("ERR:")) {
    return {
      ok: false,
      raw: null,
      error: t.slice(4) || bridgeErrMessage(t, "USDK 安全桥接失败"),
    };
  }
  if (t === "OK") {
    return { ok: true, raw: "1" };
  }
  if (t.startsWith("BOOL:")) {
    const bit = t.slice(5).trim();
    return { ok: true, raw: bit === "1" || bit === "true" ? "1" : "0" };
  }
  if (t.startsWith("VAL:")) {
    return { ok: true, raw: t.slice(4) };
  }
  if (t.startsWith("LIST:")) {
    return { ok: true, raw: t.slice(5) };
  }
  return { ok: true, raw: t || null };
}

export async function securityBridgeGet(
  config: AppConfig,
  feature: string,
): Promise<{ raw: string | null; note?: string }> {
  const line = await usdkBroadcast(config, "securityGet", { feature });
  const parsed = parseSecurityBridgeLine(line);
  if (!parsed.ok) {
    const msg =
      parsed.error === "bridge_no_response"
        ? bridgeErrMessage("", `securityGet(${feature})`)
        : (parsed.error ?? bridgeErrMessage(line, `securityGet(${feature})`));
    return { raw: null, note: msg };
  }
  return { raw: parsed.raw };
}

export function parseSecurityBatchLine(
  line: string,
): Map<string, { raw: string | null; note?: string }> {
  const out = new Map<string, { raw: string | null; note?: string }>();
  const t = line.trim();
  if (!t.startsWith("BATCH:")) {
    return out;
  }
  const body = t.slice(6);
  for (const chunk of body.split(",")) {
    if (!chunk) continue;
    const pipe = chunk.indexOf("|");
    if (pipe <= 0) continue;
    const feature = chunk.slice(0, pipe);
    const part = chunk.slice(pipe + 1);
    const parsed = parseSecurityBridgeLine(part);
    if (parsed.ok) {
      out.set(feature, { raw: parsed.raw });
    } else {
      out.set(feature, {
        raw: null,
        note: parsed.error ?? part,
      });
    }
  }
  return out;
}

export async function securityBridgeGetBatch(
  config: AppConfig,
  features: string[],
): Promise<Map<string, { raw: string | null; note?: string }>> {
  if (!features.length) return new Map();
  const line = await usdkBroadcast(config, "securityGetBatch", {
    features: features.join(","),
  });
  if (line.startsWith("ERR:")) {
    const msg = bridgeErrMessage(line, "securityGetBatch");
    const m = new Map<string, { raw: string | null; note?: string }>();
    for (const f of features) m.set(f, { raw: null, note: msg });
    return m;
  }
  const map = parseSecurityBatchLine(line);
  if (map.size > 0) return map;
  const msg = bridgeErrMessage(line, "Security 批量读");
  const m = new Map<string, { raw: string | null; note?: string }>();
  for (const f of features) m.set(f, { raw: null, note: msg });
  return m;
}

export async function pingSecurityBridge(
  config: AppConfig,
): Promise<{ ok: boolean; note?: string; linkOnly?: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const line = await usdkBroadcast(config, "ping");
    if (line === "OK") return { ok: true };
    if (line.startsWith("ERR:") && !line.includes("bridge_not_installed")) {
      return { ok: false, note: line.slice(4) };
    }
  }
  const wlan = await usdkBroadcast(config, "getWifiWhiteList");
  if (
    wlan.startsWith("LIST:") ||
    (wlan.startsWith("ERR:") && !wlan.includes("bridge_not_installed"))
  ) {
    return {
      ok: false,
      linkOnly: true,
      note: "USDK 广播可达，但 ping/Security 无回包（请反馈 logcat 标签 LivePanelBridge）",
    };
  }
  return { ok: false, note: bridgeErrMessage("", "USDK 桥接") };
}

export async function securityBridgeGetMany(
  config: AppConfig,
  features: string[],
  concurrency = 2,
): Promise<Map<string, { raw: string | null; note?: string }>> {
  const out = new Map<string, { raw: string | null; note?: string }>();
  if (!features.length) return out;
  let index = 0;
  const workers = Math.min(concurrency, features.length);
  async function worker() {
    while (index < features.length) {
      const i = index++;
      const f = features[i]!;
      out.set(f, await securityBridgeGet(config, f));
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

export async function securityBridgeSet(
  config: AppConfig,
  feature: string,
  value: string,
): Promise<void> {
  const line = await usdkBroadcast(
    config,
    "securitySet",
    { feature, value },
    "fast",
  );
  if (!line) {
    throw new Error(
      bridgeErrMessage("", `securitySet(${feature})`),
    );
  }
  if (line.startsWith("ERR:")) {
    throw new Error(line.slice(4));
  }
  if (line !== "OK") {
    throw new Error(
      `securitySet(${feature}) 回包异常: ${line.slice(0, 120)}`,
    );
  }
}
