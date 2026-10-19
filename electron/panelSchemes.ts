import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { LayoutWidget } from "./types.js";

export type PanelScheme = {
  id: string;
  name: string;
  widgets: LayoutWidget[];
  savedAt: string;
};

type SchemeStore = {
  version: number;
  schemes: PanelScheme[];
};

function schemesDir(): string {
  const dir = path.join(app.getPath("userData"), "panel-schemes");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function storePath(scopeKey: string): string {
  const safe = scopeKey.replace(/[^\w.-]+/g, "_");
  return path.join(schemesDir(), `${safe}.json`);
}

function readStore(scopeKey: string): SchemeStore {
  const p = storePath(scopeKey);
  if (!fs.existsSync(p)) {
    return { version: 1, schemes: [] };
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as SchemeStore;
}

function writeStore(scopeKey: string, store: SchemeStore): void {
  fs.writeFileSync(storePath(scopeKey), JSON.stringify(store, null, 2), "utf8");
}

export function listPanelSchemes(scopeKey: string): PanelScheme[] {
  return readStore(scopeKey).schemes;
}

export function savePanelScheme(
  scopeKey: string,
  name: string,
  widgets: LayoutWidget[],
): PanelScheme {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("方案名称不能为空");
  const store = readStore(scopeKey);
  const scheme: PanelScheme = {
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    widgets: JSON.parse(JSON.stringify(widgets)) as LayoutWidget[],
    savedAt: new Date().toISOString(),
  };
  store.schemes.unshift(scheme);
  writeStore(scopeKey, store);
  return scheme;
}

export function deletePanelScheme(scopeKey: string, schemeId: string): void {
  const store = readStore(scopeKey);
  store.schemes = store.schemes.filter((s) => s.id !== schemeId);
  writeStore(scopeKey, store);
}
