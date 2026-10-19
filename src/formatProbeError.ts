import type { ProbeResult } from "./types";

export function isProbeLocalSignError(
  result: Pick<ProbeResult, "error" | "supportMessage" | "supportStatus">,
): boolean {
  const raw = `${result.error ?? ""} ${result.supportMessage ?? ""}`;
  return /need_urovo_sign|Urovo 签名|urovo\.keystore/i.test(raw);
}

/** 配置块内短提示（不占满卡片） */
export function shortProbeHint(
  result: Pick<ProbeResult, "error" | "display" | "supportMessage">,
): string | null {
  if (isProbeLocalSignError(result)) {
    return "写回需 Urovo 签名桥接（与 SDKAuto 同 keystore）· 悬停 i 看路径";
  }
  return null;
}

/** 顶栏/提示用：优先中文 supportMessage，避免裸 ERR 码 */
export function formatProbeErrorMessage(
  result: Pick<ProbeResult, "ok" | "error" | "display" | "supportMessage">,
): string {
  if (result.supportMessage) return result.supportMessage;
  if (result.display && result.display !== result.error) return result.display;
  const raw = result.error ?? result.display ?? "操作失败";
  if (/need_urovo_sign/i.test(raw)) {
    return "剪贴板/USDK 写回需 Urovo 签名桥接：将 urovo.keystore 放到 device-usdk-bridge/app/ 后 npm run build:bridge，再「刷新设备」";
  }
  if (/write_no_effect/i.test(raw)) {
    return "写回未生效：请确认设备策略未锁定，或升级 Urovo 签名桥接";
  }
  return raw;
}
