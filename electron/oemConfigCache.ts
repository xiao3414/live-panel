import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  expectTemplateFromOemConfigFileText,
  type ExpectTemplate,
} from "./oemConfigToExpect.js";
import {
  readOemConfigFromPath,
  type OemConfigPickResult,
} from "./oemConfigFile.js";

export type OemConfigCacheMeta = {
  fileName: string;
  sourcePath: string;
  mtimeMs: number;
  size: number;
  importedAt: string;
};

type CacheEnvelope = {
  version: 1;
  meta: OemConfigCacheMeta;
  template: ExpectTemplate;
};

function cacheDir(): string {
  const dir = path.join(app.getPath("userData"), "oem-config-cache");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cacheFilePath(fileName: string): string {
  const safe = path.basename(fileName);
  if (!safe.toLowerCase().endsWith(".json")) {
    return path.join(cacheDir(), `${safe}.json`);
  }
  return path.join(cacheDir(), safe);
}

function readEnvelope(fileName: string): CacheEnvelope | null {
  const p = cacheFilePath(fileName);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as CacheEnvelope;
  } catch {
    return null;
  }
}

function writeEnvelope(envelope: CacheEnvelope): void {
  fs.writeFileSync(
    cacheFilePath(envelope.meta.fileName),
    JSON.stringify(envelope, null, 2),
    "utf8",
  );
}

function sourceStat(sourcePath: string): { mtimeMs: number; size: number } | null {
  try {
    if (!fs.existsSync(sourcePath)) return null;
    const st = fs.statSync(sourcePath);
    return { mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return null;
  }
}

export function isCacheStale(meta: OemConfigCacheMeta): boolean {
  const st = sourceStat(meta.sourcePath);
  if (!st) return true;
  return st.mtimeMs !== meta.mtimeMs || st.size !== meta.size;
}

export type OemConfigCacheListItem = OemConfigCacheMeta & {
  stale: boolean;
};

export function listOemConfigCache(): OemConfigCacheListItem[] {
  const dir = cacheDir();
  const out: OemConfigCacheListItem[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith(".json")) continue;
    const env = readEnvelope(f);
    if (!env?.meta) continue;
    out.push({
      ...env.meta,
      stale: isCacheStale(env.meta),
    });
  }
  return out.sort((a, b) => a.fileName.localeCompare(b.fileName, "zh-CN"));
}

export function loadOemConfigCache(
  fileName: string,
): { meta: OemConfigCacheMeta; template: ExpectTemplate; stale: boolean } | null {
  const env = readEnvelope(fileName);
  if (!env?.template || !env.meta) return null;
  return {
    meta: env.meta,
    template: env.template,
    stale: isCacheStale(env.meta),
  };
}

function saveFromPick(
  pick: OemConfigPickResult & { mtimeMs: number; size: number },
): CacheEnvelope {
  const template = expectTemplateFromOemConfigFileText(pick.content, {
    sourcePath: pick.path,
    fileName: pick.fileName,
  });
  const envelope: CacheEnvelope = {
    version: 1,
    meta: {
      fileName: pick.fileName,
      sourcePath: pick.path,
      mtimeMs: pick.mtimeMs,
      size: pick.size,
      importedAt: new Date().toISOString(),
    },
    template,
  };
  writeEnvelope(envelope);
  return envelope;
}

export function importOemConfigPick(
  pick: OemConfigPickResult & { mtimeMs: number; size: number },
): { template: ExpectTemplate; fromCache: boolean; meta: OemConfigCacheMeta } {
  const existing = readEnvelope(pick.fileName);
  if (
    existing &&
    existing.meta.sourcePath === pick.path &&
    existing.meta.mtimeMs === pick.mtimeMs &&
    existing.meta.size === pick.size
  ) {
    return {
      template: existing.template,
      fromCache: true,
      meta: existing.meta,
    };
  }
  const env = saveFromPick(pick);
  return { template: env.template, fromCache: false, meta: env.meta };
}

export function refreshOemConfigCache(fileName: string): {
  template: ExpectTemplate;
  meta: OemConfigCacheMeta;
} {
  const env = readEnvelope(fileName);
  if (!env?.meta?.sourcePath) {
    throw new Error("未找到缓存或缺少源文件路径");
  }
  const pick = readOemConfigFromPath(env.meta.sourcePath);
  const st = sourceStat(env.meta.sourcePath);
  if (!st) throw new Error("源文件不存在，无法更新");
  const saved = saveFromPick({ ...pick, ...st });
  return { template: saved.template, meta: saved.meta };
}

export function removeOemConfigCache(fileName: string): void {
  const p = cacheFilePath(fileName);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
