import fs from "node:fs";
import yaml from "js-yaml";
import path from "node:path";
import { layoutsDir, appDefaultsPath, registryRootDir } from "./paths.js";
import type { AppConfig, LayoutFile, ProbeSpec, RegistryFile } from "./types.js";

type RegistryIndex = {
  version: number;
  meta?: RegistryFile["meta"];
  includes?: string[];
  probes?: ProbeSpec[];
};

type RegistryModuleFile = {
  module?: string;
  probes: ProbeSpec[];
};

export function loadAppConfig(): AppConfig {
  const raw = fs.readFileSync(appDefaultsPath(), "utf8");
  return JSON.parse(raw) as AppConfig;
}

function loadRegistryMerged(): RegistryFile {
  const root = registryRootDir();
  const indexPath = path.join(root, "index.yaml");
  const legacyPath = path.join(root, "probes.yaml");

  if (fs.existsSync(indexPath)) {
    const index = yaml.load(fs.readFileSync(indexPath, "utf8")) as RegistryIndex;
    const probes: ProbeSpec[] = [];
    for (const rel of index.includes ?? []) {
      const modPath = path.join(root, rel.replace(/\//g, path.sep));
      const mod = yaml.load(fs.readFileSync(modPath, "utf8")) as RegistryModuleFile;
      probes.push(...(mod.probes ?? []));
    }
    return {
      version: index.version,
      meta: index.meta,
      probes,
    };
  }

  return yaml.load(fs.readFileSync(legacyPath, "utf8")) as RegistryFile;
}

export function loadRegistry(): {
  registry: RegistryFile;
  byId: Map<string, ProbeSpec>;
} {
  const registry = loadRegistryMerged();
  const byId = new Map<string, ProbeSpec>();
  for (const p of registry.probes) {
    if (p.enabled === false) continue;
    byId.set(p.id, p);
  }
  return { registry, byId };
}

export { loadLayoutForUser as loadLayout } from "./layoutStore.js";

export function listLayouts(): { id: string; name: string; oemModule?: string }[] {
  const dir = layoutsDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const layout = JSON.parse(
        fs.readFileSync(path.join(dir, f), "utf8"),
      ) as LayoutFile & { oemModule?: string };
      return {
        id: f.replace(/\.json$/, ""),
        name: layout.name,
        oemModule: layout.oemModule,
      };
    });
}
