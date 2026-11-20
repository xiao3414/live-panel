/** 统计 OEM Scan JSON 会生成多少条对比期望（与主进程 oemConfigToExpect 规则一致） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, "registry/scan/oem20_scan_manifest.json"),
    "utf8",
  ),
);

function getNested(obj, pathParts) {
  let cur = obj;
  for (const k of pathParts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  return cur;
}

function oemScanValueToExpectRaw(oemPath, oemValue) {
  if (Array.isArray(oemValue)) return oemValue.length ? JSON.stringify(oemValue) : "";
  if (typeof oemValue === "number") return String(oemValue);
  const v = String(oemValue ?? "").trim();
  if (!v || v === "No change") return "";
  if (/^(enable|disable)$/i.test(v)) return v.toLowerCase() === "enable" ? "1" : "0";
  return v;
}

const file = process.argv[2] || path.join(ROOT, "../../../04_配置模板库/OEM/4_Scan/Scan-1.json");
const outer = JSON.parse(fs.readFileSync(file, "utf8"));
const inner = JSON.parse(outer.appConfiguration);
const scanStep = inner.dataCapturePeripherals?.scanStep;
if (!scanStep) {
  console.error("no scanStep");
  process.exit(1);
}

const rows = [];
for (const item of manifest.items) {
  const parts = item.oemPath.split(".");
  const rawVal = getNested(scanStep, parts);
  if (rawVal == null || rawVal === "") continue;
  if (typeof rawVal === "string" && rawVal.trim() === "No change") continue;
  if (Array.isArray(rawVal) && rawVal.length === 0) continue;
  const raw = oemScanValueToExpectRaw(item.oemPath, rawVal);
  if (!raw) continue;
  rows.push({ probeId: item.probeId, titleZh: item.titleZh, raw, oem: String(rawVal) });
}

console.log(`File: ${path.basename(file)}`);
console.log(`Compare expectations: ${rows.length} (skipped "No change" / empty)`);
console.log("--- sample ---");
rows.slice(0, 15).forEach((r) =>
  console.log(`${r.titleZh}\t${r.oem}\t→ expect raw ${r.raw}`),
);
