import fs from "node:fs";
import path from "node:path";
import { dialog, type BrowserWindow } from "electron";

export type OemConfigPickResult = {
  path: string;
  fileName: string;
  content: string;
  mtimeMs: number;
  size: number;
};

export async function pickOemConfigFile(
  win: BrowserWindow,
): Promise<OemConfigPickResult | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: "选择 OEM 配置文件（含 appConfiguration）",
    filters: [
      { name: "OEM JSON", extensions: ["json"] },
      { name: "All", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });
  if (canceled || !filePaths[0]) return null;
  return readOemConfigFromPath(filePaths[0]);
}

export function readOemConfigFromPath(fullPath: string): OemConfigPickResult {
  const st = fs.statSync(fullPath);
  const content = fs.readFileSync(fullPath, "utf8");
  return {
    path: fullPath,
    fileName: path.basename(fullPath),
    content,
    mtimeMs: st.mtimeMs,
    size: st.size,
  };
}
