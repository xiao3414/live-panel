import type { AppConfig } from "./types.js";
import { adbShell } from "./adb.js";

/**
 * Docking Host 机型能力。
 * 依据：OEMConfig 2.0 Data Capture & Peripherals —
 * 「Back Host Mode … 部分机型不支持」；DT630 仅底部 Host。
 */
export type DockingHostCapability = {
  model: string;
  bottomHost: boolean;
  backHost: boolean;
  /** 不可用项说明（给面板/对比） */
  backHostNote?: string;
  bottomHostNote?: string;
};

let modelCache: { at: number; model: string } | null = null;
const MODEL_CACHE_MS = 60_000;

export async function readProductModel(config: AppConfig): Promise<string> {
  const now = Date.now();
  if (modelCache && now - modelCache.at < MODEL_CACHE_MS) {
    return modelCache.model;
  }
  try {
    const raw = await adbShell(config, "getprop ro.product.model", 4000);
    const model = (raw ?? "").trim();
    modelCache = { at: now, model };
    return model;
  } catch {
    return modelCache?.model ?? "";
  }
}

export function invalidateDockingCapabilityCache() {
  modelCache = null;
}

/** 已知仅底部 Host、无背部 Host 的机型 */
function isBottomHostOnlyModel(model: string): boolean {
  return /DT630/i.test(model);
}

export async function resolveDockingHostCapability(
  config: AppConfig,
): Promise<DockingHostCapability> {
  const model = await readProductModel(config);
  if (isBottomHostOnlyModel(model)) {
    return {
      model,
      bottomHost: true,
      backHost: false,
      backHostNote: "本机不支持（仅底部 Host）",
    };
  }
  return {
    model,
    bottomHost: true,
    backHost: true,
  };
}
