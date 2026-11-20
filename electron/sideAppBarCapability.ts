import type { AppConfig } from "./types.js";
import { readProductModel } from "./dockingCapability.js";

/**
 * 侧边应用栏（Side Bar）仅部分机型有。
 * 依据：OEM/索引「Side application bar (DT630)」；测试口径：非 630 系列免测。
 */
export function isSideAppBarModel(model: string): boolean {
  const m = (model ?? "").trim();
  if (!m) return false;
  // DT630 / 带 630 的同系型号
  return /630/i.test(m);
}

export async function resolveSideAppBarSupport(
  config: AppConfig,
): Promise<{ supported: boolean; model: string; note?: string }> {
  const model = await readProductModel(config);
  if (isSideAppBarModel(model)) {
    return { supported: true, model };
  }
  return {
    supported: false,
    model,
    note: `侧边栏仅 DT630 等机型支持（当前 ${model || "未知机型"}），本项免测`,
  };
}
