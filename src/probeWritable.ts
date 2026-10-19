/** 与 electron/writeProbe.resolveWriteSpec 规则一致（仅 UI 展示用） */
export function isProbeWritable(p: {
  display?: { type?: string };
  risk?: string;
  write?: unknown | false;
  probe?: { kind?: string };
}): boolean {
  if (p.risk === "block") return false;
  const dt = p.display?.type;
  if (dt !== "toggle" && dt !== "enum" && dt !== "text") return false;
  if (p.write === false) return false;
  if (p.write && typeof p.write === "object") return true;
  if (dt === "toggle" && p.probe?.kind === "adb.settings") return true;
  return false;
}
