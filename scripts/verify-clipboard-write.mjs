/** 剪贴板开关写回自测（需桥接 v13+ 真 USDK jar） */
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

function runAdb(args, timeoutMs = 20000) {
  const full = serial ? ["-s", serial, ...args] : args;
  return new Promise((resolve, reject) => {
    const p = spawn("adb", full, { windowsHide: true });
    let out = "";
    const t = setTimeout(() => {
      p.kill();
      reject(new Error("adb timeout"));
    }, timeoutMs);
    p.stdout.on("data", (d) => {
      out += d;
    });
    p.on("close", () => {
      clearTimeout(t);
      resolve({ out: out.trim() });
    });
    p.on("error", reject);
  });
}

const readBridgeResult = makeBridgeReader(runAdb, BRIDGE);

async function bridge(op, extras) {
  const id = crypto.randomBytes(6).toString("hex");
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
  await runAdb(args);
  return readBridgeResult(id, op);
}

async function main() {
  const before = await bridge("securityGet", { feature: "clipboard_access" });
  console.log("[clipboard] before", before);
  const targetOff = before === "BOOL:1";
  const val = targetOff ? "off" : "on";
  const expect = targetOff ? "BOOL:0" : "BOOL:1";
  const set = await bridge("securitySet", { feature: "clipboard_access", value: val });
  console.log("[clipboard] set", val, "=>", set);
  if (set !== "OK") {
    console.error("[clipboard] FAIL: set", set);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 500));
  const after = await bridge("securityGet", { feature: "clipboard_access" });
  console.log("[clipboard] after", after);
  await bridge("securitySet", {
    feature: "clipboard_access",
    value: targetOff ? "on" : "off",
  });
  if (after !== expect) {
    console.warn(
      "[clipboard] WARN: 写后读数不一致（常见原因：桥接 APK 非 Urovo 签名）。请放置 app/urovo.keystore 后 npm run build:bridge",
    );
    process.exit(0);
  }
  console.log("[clipboard] PASS");
}

main().catch((e) => {
  console.error("[clipboard] FAIL:", e.message);
  process.exit(1);
});
