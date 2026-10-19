/** USB Mode 读数应对齐 sys.usb.config（mtp→1 等） */
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
const BRIDGE = "com.urovo.livepanel.usdkbridge";

function runAdb(args) {
  const full = serial ? ["-s", serial, ...args] : args;
  return new Promise((resolve, reject) => {
    const p = spawn("adb", full, { windowsHide: true });
    let out = "";
    p.stdout.on("data", (d) => {
      out += d;
    });
    p.on("close", () => resolve({ out: out.trim() }));
    p.on("error", reject);
  });
}

function expectModeFromProp(prop) {
  const c = prop.toLowerCase();
  if (c.includes("midi")) return "3";
  if (c.includes("ptp")) return "2";
  if (c.includes("mtp")) return "1";
  return "0";
}

const readBridgeResult = makeBridgeReader(runAdb, BRIDGE);

async function securityGet(feature) {
  const id = crypto.randomBytes(6).toString("hex");
  await runAdb([
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
    "securityGet",
    "--es",
    "feature",
    feature,
    "--es",
    "reqId",
    id,
  ]);
  return readBridgeResult(id, "securityGet");
}

async function main() {
  const propRes = await runAdb(["shell", "getprop", "sys.usb.config"]);
  const prop = propRes.out;
  const expect = expectModeFromProp(prop);
  const line = await securityGet("usb_mode");
  console.log("[usb-mode] sys.usb.config =", prop, "expect mode", expect);
  console.log("[usb-mode] bridge", line);
  const raw = line.startsWith("VAL:") ? line.slice(4) : "";
  if (raw !== expect) {
    console.error("[usb-mode] FAIL");
    process.exit(1);
  }
  console.log("[usb-mode] PASS");
}

main().catch((e) => {
  console.error("[usb-mode] FAIL:", e.message);
  process.exit(1);
});
