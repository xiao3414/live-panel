import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { LayoutFile, LayoutWidget, ProbeSpec, RegistryFile } from "./types.js";
import { layoutsDir } from "./paths.js";

export type UserLayoutOverride = {
  version: number;
  widgets: LayoutWidget[];
  stash?: LayoutWidget[];
  grid?: { cols?: number; rowHeight?: number };
  followViewport?: boolean;
};

function userOverridePath(layoutId: string): string {
  const dir = path.join(app.getPath("userData"), "layout-overrides");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${layoutId}.json`);
}

export function loadBundledLayout(layoutId: string): LayoutFile {
  const file = layoutId.endsWith(".json") ? layoutId : `${layoutId}.json`;
  const full = path.join(layoutsDir(), file);
  const raw = fs.readFileSync(full, "utf8");
  return JSON.parse(raw) as LayoutFile;
}

export function loadLayoutForUser(layoutId: string): LayoutFile {
  const base = loadBundledLayout(layoutId);
  const overridePath = userOverridePath(layoutId);
  if (!fs.existsSync(overridePath)) {
    return { ...base, stash: base.stash ?? [] };
  }
  const user = JSON.parse(
    fs.readFileSync(overridePath, "utf8"),
  ) as UserLayoutOverride;
  return {
    ...base,
    widgets: user.widgets ?? base.widgets,
    stash: user.stash ?? [],
    grid: {
      ...base.grid,
      ...(user.grid ?? {}),
    },
    layoutPrefs: {
      followViewport: user.followViewport ?? true,
    },
  };
}

export function hasUserLayoutOverride(layoutId: string): boolean {
  return fs.existsSync(userOverridePath(layoutId));
}

export function saveUserLayout(
  layoutId: string,
  layout: LayoutFile,
  extra?: Pick<UserLayoutOverride, "grid" | "followViewport">,
): void {
  const payload: UserLayoutOverride = {
    version: layout.version,
    widgets: layout.widgets,
    stash: layout.stash ?? [],
    grid: extra?.grid,
    followViewport: extra?.followViewport,
  };
  fs.writeFileSync(
    userOverridePath(layoutId),
    JSON.stringify(payload, null, 2),
    "utf8",
  );
}

export function resetUserLayout(layoutId: string): LayoutFile {
  const overridePath = userOverridePath(layoutId);
  if (fs.existsSync(overridePath)) fs.unlinkSync(overridePath);
  return loadBundledLayout(layoutId);
}

export function defaultWidgetForProbe(p: ProbeSpec): LayoutWidget {
  const id = `w_${p.id.replace(/\./g, "_")}`;
  let w = 3;
  let h = 2;
  if (p.display.type === "toggle") {
    w = 2;
    h = 2;
  } else if (
    p.display.type === "wifi_general_settings_form" ||
    p.display.type === "wifi_network_form" ||
    p.display.type === "wifi_preference_settings_form" ||
    p.display.type === "wifi_whitelist_settings_form" ||
    p.display.type === "wifi_advanced_settings_form"
  ) {
    w = 5;
    h = 8;
  } else if (p.display.type === "group") {
    w = 6;
    h = 2;
  }
  return {
    id,
    probeIds: [p.id],
    title: p.item,
    x: 0,
    y: 0,
    w,
    h,
  };
}

export type LayoutCatalogEntry = {
  widget: LayoutWidget;
  source: "stash" | "registry";
  module: string;
  probeId: string;
};

export function buildLayoutCatalog(
  layout: LayoutFile,
  registry: RegistryFile,
): LayoutCatalogEntry[] {
  const onPanel = new Set<string>();
  for (const w of layout.widgets) {
    for (const pid of w.probeIds) onPanel.add(pid);
  }
  const entries: LayoutCatalogEntry[] = [];

  for (const w of layout.stash ?? []) {
    const pid = w.probeIds[0];
    const spec = registry.probes.find((p) => p.id === pid);
    entries.push({
      widget: w,
      source: "stash",
      module: spec?.module ?? "—",
      probeId: pid,
    });
  }

  for (const p of registry.probes) {
    if (p.enabled === false) continue;
    if (p.display.type === "diff") continue;
    if (onPanel.has(p.id)) continue;
    if (entries.some((e) => e.probeId === p.id)) continue;
    entries.push({
      widget: defaultWidgetForProbe(p),
      source: "registry",
      module: p.module,
      probeId: p.id,
    });
  }

  return entries.sort((a, b) =>
    a.module.localeCompare(b.module, "zh-CN"),
  );
}
