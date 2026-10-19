import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { runAdb } from "./adb.js";
import { projectRoot } from "./paths.js";
import { resetBridgeSession, usdkBroadcast } from "./usdkBroadcast.js";
import { probeWlanBridge } from "./wlanBridgeProbe.js";
import type { AppConfig } from "./types.js";

export const BRIDGE_PKG = "com.urovo.livepanel.usdkbridge";

/** 与 device-usdk-bridge/app/build.gradle versionCode 同步 */
export const BUNDLED_BRIDGE_VERSION_CODE = 18;

export type BridgeEnsureResult = {
  ok: boolean;
  installed: boolean;
  action:
    | "skipped"
    | "already_ok"
    | "installed"
    | "missing_apk"
    | "no_device"
    | "failed";
  message?: string;
};

let ensureInFlight: Promise<BridgeEnsureResult> | null = null;

async function bridgePingDetail(config: AppConfig): Promise<string | null> {
  const line = await usdkBroadcast(config, "ping");
  if (line === "OK") return null;
  if (!line) return "ping 无回包（Receiver 未写 RESULT）";
  return line.startsWith("ERR:") ? line.slice(4) : line;
}

export function bundledBridgeApkPath(): string | null {
  const candidates: string[] = [];
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, "device-usdk-bridge.apk"));
  }
  const root = projectRoot();
  candidates.push(
    path.join(root, "resources", "device-usdk-bridge.apk"),
    path.join(
      root,
      "device-usdk-bridge",
      "app",
      "build",
      "outputs",
      "apk",
      "debug",
      "app-debug.apk",
    ),
  );
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function isBridgeInstalled(config: AppConfig): Promise<boolean> {
  if (!config.adb.deviceSerial) return false;
  try {
    const { stdout } = await runAdb(
      config,
      ["shell", "pm", "path", BRIDGE_PKG],
      8000,
    );
    return stdout.includes("package:");
  } catch {
    return false;
  }
}

async function installedBridgeVersionCode(
  config: AppConfig,
): Promise<number | null> {
  try {
    const { stdout } = await runAdb(
      config,
      ["shell", "dumpsys", "package", BRIDGE_PKG],
      10000,
    );
    const m = stdout.match(/versionCode=(\d+)/);
    return m ? Number.parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

function installLooksSuccess(stdout: string, stderr: string, code: number | null) {
  const blob = `${stdout}\n${stderr}`.toLowerCase();
  if (blob.includes("success")) return true;
  return code === 0 && !blob.includes("failure");
}

export type EnsureBridgeOptions = {
  /** 用户点「刷新设备」时强制检查版本并必要时重装 */
  force?: boolean;
};

/** 连接设备后自动安装/升级内置 USDK 桥接（用户无需手动 adb install） */
export async function ensureDeviceBridge(
  config: AppConfig,
  options?: EnsureBridgeOptions,
): Promise<BridgeEnsureResult> {
  if (!config.adb.deviceSerial) {
    return {
      ok: false,
      installed: false,
      action: "no_device",
      message: "未选择设备序列号",
    };
  }
  if (options?.force) {
    ensureInFlight = null;
    resetBridgeSession();
  }
  if (ensureInFlight) return ensureInFlight;

  ensureInFlight = (async (): Promise<BridgeEnsureResult> => {
    try {
      const installed = await isBridgeInstalled(config);
      if (installed && !options?.force) {
        const vc = await installedBridgeVersionCode(config);
        if (vc != null && vc >= BUNDLED_BRIDGE_VERSION_CODE) {
          const pingErr = await bridgePingDetail(config);
          if (pingErr) {
            return {
              ok: false,
              installed: true,
              action: "failed",
              message: `桥接 v${vc} 已安装但 ping 失败：${pingErr}`,
            };
          }
          return {
            ok: true,
            installed: true,
            action: "already_ok",
            message: `USDK 桥接已就绪（versionCode ${vc} · ping OK）`,
          };
        }
      }
      if (installed && options?.force) {
        const vc = await installedBridgeVersionCode(config);
        if (vc != null && vc >= BUNDLED_BRIDGE_VERSION_CODE) {
          const pingErr = await bridgePingDetail(config);
          if (pingErr) {
            return {
              ok: false,
              installed: true,
              action: "failed",
              message: `桥接 v${vc} 已安装但 ping 失败：${pingErr}`,
            };
          }
          return {
            ok: true,
            installed: true,
            action: "already_ok",
            message: `USDK 桥接已是最新（versionCode ${vc} · ping OK）`,
          };
        }
      }

      const apkPath = bundledBridgeApkPath();
      if (!apkPath) {
        return {
          ok: installed,
          installed,
          action: "missing_apk",
          message: installed
            ? undefined
            : "内置 USDK 组件包缺失：请使用完整版 LivePanel 或联系维护者重新打包。",
        };
      }

      const { stdout, stderr, code } = await runAdb(
        config,
        ["install", "-r", "-g", apkPath],
        90000,
      );
      if (!installLooksSuccess(stdout, stderr, code)) {
        const detail = (stderr || stdout || `exit ${code}`).slice(0, 240);
        return {
          ok: false,
          installed: await isBridgeInstalled(config),
          action: "failed",
          message: `自动安装设备组件失败：${detail}`,
        };
      }

      const after = await isBridgeInstalled(config);
      if (!after) {
        return {
          ok: false,
          installed: false,
          action: "failed",
          message: "安装命令已执行，但未检测到组件包。",
        };
      }
      const vcAfter = await installedBridgeVersionCode(config);
      const pingErr = await bridgePingDetail(config);
      const vcHint =
        vcAfter != null ? `versionCode ${vcAfter}` : "versionCode 未知";
      if (pingErr) {
        return {
          ok: false,
          installed: true,
          action: "failed",
          message: `桥接已安装（${vcHint}）但 ping 失败：${pingErr}`,
        };
      }
      return {
        ok: true,
        installed: true,
        action: "installed",
        message: `USDK 桥接已安装/升级（${vcHint} · ping OK）`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        installed: await isBridgeInstalled(config),
        action: "failed",
        message: `自动安装设备组件异常：${msg}`,
      };
    } finally {
      ensureInFlight = null;
    }
  })();

  return ensureInFlight;
}

export async function getDeviceBridgeStatus(config: AppConfig) {
  return {
    installed: await isBridgeInstalled(config),
    bundledApk: Boolean(bundledBridgeApkPath()),
    expectedVersionCode: BUNDLED_BRIDGE_VERSION_CODE,
  };
}
