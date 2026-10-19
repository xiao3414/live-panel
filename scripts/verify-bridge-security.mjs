/**
 * 助手自测：ping + securityGet(adb) + 可选 ADB settings 兜底
 * 用法：npm run verify:bridge
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { makeBridgeReader } from "./verify-bridge-lib.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(
  fs.readFileSync(path.join(root, "config", "app.defaults.json"), "utf8"),
);
const serial = cfg.adb?.deviceSerial ?? "";
const adb = cfg.adb?.path && cfg.adb.path !== "adb" ? cfg.adb.path : "adb";
const BRIDGE = "com.urovo.livepanel.usdkbridge";

function runAdb(args, timeoutMs = 20000) {
  const full = serial ? ["-s", serial, ...args] : args;
  return new Promise((resolve, reject) => {
    const p = spawn(adb, full, { windowsHide: true });
    let out = "";
    let err = "";
    const t = setTimeout(() => {
      p.kill();
      reject(new Error(`adb timeout: ${args.join(" ")}`));
    }, timeoutMs);
    p.stdout.on("data", (d) => {
      out += d;
    });
    p.stderr.on("data", (d) => {
      err += d;
    });
    p.on("close", (code) => {
      clearTimeout(t);
      resolve({ code, out: out.trim(), err: err.trim() });
    });
    p.on("error", reject);
  });
}

function reqId() {
  return crypto.randomBytes(6).toString("hex");
}

const readBridgeResult = makeBridgeReader(runAdb, BRIDGE);

async function broadcast(op, extras = {}) {
  const id = reqId();
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const args = [
    "shell",
    "am",
    "broadcast",
    "--include-stopped-packages",
    "-a",
    "com.urovo.livepanel.USDK_INI",
    "-n",
    `${BRIDGE}/.UsdkIniReceiver`,
    "--es",
    "op",
    op,
    "--es",
    "reqId",
    id,
  ];
  for (const [k, v] of Object.entries(extras)) {
    args.push("--es", k, v);
  }
  await runAdb(["shell", "rm", "-f", `/data/local/tmp/livepanel_req_${safe}.txt`], 3000).catch(
    () => {},
  );
  await runAdb(
    [
      "shell",
      "run-as",
      BRIDGE,
      "sh",
      "-c",
      `'echo -n > files/livepanel_req_${safe}.txt'`,
    ],
    4000,
  ).catch(() => {});
  await runAdb(args, 15000);
  return readBridgeResult(id, op);
}

async function main() {
  console.log("[verify] adb:", adb, "serial:", serial || "(default)");
  const dev = await runAdb(["devices"]);
  if (!dev.out.includes("\tdevice")) {
    console.error("[verify] FAIL: 无 device 在线");
    process.exit(1);
  }
  const pm = await runAdb(["shell", "pm", "path", BRIDGE]);
  if (!pm.out.includes("package:")) {
    console.error("[verify] FAIL: 桥接 APK 未安装");
    process.exit(1);
  }
  const vc = await runAdb(["shell", "dumpsys", "package", BRIDGE]);
  let m = vc.out.match(/versionCode=(\d+)/);
  let versionCode = m ? Number(m[1]) : 0;
  console.log("[verify] bridge versionCode:", versionCode || "?");
  const bundled = path.join(root, "resources", "device-usdk-bridge.apk");
  if (versionCode < 18 && fs.existsSync(bundled)) {
    console.log("[verify] upgrading bridge to bundled apk (expect v17+)…");
    await runAdb(["install", "-r", "-g", bundled], 120000);
    const vc2 = await runAdb(["shell", "dumpsys", "package", BRIDGE]);
    m = vc2.out.match(/versionCode=(\d+)/);
    versionCode = m ? Number(m[1]) : 0;
    console.log("[verify] after install versionCode:", versionCode || "?");
  }

  const ping = await broadcast("ping");
  console.log("[verify] ping =>", ping || "(empty)");
  if (ping !== "OK") {
    console.error("[verify] FAIL: ping");
    process.exit(1);
  }

  const sec = await broadcast("securityGet", { feature: "adb" });
  console.log("[verify] securityGet(adb) =>", sec || "(empty)");
  const usdkBroken =
    sec.includes("Failed resolution") ||
    sec.includes("usdk_not_available") ||
    sec.includes("DeviceManagerEx");
  if (usdkBroken) {
    const adbEn = await runAdb([
      "shell",
      "settings",
      "get",
      "global",
      "adb_enabled",
    ]);
    console.log(
      "[verify] USDK 不可用，ADB 兜底 adb_enabled =>",
      adbEn.out.trim(),
    );
    if (!/^[01]$/.test(adbEn.out.trim())) {
      console.error("[verify] FAIL: USDK 与 ADB 兜底均异常");
      process.exit(1);
    }
    console.log("[verify] PASS (ping OK + ADB fallback OK)");
    process.exit(0);
  }
  if (!sec.startsWith("BOOL:") && !sec.startsWith("ERR:")) {
    console.error("[verify] FAIL: securityGet 异常响应");
    process.exit(1);
  }
  console.log("[verify] PASS (ping + securityGet OK)");
}

main().catch((e) => {
  console.error("[verify] FAIL:", e.message);
  process.exit(1);
});
