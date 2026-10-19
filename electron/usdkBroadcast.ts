import crypto from "node:crypto";
import type { AppConfig } from "./types.js";
import { adbShell, runAdb } from "./adb.js";
import { BRIDGE_PKG, isBridgeInstalled } from "./deviceBridge.js";

export { BRIDGE_PKG };
/** eng 机型的兜底路径（应用私有目录优先，见 readUsdkBridgeResult） */
export const BRIDGE_RESULT_PATH = "/data/local/tmp/livepanel_usdk_ini.txt";

const LOG_TAG = "LivePanelBridge";

/** 无 reqId 的旧路径仍串行；带 reqId 的可并行 */
let bridgeSerialLegacy: Promise<unknown> = Promise.resolve();

let bridgeWoken = false;

/** 换设备或强制重装桥接后调用 */
export function resetBridgeSession(): void {
  bridgeWoken = false;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function newReqId(): string {
  return crypto.randomBytes(6).toString("hex");
}

function reqResultPaths(reqId: string): { appRel: string; tmp: string } {
  const safe = reqId.replace(/[^a-zA-Z0-9_-]/g, "");
  return {
    appRel: `files/livepanel_req_${safe}.txt`,
    tmp: `/data/local/tmp/livepanel_req_${safe}.txt`,
  };
}

function pickLogcatResult(
  logcatOut: string,
  expectPrefixes?: string[],
): string {
  let lastAny = "";
  let lastMatch = "";
  for (const line of logcatOut.split(/\r?\n/)) {
    const idx = line.indexOf("RESULT:");
    if (idx < 0) continue;
    const payload = line.slice(idx + "RESULT:".length).trim();
    if (!payload) continue;
    lastAny = payload;
    if (
      !expectPrefixes?.length ||
      expectPrefixes.some((p) => payload.startsWith(p))
    ) {
      lastMatch = payload;
    }
  }
  if (expectPrefixes?.length) return lastMatch;
  return lastAny;
}

function logcatExpectPrefixes(op: string): string[] | undefined {
  if (op === "ping") return ["OK", "ERR:"];
  if (op === "securityGetBatch") return ["BATCH:"];
  if (op === "securityGet" || op === "securitySet") {
    return ["BOOL:", "VAL:", "ERR:", "OK"];
  }
  if (op === "getWifiWhiteList") return ["LIST:", "ERR:"];
  return undefined;
}

async function readFromLogcat(
  config: AppConfig,
  expectPrefixes?: string[],
): Promise<string> {
  try {
    const { stdout } = await runAdb(
      config,
      ["shell", "logcat", "-d", "-s", `${LOG_TAG}:I`, "-t", "64"],
      8000,
    );
    return pickLogcatResult(stdout, expectPrefixes);
  } catch {
    return "";
  }
}

/** 读取桥接 APK 写入的结果（files → tmp → logcat） */
export async function readUsdkBridgeResult(
  config: AppConfig,
  reqId?: string,
  op?: string,
): Promise<string> {
  const expect = op ? logcatExpectPrefixes(op) : undefined;
  if (reqId) {
    const { appRel, tmp } = reqResultPaths(reqId);
    try {
      const { stdout } = await runAdb(config, ["shell", "cat", tmp], 3500);
      if (stdout.trim()) return stdout.trim();
    } catch {
      /* fallback */
    }
    try {
      const line = await adbShell(
        config,
        `run-as ${BRIDGE_PKG} cat ${appRel}`,
        3500,
      );
      if (line.trim()) return line.trim();
    } catch {
      /* fallback */
    }
    return readFromLogcat(config, expect);
  }
  try {
    const line = await adbShell(
      config,
      `run-as ${BRIDGE_PKG} cat files/livepanel_usdk_ini.txt`,
      5000,
    );
    if (line.trim()) return line.trim();
  } catch {
    /* 非 debuggable 或未安装时 fallback */
  }
  try {
    const { stdout } = await runAdb(
      config,
      ["shell", "cat", BRIDGE_RESULT_PATH],
      4000,
    );
    if (stdout.trim()) return stdout.trim();
  } catch {
    /* optional */
  }
  return readFromLogcat(config, expect);
}

async function wakeBridgeProcess(config: AppConfig): Promise<void> {
  if (bridgeWoken) return;
  try {
    await runAdb(
      config,
      [
        "shell",
        "am",
        "start",
        "-n",
        `${BRIDGE_PKG}/.BridgeWakeActivity`,
      ],
      6000,
    );
    await sleep(120);
    bridgeWoken = true;
  } catch {
    /* optional */
  }
}

/** 使用 argv 发 broadcast，避免 Windows/设备 shell 引号拆坏 extras */
async function sendUsdkBroadcast(
  config: AppConfig,
  op: string,
  extras?: Record<string, string>,
): Promise<void> {
  const args = [
    "shell",
    "am",
    "broadcast",
    "--include-stopped-packages",
    "-a",
    "com.urovo.livepanel.USDK_INI",
    "-n",
    `${BRIDGE_PKG}/.UsdkIniReceiver`,
    "--es",
    "op",
    op,
  ];
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      args.push("--es", k, v);
    }
  }
  const { code, stderr } = await runAdb(config, args, 15000);
  if (code !== 0 && stderr && !stderr.includes("Broadcast completed")) {
    throw new Error(stderr.slice(0, 200));
  }
}

