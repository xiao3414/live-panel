import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listDevices } from "./adb.js";
import { resolveAdbPath } from "./resolveAdb.js";
import { appDefaultsPath } from "./paths.js";
import {
  probeResultFromWriteMode,
  readProbeValue,
} from "./probeRunner.js";
import { readSecurityProbeResults } from "./securityProbeRead.js";
import { resetBridgeSession } from "./usdkBroadcast.js";
import type { ProbeSpec } from "./types.js";
import { readModuleByL1 } from "./moduleRead.js";
import { runProbesParallel } from "./runProbesParallel.js";
import { applyProbeWrite, applyProbeWriteValue } from "./writeProbe.js";
import {
  expectedToggleRaw,
  rawMatchesExpected,
} from "./probeWriteFallback.js";
import { executeProbe } from "./probeRunner.js";
import {
  applyWifiAdvancedSettings,
  readWifiAdvancedSettings,
} from "./wifiAdvancedSettings.js";
import {
  applyWifiGeneralSettings,
  readWifiGeneralSettings,
} from "./wifiGeneralSettings.js";
import { connectWifiNetwork, readWifiProfile } from "./wifiNetwork.js";
import {
  applyWifiPreferenceSettings,
  readWifiPreferenceSettings,
} from "./wifiPreferenceSettings.js";
import {
  applyWifiWhitelistSettings,
  readWifiWhitelistSettings,
} from "./wifiWhitelistSettings.js";
import {
  buildLayoutCatalog,
  hasUserLayoutOverride,
  loadBundledLayout,
  loadLayoutForUser,
  resetUserLayout,
  saveUserLayout,
} from "./layoutStore.js";
import {
  deletePanelScheme,
  listPanelSchemes,
  savePanelScheme,
} from "./panelSchemes.js";
import {
  pickOemConfigFile,
  readOemConfigFromPath,
} from "./oemConfigFile.js";
import {
  importOemConfigPick,
  listOemConfigCache,
  loadOemConfigCache,
  refreshOemConfigCache,
  removeOemConfigCache,
} from "./oemConfigCache.js";
import {
  listLayouts,
  loadAppConfig,
  loadRegistry,
} from "./registry.js";
import { classifyDeviceError } from "./probeSupport.js";
import {
  ensureDeviceBridge,
  getDeviceBridgeStatus,
} from "./deviceBridge.js";
import { reconcileDeviceSerial } from "./deviceSerial.js";
import { probeWlanBridge } from "./wlanBridgeProbe.js";
import type { AppConfig } from "./types.js";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let config: AppConfig = loadAppConfig();
let mainWin: BrowserWindow | null = null;
config = {
  ...config,
  adb: {
    ...config.adb,
    path: resolveAdbPath(config.adb.path),
  },
};
let registryCache = loadRegistry();

function securityBridgeFeature(spec: ProbeSpec): string | null {
  if (spec.probe.kind === "security.bridge") return spec.probe.feature;
  return null;
}

function probeResultFromWriteValue(spec: ProbeSpec, value: string) {
  const display = spec.labels?.[value] ?? value;
  return {
    probeId: spec.id,
    ok: true,
    raw: value,
    display,
    at: Date.now(),
  };
}

function shouldFastReturnAfterWrite(_spec: ProbeSpec): boolean {
  return false;
}

async function readBackAfterWrite(
  config: AppConfig,
  spec: ProbeSpec,
  byId: Map<string, ProbeSpec>,
): Promise<import("./types.js").ProbeResult> {
  const delayMs = spec.id === "sec.usb_mode" ? 900 : 450;
  await new Promise((r) => setTimeout(r, delayMs));
  return executeProbe(config, spec, byId);
}

function verifyToggleWriteResult(
  spec: ProbeSpec,
  mode: "on" | "off",
  read: import("./types.js").ProbeResult,
): import("./types.js").ProbeResult {
  const expected = expectedToggleRaw(spec, mode);
  if (rawMatchesExpected(spec, expected, read.raw)) return read;
  return {
    ...read,
    ok: false,
    error: `写回后读数不一致：期望 ${expected}，设备为 ${read.raw ?? "空"}（${read.display}）`,
    display: `写回未生效：${read.display}`,
    supportMessage: "请确认设备未锁策略/OEM 覆盖，或点「立即刷新」对账",
  };
}

function saveDeviceSerial(serial: string) {
  if (config.adb.deviceSerial !== serial) {
    resetBridgeSession();
  }
  config = { ...config, adb: { ...config.adb, deviceSerial: serial } };
  try {
    const defaults = JSON.parse(fs.readFileSync(appDefaultsPath(), "utf8"));
    defaults.adb.deviceSerial = serial;
    fs.writeFileSync(appDefaultsPath(), JSON.stringify(defaults, null, 2));
  } catch {
    /* 开发时 config 只读亦可 */
  }
}

