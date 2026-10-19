/** 将 Electron IPC 异常转为界面可读短句 */
export function messageFromError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const inner = raw.match(/Error: ([\s\S]+)$/);
  if (inner) return inner[1].trim();
  return raw.replace(/^Error invoking remote method '[^']+':\s*/i, "").trim();
}
