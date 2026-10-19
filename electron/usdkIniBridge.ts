import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AppConfig } from "./types.js";
import { adbShell, runAdb } from "./adb.js";

import { BRIDGE_PKG, isBridgeInstalled } from "./deviceBridge.js";
import { readUsdkBridgeResult } from "./usdkBroadcast.js";

export { isBridgeInstalled };

export type WifiIniPlatform = "mtk" | "qcom" | "broadcom" | "unknown";

export async function detectWifiIniPlatform(
  config: AppConfig,
): Promise<WifiIniPlatform> {
  try {
    const hw = await adbShell(config, "getprop ro.hardware", 3000);
    const board = await adbShell(config, "getprop ro.board.platform", 3000);
    const chip = `${hw} ${board}`.toLowerCase();
    if (chip.startsWith("mt") || chip.includes("mt6")) return "mtk";
    if (chip.includes("qcom") || chip.includes("lahaina") || chip.includes("sm"))
      return "qcom";
    if (chip.includes("broadcom") || chip.includes("rt40")) return "broadcom";
  } catch {
    /* optional */
  }
  return "unknown";
}

export async function usdkGetIni(
  config: AppConfig,
  name: string,
): Promise<{ value: string | null; source: "usdk" | "missing" }> {
  if (!(await isBridgeInstalled(config))) {
    return { value: null, source: "missing" };
  }
  await runAdb(
    config,
    [
      "shell",
      "am",
      "broadcast",
      "-a",
      "com.urovo.livepanel.USDK_INI",
      "-n",
      `${BRIDGE_PKG}/.UsdkIniReceiver`,
      "--es",
      "op",
      "getIni",
      "--es",
      "name",
      name,
    ],
    8000,
  );
  await sleep(350);
  const line = await readUsdkBridgeResult(config);
  if (!line || line.startsWith("ERR:")) return { value: null, source: "usdk" };
  return { value: line, source: "usdk" };
}

export async function usdkPutIni(
  config: AppConfig,
  name: string,
  value: string,
): Promise<void> {
  if (!(await isBridgeInstalled(config))) {
    throw new Error(
      "未安装 LivePanel USDK 桥接 APK（device-usdk-bridge），无法 putIni",
    );
  }
  await runAdb(
    config,
    [
      "shell",
      "am",
      "broadcast",
      "-a",
      "com.urovo.livepanel.USDK_INI",
      "-n",
      `${BRIDGE_PKG}/.UsdkIniReceiver`,
      "--es",
      "op",
      "putIni",
      "--es",
      "name",
      name,
      "--es",
      "value",
      value,
    ],
    8000,
  );
  await sleep(400);
  const line = await readUsdkBridgeResult(config);
  if (line.startsWith("ERR:")) {
    throw new Error(line.slice(4));
  }
}

export async function usdkSetWifiCountryCode(
  config: AppConfig,
  code: string,
): Promise<void> {
  if (!(await isBridgeInstalled(config))) {
    throw new Error("未安装 LivePanel USDK 桥接 APK");
  }
  await runAdb(
    config,
    [
      "shell",
      "am",
      "broadcast",
      "-a",
      "com.urovo.livepanel.USDK_INI",
      "-n",
      `${BRIDGE_PKG}/.UsdkIniReceiver`,
      "--es",
      "op",
      "setWifiCountryCode",
      "--es",
      "value",
      code,
    ],
    8000,
  );
  await sleep(400);
  const line = await readUsdkBridgeResult(config);
  if (line.startsWith("ERR:")) {
    throw new Error(line.slice(4));
  }
}

export async function usdkGetWifiCountryCode(
  config: AppConfig,
): Promise<string | null> {
  if (!(await isBridgeInstalled(config))) return null;
  await runAdb(
    config,
    [
      "shell",
      "am",
      "broadcast",
      "-a",
      "com.urovo.livepanel.USDK_INI",
      "-n",
      `${BRIDGE_PKG}/.UsdkIniReceiver`,
      "--es",
      "op",
      "getWifiCountryCode",
    ],
    8000,
  );
  await sleep(350);
  const v = await readUsdkBridgeResult(config);
  return v && !v.startsWith("ERR:") ? v : null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 开发：从本地构建产物 adb install 的提示路径 */
export function usdkBridgeApkHint(): string {
  return path.join(
    os.homedir(),
    "Desktop",
    "测试知识库",
    "10_工具开发",
    "实况面板",
    "device-usdk-bridge",
    "app",
    "build",
    "outputs",
    "apk",
    "debug",
    "app-debug.apk",
  );
}

export function usdkBridgeApkExists(): boolean {
  return fs.existsSync(usdkBridgeApkHint());
}