async function ensureConfigDevice(): Promise<AppConfig> {
  const r = await reconcileDeviceSerial(config, saveDeviceSerial);
  config = r.config;
  return config;
}

function createWindow() {
  mainWin = null;
  const win = new BrowserWindow({
    title: config.window.title,
    width: config.window.width,
    height: config.window.height,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
    if (process.env.LIVE_PANEL_DEVTOOLS === "1") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWin = win;
  win.on("closed", () => {
    if (mainWin === win) mainWin = null;
  });
}

app.whenReady().then(() => {
  ipcMain.handle("app:getConfig", () => config);
  ipcMain.handle("registry:get", () => registryCache.registry);
  ipcMain.handle("layouts:list", () => listLayouts());
  ipcMain.handle("layouts:load", (_e, id: string) => loadLayoutForUser(id));
  ipcMain.handle(
    "layouts:save",
    (
      _e,
      id: string,
      layout: unknown,
      meta?: { grid?: { cols?: number; rowHeight?: number }; followViewport?: boolean },
    ) => {
      saveUserLayout(
        id,
        layout as import("./types.js").LayoutFile,
        meta,
      );
      return { ok: true };
    },
  );
  ipcMain.handle("layouts:hasOverride", (_e, id: string) =>
    hasUserLayoutOverride(id),
  );
  ipcMain.handle("layouts:resetDefault", (_e, id: string) =>
    resetUserLayout(id),
  );
  ipcMain.handle("layouts:catalog", (_e, id: string) => {
    const layout = loadLayoutForUser(id);
    registryCache = loadRegistry();
    return buildLayoutCatalog(layout, registryCache.registry);
  });
  ipcMain.handle("layouts:bundled", (_e, id: string) =>
    loadBundledLayout(id),
  );
  ipcMain.handle("panelSchemes:list", (_e, scopeKey: string) =>
    listPanelSchemes(scopeKey),
  );
  ipcMain.handle(
    "panelSchemes:save",
    (_e, scopeKey: string, name: string, widgets: unknown) =>
      savePanelScheme(
        scopeKey,
        name,
        widgets as import("./types.js").LayoutWidget[],
      ),
  );
  ipcMain.handle(
    "panelSchemes:delete",
    (_e, scopeKey: string, schemeId: string) => {
      deletePanelScheme(scopeKey, schemeId);
      return { ok: true };
    },
  );
  ipcMain.handle("oemConfig:listCache", () => listOemConfigCache());
  ipcMain.handle("oemConfig:loadCache", (_e, fileName: string) =>
    loadOemConfigCache(fileName),
  );
  ipcMain.handle("oemConfig:pickAndImport", async () => {
    if (!mainWin) return null;
    const pick = await pickOemConfigFile(mainWin);
    if (!pick) return null;
    return importOemConfigPick(pick);
  });
  ipcMain.handle("oemConfig:refreshCache", (_e, fileName: string) =>
    refreshOemConfigCache(fileName),
  );
  ipcMain.handle("oemConfig:removeCache", (_e, fileName: string) => {
    removeOemConfigCache(fileName);
    return { ok: true };
  });
  ipcMain.handle("adb:listDevices", () => listDevices(config));
  ipcMain.handle("adb:reconcileDevice", async () => {
    const r = await reconcileDeviceSerial(config, saveDeviceSerial);
    config = r.config;
    return {
      serial: config.adb.deviceSerial,
      changed: r.changed,
      message: r.message,
    };
  });
  ipcMain.handle("adb:setDevice", async (_e, serial: string) => {
    saveDeviceSerial(serial);
    if (serial) {
      await ensureDeviceBridge(config);
    }
    return config;
  });
  ipcMain.handle("device:ensureBridge", (_e, force?: boolean) =>
    ensureDeviceBridge(config, { force: Boolean(force) }),
  );
  ipcMain.handle("device:getBridgeStatus", () =>
    getDeviceBridgeStatus(config),
  );
  ipcMain.handle("device:probeWlan", async () => {
    const cfg = await ensureConfigDevice();
    return probeWlanBridge(cfg);
  });
  ipcMain.handle("wifi:readProfile", async () => {
    const cfg = await ensureConfigDevice();
    return readWifiProfile(cfg);
  });
  ipcMain.handle("wifi:readGeneral", async () => {
    const cfg = await ensureConfigDevice();
    return readWifiGeneralSettings(cfg);
  });
  ipcMain.handle("wifi:applyGeneral", async (_e, payload) => {
    const cfg = await ensureConfigDevice();
    return applyWifiGeneralSettings(cfg, payload);
  });
  ipcMain.handle("wifi:readAdvanced", async () => {
    const cfg = await ensureConfigDevice();
    return readWifiAdvancedSettings(cfg);
  });
  ipcMain.handle("wifi:applyAdvanced", async (_e, payload) => {
    const cfg = await ensureConfigDevice();
    return applyWifiAdvancedSettings(cfg, payload);
  });
  ipcMain.handle("wifi:readPreference", async () => {
    const cfg = await ensureConfigDevice();
    return readWifiPreferenceSettings(cfg);
  });
  ipcMain.handle("wifi:applyPreference", async (_e, payload) => {
    const cfg = await ensureConfigDevice();
    return applyWifiPreferenceSettings(cfg, payload);
  });
  ipcMain.handle("wifi:readWhitelist", async () => {
    const cfg = await ensureConfigDevice();
    await ensureDeviceBridge(cfg);
    return readWifiWhitelistSettings(cfg);
  });
  ipcMain.handle("wifi:applyWhitelist", async (_e, payload) => {
    const cfg = await ensureConfigDevice();
    const bridge = await ensureDeviceBridge(cfg);
    if (!bridge.installed && bridge.action === "missing_apk") {
      throw new Error(
        bridge.message ??
          "缺少 USDK 桥接 APK：请在工程目录执行 npm run build:bridge 后重启 LivePanel",
      );
    }
    return applyWifiWhitelistSettings(cfg, payload);
  });
  ipcMain.handle("wifi:connect", async (_e, payload) => {
    const cfg = await ensureConfigDevice();
    return connectWifiNetwork(cfg, payload);
  });

  ipcMain.handle("modules:readByL1", async (_e, l1: string) => {
    registryCache = loadRegistry();
    const cfg = await ensureConfigDevice();
    return readModuleByL1(cfg, registryCache.registry, l1, registryCache.byId);
  });

  ipcMain.handle(
    "probes:write",
    async (_e, probeId: string, mode: "on" | "off") => {
      registryCache = loadRegistry();
      const spec = registryCache.byId.get(probeId);
      if (!spec) throw new Error(`未知 probe: ${probeId}`);
      try {
        await applyProbeWrite(config, spec, mode);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const c = classifyDeviceError(msg);
        return {
          probeId,
          ok: false,
          raw: null,
          display: c.userMessage,
          error: msg,
          supportStatus: c.status === "ok" ? undefined : c.status,
          supportMessage: c.status === "ok" ? undefined : c.userMessage,
          at: Date.now(),
        };
      }
      if (shouldFastReturnAfterWrite(spec)) {
        return probeResultFromWriteMode(spec, mode);
      }
      try {
        const read = await readBackAfterWrite(
          config,
          spec,
          registryCache.byId,
        );
        if (spec.display.type === "toggle") {
          return verifyToggleWriteResult(spec, mode, read);
        }
        return read;
      } catch {
        return probeResultFromWriteMode(spec, mode);
      }
    },
  );

  ipcMain.handle(
    "probes:writeValue",
    async (_e, probeId: string, value: string) => {
      registryCache = loadRegistry();
      const spec = registryCache.byId.get(probeId);
      if (!spec) throw new Error(`未知 probe: ${probeId}`);
      try {
        await applyProbeWriteValue(config, spec, value);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const c = classifyDeviceError(msg);
        return {
          probeId,
          ok: false,
          raw: null,
          display: c.userMessage,
          error: msg,
          supportStatus: c.status === "ok" ? undefined : c.status,
          supportMessage: c.status === "ok" ? undefined : c.userMessage,
          at: Date.now(),
        };
      }
      if (shouldFastReturnAfterWrite(spec)) {
        return probeResultFromWriteValue(spec, value);
      }
      try {
        return await readBackAfterWrite(config, spec, registryCache.byId);
      } catch {
        return probeResultFromWriteValue(spec, value);
      }
    },
  );

  let probesRunInFlight: Promise<unknown> | null = null;
  let probesRunKey = "";

  ipcMain.handle("probes:run", async (_e, probeIds: string[]) => {
    const key = [...probeIds].sort().join("\0");
    if (probesRunInFlight && key === probesRunKey) {
      return probesRunInFlight;
    }
    probesRunKey = key;
    probesRunInFlight = (async () => {
      registryCache = loadRegistry();
      const { byId } = registryCache;
      const cfg = await ensureConfigDevice();
      const securityIds = probeIds.filter((id) => {
        const spec = byId.get(id);
        return spec && securityBridgeFeature(spec) != null;
      });
      const allSecurity =
        securityIds.length >= 2 && securityIds.length === probeIds.length;
      if (securityIds.length > 0) {
        await ensureDeviceBridge(cfg);
      }
      if (allSecurity) {
        return readSecurityProbeResults(cfg, probeIds, byId);
      }
      return runProbesParallel(cfg, probeIds, byId);
    })().finally(() => {
      probesRunInFlight = null;
    });
    return probesRunInFlight;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
