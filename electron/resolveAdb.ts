import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** 解析 adb.exe：配置相对名时补全 PATH / 常见 SDK 路径 */
export function resolveAdbPath(configured: string): string {
  const trimmed = configured.trim();
  if (!trimmed) return "adb";

  if (/[\\/]/.test(trimmed)) {
    if (fs.existsSync(trimmed)) return trimmed;
    return trimmed;
  }

  if (process.platform === "win32") {
    try {
      const out = execSync("where adb", {
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const first = out.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      if (first && fs.existsSync(first)) return first;
    } catch {
      /* where 失败 */
    }

    const local = process.env.LOCALAPPDATA;
    const candidates = [
      process.env.ANDROID_HOME &&
        path.join(process.env.ANDROID_HOME, "platform-tools", "adb.exe"),
      process.env.ANDROID_SDK_ROOT &&
        path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb.exe"),
      local && path.join(local, "Android", "Sdk", "platform-tools", "adb.exe"),
    ].filter((p): p is string => Boolean(p));

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }

  return trimmed;
}
