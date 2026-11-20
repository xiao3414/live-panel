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
const layout = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, "layouts/oem20-data-capture-scanner-panel.json"),
    "utf8",
  ),
);
const yaml = fs.readFileSync(
  path.join(ROOT, "registry/modules/oem20_scan_probes.yaml"),
  "utf8",
);

const ids = new Set(manifest.items.map((i) => i.probeId));
const layoutIds = layout.widgets.flatMap((w) => w.probeIds);
const missing = layoutIds.filter(
  (id) => !ids.has(id) && !id.startsWith("scan.module."),
);
if (missing.length) {
  console.error("[verify:scan] layout probe not in manifest:", missing.slice(0, 5));
  process.exit(1);
}
if (manifest.itemCount !== 129 || ids.size !== 129) {
  console.error("[verify:scan] expected 129 items, got", ids.size);
  process.exit(1);
}
const leafLines = yaml.match(/^\s+- id: scan\.(?!module\.)/gm) ?? [];
const moduleLines = yaml.match(/^\s+- id: scan\.module\./gm) ?? [];
if (leafLines.length !== 129) {
  console.error("[verify:scan] yaml leaf probe count", leafLines.length);
  process.exit(1);
}
if (moduleLines.length < 12) {
  console.error("[verify:scan] expected >=12 scan modules, got", moduleLines.length);
  process.exit(1);
}
if (layout.layoutVersion !== 16) {
  console.error("[verify:scan] layoutVersion should be 16");
  process.exit(1);
}
const moduleWidgets = layout.widgets.filter((w) =>
  w.probeIds[0]?.startsWith("scan.module."),
);
if (moduleWidgets.length !== moduleLines.length) {
  console.error(
    "[verify:scan] module widgets",
    moduleWidgets.length,
    "vs yaml",
    moduleLines.length,
  );
  process.exit(1);
}
console.log(
  "[verify:scan] OK — 129 leaf probes,",
  moduleLines.length,
  "SOTI modules, layout widgets",
  layout.widgets.length,
);
