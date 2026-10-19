/**
 * 写回 + 对账：桥接 securitySet → 失败则 ADB settings 兜底（与 writeProbe 一致）
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { makeBridgeReader } from "./verify-bridge-lib.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(
  fs.readFileSync(path.join(root, "config", "app.defaults.json"), "utf8"),
);
const serial = cfg.adb?.deviceSerial ?? "";
const adb = cfg.adb?.path && cfg.adb.path !== "adb" ? cfg.adb.path : "adb";
const BRIDGE = "com.urovo.livepanel.usdkbridge";

/** 桥接 APK 无 WRITE_* 权限时，用 PC adb settings 写（与 probe.fallback 对齐） */
const CASE = {
  feature: "unknown_source",
  namespace: "secure",
  key: "install_non_market_apps",
};

function runAdb(args, timeoutMs = 20000) {
  const full = serial ? ["-s", serial, ...args] : args;
  return new Promise((resolve, reject) => {
    const p = spawn(adb, full, { windowsHide: true });
    let out = "";
    const t = setTimeout(() => {
      p.kill();
      reject(new Error("adb timeout"));
    }, timeoutMs);
    p.stdout.on("data", (d) => {
      out += d;
    });
    p.on("close", (code) => {
      clearTimeout(t);
      resolve({ code, out: out.trim() });
    });
    p.on("error", reject);
  });
}

async function settingsGet(ns, key) {
  const r = await runAdb(["shell", "settings", "get", ns, key]);
  return r.out;
}

async function settingsPut(ns, key, val) {
  await runAdb(["shell", "settings", "put", ns, key, val]);
}

function reqId() {
  return crypto.randomBytes(6).toString("hex");
}

const readBridgeResult = makeBridgeReader(runAdb, BRIDGE);

function needsAdbWriteFallback(errMsg) {
  return (
    errMsg.includes("Permission denial") ||
    errMsg.includes("WRITE_SECURE_SETTINGS") ||
    errMsg.includes("WRITE_SETTINGS") ||
    errMsg.includes("Failed resolution") ||
    errMsg.includes("usdk_not_available")
  );
}

async function bridgeOp(op, extras) {
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

async function securitySet(feature, value) {
  const line = await bridgeOp("securitySet", { feature, value });
  if (line === "OK") return { ok: true, via: "bridge" };
  if (line.startsWith("ERR:")) {
    return { ok: false, via: "bridge", error: line };
  }
  throw new Error(`securitySet 无 OK 回包: ${line || "(empty)"}`);
}

async function securityGet(feature) {
  return bridgeOp("securityGet", { feature });
}

async function main() {
  const { feature, namespace, key } = CASE;
  const before = await settingsGet(namespace, key);
  console.log("[verify-write] before settings:", before);
  const bridgeBefore = await securityGet(feature);
  console.log("[verify-write] before bridge:", bridgeBefore);

  const targetOn = before !== "1";
  const writeVal = targetOn ? "on" : "off";
  const expect = targetOn ? "1" : "0";
  console.log("[verify-write] securitySet", feature, writeVal);
  let set = await securitySet(feature, writeVal);
  if (!set.ok && needsAdbWriteFallback(set.error ?? "")) {
    console.log("[verify-write] bridge 写失败，ADB 兜底 settings put", expect);
    await settingsPut(namespace, key, expect);
    set = { ok: true, via: "adb" };
  } else if (!set.ok) {
    throw new Error(set.error ?? "securitySet failed");
  } else {
    console.log("[verify-write] via", set.via);
  }

  await new Promise((r) => setTimeout(r, 500));
  const after = await settingsGet(namespace, key);
  const bridgeAfter = await securityGet(feature);
  console.log("[verify-write] after settings:", after);
  console.log("[verify-write] after bridge:", bridgeAfter);

  const okSettings = after === expect;
  const okBridge = bridgeAfter === `BOOL:${expect}`;

  if (!okSettings && !okBridge) {
    console.error("[verify-write] FAIL: 写回后与 settings/bridge 不一致");
    process.exit(1);
  }

  console.log("[verify-write] restore", before);
  await settingsPut(namespace, key, before === "null" ? "0" : before);
  console.log("[verify-write] PASS");
}

main().catch((e) => {
  console.error("[verify-write] FAIL:", e.message);
  process.exit(1);
});