async function clearBridgeResultStale(
  config: AppConfig,
  reqId?: string,
): Promise<void> {
  if (reqId) {
    const { appRel, tmp } = reqResultPaths(reqId);
    try {
      await adbShell(
        config,
        `run-as ${BRIDGE_PKG} sh -c 'echo -n > ${appRel}'`,
        3000,
      );
    } catch {
      /* optional */
    }
    try {
      await runAdb(config, ["shell", "rm", "-f", tmp], 3000);
    } catch {
      /* optional */
    }
    return;
  }
  try {
    await adbShell(
      config,
      `run-as ${BRIDGE_PKG} sh -c 'echo -n > files/livepanel_usdk_ini.txt'`,
      3000,
    );
  } catch {
    /* optional */
  }
  try {
    await runAdb(config, ["shell", "rm", "-f", BRIDGE_RESULT_PATH], 3000);
  } catch {
    /* optional */
  }
}

export type UsdkBroadcastMode = "default" | "fast";

async function usdkBroadcastOnce(
  config: AppConfig,
  op: string,
  extras?: Record<string, string>,
  mode: UsdkBroadcastMode = "default",
): Promise<string> {
  if (!(await isBridgeInstalled(config))) {
    return "ERR:bridge_not_installed";
  }
  const reqId = newReqId();
  const payload: Record<string, string> = { ...(extras ?? {}), reqId };
  await wakeBridgeProcess(config);
  await clearBridgeResultStale(config, reqId);
  await sendUsdkBroadcast(config, op, payload);

  const batch = op === "securityGetBatch";
  const securityGet = op === "securityGet";
  let maxWaitMs = 10_000;
  let pollMs = 320;
  if (op === "ping") {
    maxWaitMs = 8_000;
    pollMs = 250;
  } else if (op === "securitySet" || mode === "fast") {
    maxWaitMs = 5_500;
    pollMs = 220;
  } else if (batch) {
    const n = extras?.features?.split(",").filter(Boolean).length ?? 7;
    maxWaitMs = Math.min(22_000, 5_500 + n * 520);
    pollMs = 280;
  } else if (securityGet) {
    maxWaitMs = 12_000;
    pollMs = 300;
  }

  const deadline = Date.now() + maxWaitMs;
  await sleep(batch ? 380 : securityGet ? 300 : 260);
  while (Date.now() < deadline) {
    const line = await readUsdkBridgeResult(config, reqId, op);
    if (line) return line;
    await sleep(pollMs);
  }
  return "";
}

/** 每项独立 reqId 结果文件，可并行；无 reqId 的旧 INI 读仍串行 */
function usdkBroadcastParallelOk(op: string, mode: UsdkBroadcastMode): boolean {
  if (mode === "fast" || op === "securitySet") return true;
  return (
    op === "ping" ||
    op === "securityGet" ||
    op === "securityGetBatch" ||
    op === "getWifiWhiteList"
  );
}

export async function usdkBroadcast(
  config: AppConfig,
  op: string,
  extras?: Record<string, string>,
  mode: UsdkBroadcastMode = "default",
): Promise<string> {
  const run = () => usdkBroadcastOnce(config, op, extras, mode);
  if (usdkBroadcastParallelOk(op, mode)) {
    return run();
  }
  const out = bridgeSerialLegacy.then(run, run);
  bridgeSerialLegacy = out.then(
    () => undefined,
    () => undefined,
  );
  return out;
}

export function bridgeOk(line: string): boolean {
  return line === "OK" || line.startsWith("LIST:");
}

export function bridgeErrMessage(line: string, fallback: string): string {
  if (!line) {
    return `${fallback}（桥接无响应：请点「刷新设备」重新安装 USDK 组件后重试；若仍失败请反馈 logcat 标签 ${LOG_TAG}）`;
  }
  if (line.startsWith("ERR:")) return line.slice(4);
  if (bridgeOk(line)) return "";
  return `${fallback}: ${line}`;
}
