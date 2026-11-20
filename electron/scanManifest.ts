import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";

export type ScanManifestItem = {
  oemPath: string;
  probeId: string;
  title: string;
  section: string;
  displayType: string;
  wedgeProperty: string | null;
};

let cached: ScanManifestItem[] | null = null;

export function loadScanManifestItems(): ScanManifestItem[] {
  if (cached) return cached;
  const p = path.join(projectRoot(), "registry/scan/oem20_scan_manifest.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as {
    items: ScanManifestItem[];
  };
  cached = raw.items ?? [];
  return cached;
}

export function probeIdFromOemPath(oemPath: string): string {
  if (!oemPath.includes(".")) return `scan.${oemPath}`;
  return `scan.${oemPath.replace(/\./g, "__")}`;
}
