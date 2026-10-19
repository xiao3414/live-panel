import type { AppConfig } from "./types.js";
import { adbShell } from "./adb.js";
import { settingsGet } from "./adb.js";
import { unknownSourcesPerAppDetail } from "./platformPolicyCopy.js";

/** cmd appops query-op 在本机输出包名行，不一定带 package: 前缀 */
export function parseRequestInstallPackagesAllowList(out: string): string[] {
  const names: string[] = [];
  for (const line of out.split("\n")) {
    const t = line.trim();
    if (!t || /^no operations/i.test(t)) continue;
    if (t.startsWith("package:")) {
      const p = t.slice("package:".length).trim();
      if (p) names.push(p);
      continue;
    }
    if (/^[a-zA-Z][a-zA-Z0-9_.]+$/.test(t) && t.includes(".")) {
      names.push(t);
    }
  }
  return [...new Set(names)];
}

/**
 * Android 8+「设置 › 安装未知应用」按应用 REQUEST_INSTALL_PACKAGES 授权；
 * legacy secure.install_non_market_apps 与上述列表常不一致。
 */
export async function readInstallUnknownAppsEffectiveRaw(
  config: AppConfig,
): Promise<{ raw: "0" | "1"; detail?: string } | null> {
  try {
    const allowOut = await adbShell(
      config,
      "cmd appops query-op REQUEST_INSTALL_PACKAGES 0 allow",
      10_000,
    );
    if (allowOut != null) {
      const allowed = parseRequestInstallPackagesAllowList(allowOut);
      if (allowed.length > 0) {
        return {
          raw: "1",
          detail: unknownSourcesPerAppDetail(allowed.length),
        };
      }
      const reversed = await settingsGet(
        config,
        "secure",
        "unknown_sources_default_reversed",
      );
      if (reversed === "1") {
        return {
          raw: "0",
          detail: "安装未知应用：无 allow 授权（unknown_sources_default_reversed=1）",
        };
      }
      const legacy = await settingsGet(
        config,
        "secure",
        "install_non_market_apps",
      );
      if (legacy === "1") {
        return {
          raw: "0",
          detail:
            "安装未知应用列表均为不允许；legacy install_non_market_apps=1 已忽略",
        };
      }
      return { raw: "0", detail: "无应用被授权安装未知来源" };
    }
  } catch {
    /* fall through */
  }
  return null;
}
