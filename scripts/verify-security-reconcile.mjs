/**
 * 面板读数对账：桥接 securityGet ↔ YAML 中 ADB fallback（与实况面板 fallback 路径一致）
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
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
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
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

function mapLockType(type) {
  const n = Number(type);
  if (Number.isNaN(n) || n === 0) return "none";
  if (n === 65536) return "slide";
  if (n === 131072 || n === 262144) return "pin";
  if (n === 196608 || n === 65536 + 65536) return "pattern";
  return String(n);
}

function bridgeRaw(line) {
  if (line.startsWith("BOOL:")) {
    const b = line.slice(5).trim();
    return b === "1" || b === "true" ? "1" : "0";
  }
  if (line.startsWith("VAL:")) return line.slice(4);
  return null;
}

async function adbFallbackRaw(fb) {
  if (fb.kind === "adb.settings") {
    const v = await runAdb(["shell", "settings", "get", fb.namespace, fb.key]);
    let raw = v.out;
    if (raw === "null" || raw === "") raw = "0";
    if (fb.key === "lockscreen.password_type") return mapLockType(raw);
    if (fb.key === "location_mode") return raw === "0" ? "0" : "1";
    return raw === "1" ? "1" : "0";
  }
  if (fb.kind === "adb.shell") {
    const parts = fb.cmd.trim().split(/\s+/);
    const v = await runAdb(["shell", ...parts]);
    let raw = v.out.trim();
    if (fb.map) {
      const entries = Object.entries(fb.map).sort(
        (a, b) => b[0].length - a[0].length,
      );
      for (const [needle, mapped] of entries) {
        if (raw.includes(needle)) return mapped;
      }
    }
    if (raw.includes("mtp")) return "1";
    if (raw.includes("ptp")) return "2";
    if (raw.includes("midi")) return "3";
    if (
      raw.includes("adb") &&
      !raw.includes("mtp") &&
      !raw.includes("ptp")
    ) {
      return "0";
    }
    return raw;
  }
  return null;
}

async function main() {
  const doc = yaml.load(
    fs.readFileSync(
      path.join(root, "registry", "modules", "oem20_security_probes.yaml"),
      "utf8",
    ),
  );
  const probes = doc.probes ?? [];
  let checked = 0;
  let failed = 0;
  for (const p of probes) {
    const fb = p.probe?.fallback;
    if (!fb) continue;
    const feature = p.probe.feature;
    const line = await securityGet(feature);
    const fromBridge = bridgeRaw(line);
    const fromAdb = await adbFallbackRaw(fb);
    checked++;
    const ok =
      fromBridge != null &&
      fromAdb != null &&
      String(fromBridge) === String(fromAdb);
    const tag = ok ? "OK" : "MISMATCH";
    console.log(
      `[reconcile] ${tag} ${p.id} bridge=${line} adbRaw=${fromAdb} panelRaw=${fromBridge}`,
    );
    if (!ok) failed++;
  }
  console.log(`[reconcile] checked ${checked} fallback probes, failed ${failed}`);
  if (failed > 0) process.exit(1);
  console.log("[reconcile] PASS");
}

main().catch((e) => {
  console.error("[reconcile] FAIL:", e.message);
  process.exit(1);
});
