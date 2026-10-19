/**
 * OEM 配置文件 → 与设备 Security 读数对比（与面板 OEM 对比同源）
 * 用法: node scripts/compare-oem-config.mjs "D:\path\Security & Restriction-1.json"
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { makeBridgeReader } from "./verify-bridge-lib.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOem = path.join(
  "D:",
  "test_tools",
  "OEM2.0",
  "配置文件",
  "5. Security & Restriction",
  "Security & Restriction-1.json",
);

const OEM_MAP = {
  allowFactoryReset: "sec.allow_factory_reset",
  lockScreenEnable: "sec.screen_lock",
  lockScreenSet: "sec.screen_lock_set",
  lockScreenSetPassword: "sec.screen_lock_password",
  lockScreenTimeout: "sec.screen_lock_timeout",
  googlePlayProtect: "sec.google_play_protect",
  appUnknownSource: "sec.unknown_source",
  appOverUsb: "sec.verify_apps_usb",
  passCodeApp: "sec.scan_key_pass",
  disallowScreenshot: "sec.disallow_screenshot",
  screenPinning: "sec.screen_pinning",
  volumeKeyEnable: "sec.volume_key",
  cameraEnable: "sec.camera_access",
  microphoneAccess: "sec.microphone_access",
  clipboardEnable: "sec.clipboard_access",
  showPasswordWhenTyping: "sec.show_passwords",
  locationAccess: "sec.location_access",
  externalMountedMemory: "sec.external_sd",
  USBEnable: "sec.usb",
  USBMode: "sec.usb_mode",
  ADBEnable: "sec.adb",
};

function parseTimeout(raw) {
  const t = String(raw).trim().toLowerCase();
  const m = t.match(/^(\d+)\s*(minutes?|mins?|min|分钟)$/);
  if (m) return String(Number(m[1]) * 60_000);
  if (/^\d+$/.test(t)) return t;
  return String(raw).trim();
}

function oemToRaw(key, val) {
  const v = String(val ?? "").trim();
  if (!v || v === "No change") return null;
  if (key === "lockScreenSetPassword") return v.length > 0 ? "set" : null;
  if (key === "lockScreenTimeout") return parseTimeout(v);
  if (key === "lockScreenSet") return v.toLowerCase() === "pin" ? "pin" : v.toLowerCase();
  if (key === "USBMode") {
    const k = v.toLowerCase();
    if (k.includes("file") && k.includes("transfer")) return "1";
    if (k.includes("no data")) return "0";
    if (k === "ptp") return "2";
    if (k === "midi") return "3";
    return v;
  }
  if (key === "disallowScreenshot") {
    if (/disallow/i.test(v)) return "1";
    if (/allow/i.test(v)) return "0";
  }
  if (/^enable$/i.test(v) || /^allow$/i.test(v)) return "1";
  if (/^disable$/i.test(v) || /^disallow$/i.test(v)) return "0";
  return v;
}

function parseOemFile(text) {
  const outer = JSON.parse(text);
  const inner = JSON.parse(outer.appConfiguration);
  return inner.securityRestriction ?? {};
}

const probeFeature = {};
const yaml = fs.readFileSync(
  path.join(root, "registry", "modules", "oem20_security_probes.yaml"),
  "utf8",
);
for (const m of yaml.matchAll(/- id: (sec\.\w+)[\s\S]*?feature: (\w+)/g)) {
  probeFeature[m[1]] = m[2];
}

const cfg = JSON.parse(
  fs.readFileSync(path.join(root, "config", "app.defaults.json"), "utf8"),
);
const serial = cfg.adb?.deviceSerial ?? "";
const adb = cfg.adb?.path && cfg.adb.path !== "adb" ? cfg.adb.path : "adb";
const BRIDGE = "com.urovo.livepanel.usdkbridge";

function runAdb(args, timeoutMs = 25000) {
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

const readBridgeResult = makeBridgeReader(runAdb, BRIDGE);

async function securityGet(feature) {
  const id = crypto.randomBytes(6).toString("hex");
  await runAdb(
    [
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
    ],
    15000,
  );
  return readBridgeResult(id, "securityGet");
}

function bridgeRaw(line) {
  if (!line || line.startsWith("ERR:")) return null;
  if (line.startsWith("BOOL:")) {
    const b = line.slice(5).trim();
    return b === "1" || b === "true" ? "1" : "0";
  }
  if (line.startsWith("VAL:")) return line.slice(4);
  return null;
}

async function main() {
  const oemPath = process.argv[2] ?? defaultOem;
  if (!fs.existsSync(oemPath)) {
    console.error("[oem] 文件不存在:", oemPath);
    process.exit(1);
  }
  const sec = parseOemFile(fs.readFileSync(oemPath, "utf8"));
  console.log("[oem] file:", oemPath);
  let match = 0;
  let mismatch = 0;
  let unread = 0;
  for (const [oemKey, probeId] of Object.entries(OEM_MAP)) {
    const expect = oemToRaw(oemKey, sec[oemKey]);
    if (expect == null) continue;
    const feature = probeFeature[probeId];
    const line = await securityGet(feature);
    const actual = bridgeRaw(line);
    let status;
    if (actual == null) {
      status = "UNREAD";
      unread++;
    } else if (String(actual) === String(expect)) {
      status = "OK";
      match++;
    } else {
      status = "MISMATCH";
      mismatch++;
    }
    console.log(
      `[oem] ${status} ${probeId} oem.${oemKey}=${sec[oemKey] ?? ""} expect=${expect} actual=${actual ?? line}`,
    );
  }
  const notify = sec.lockScreenNotificationPrivacyMode;
  if (notify && notify !== "No change") {
    console.log(
      `[oem] SKIP 锁屏通知 (面板未收录) lockScreenNotificationPrivacyMode=${notify}`,
    );
  }
  console.log(`[oem] summary match=${match} mismatch=${mismatch} unread=${unread}`);
  if (mismatch > 0 || unread > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[oem] FAIL", e.message);
  process.exit(1);
});
