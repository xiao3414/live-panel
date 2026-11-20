import type { AppConfig } from "./types.js";
import { usdkBroadcast, bridgeErrMessage } from "./usdkBroadcast.js";

export function parseScanBridgeDump(line: string): {
  ok: boolean;
  props: Map<string, string>;
  error?: string;
} {
  const t = line.trim();
  if (!t.startsWith("SCANPROPS:")) {
    return {
      ok: false,
      props: new Map(),
      error: t.startsWith("ERR:")
        ? t.slice(4)
        : bridgeErrMessage(t, "scanDumpAll"),
    };
  }
  const props = new Map<string, string>();
  const body = t.slice("SCANPROPS:".length);
  for (const row of body.split("\n")) {
    const line = row.trim();
    if (!line) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq);
    // ContentProvider 常返回两套同名行：先 OEM/已应用，后 Default 模板。
    // 后写覆盖会把对比打回出厂默认（Scan 推送后仍显示 10+ 不符）；保留首次。
    if (!props.has(key)) props.set(key, line.slice(eq + 1));
  }
  if (!props.size) {
    return { ok: false, props, error: "empty property_settings" };
  }
  return { ok: true, props };
}

export async function scanBridgeGetProperty(
  config: AppConfig,
  propertyName: string,
): Promise<{ raw: string | null; note?: string }> {
  const line = await usdkBroadcast(config, "scanGetProperty", {
    property: propertyName,
  });
  const t = line.trim();
  if (t.startsWith("VAL:")) {
    const raw = t.slice(4);
    return { raw: raw === "" ? null : raw };
  }
  if (t.startsWith("ERR:")) {
    return { raw: null, note: t.slice(4) || "scanGetProperty failed" };
  }
  return { raw: null, note: "scanGetProperty 无响应" };
}

export async function scanBridgeLoadAllProperties(
  config: AppConfig,
): Promise<{ props: Map<string, string>; note?: string }> {
  const line = await usdkBroadcast(config, "scanDumpAll");
  const parsed = parseScanBridgeDump(line);
  if (!parsed.ok) {
    return {
      props: new Map(),
      note: parsed.error ?? "DataWedge 桥接读失败",
    };
  }
  return { props: parsed.props };
}

export async function scanBridgeSetProperty(
  config: AppConfig,
  property: string,
  value: string,
): Promise<void> {
  const line = await usdkBroadcast(config, "scanSetProperty", {
    property,
    value,
  });
  const t = line.trim();
  if (t === "OK") return;
  if (t.startsWith("ERR:")) {
    throw new Error(t.slice(4) || "scanSetProperty failed");
  }
  throw new Error(bridgeErrMessage(t, "scanSetProperty"));
}
