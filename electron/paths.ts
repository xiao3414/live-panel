import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 开发：仓库根；打包：resources 旁（与 registry 同级） */
export function projectRoot(): string {
  return app.isPackaged ? app.getAppPath() : path.join(__dirname, "..");
}

export function registryRootDir(): string {
  return path.join(projectRoot(), "registry");
}

/** @deprecated 使用 index.yaml 模块化入口 */
export function registryPath(): string {
  const index = path.join(registryRootDir(), "index.yaml");
  if (fs.existsSync(index)) return index;
  return path.join(registryRootDir(), "probes.yaml");
}

export function layoutsDir(): string {
  return path.join(projectRoot(), "layouts");
}

export function appDefaultsPath(): string {
  return path.join(projectRoot(), "config", "app.defaults.json");
}
