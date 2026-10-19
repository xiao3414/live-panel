import { contextBridge, ipcRenderer } from "electron";
import type {
  AppConfig,
  LayoutFile,
  ProbeResult,
  RegistryFile,
} from "./types.js";
import type { DeviceInfo } from "./adb.js";

export type LivePanelApi = {
  getAppConfig: () => Promise<AppConfig>;
  getRegistry: () => Promise<RegistryFile>;
  listLayouts: () => Promise<{ id: string; name: string }[]>;
  loadLayout: (id: string) => Promise<LayoutFile>;
  listDevices: () => Promise<DeviceInfo[]>;
  setDeviceSerial: (serial: string) => Promise<AppConfig>;
  runProbes: (probeIds: string[]) => Promise<ProbeResult[]>;
};

const api: LivePanelApi = {
  getAppConfig: () => ipcRenderer.invoke("app:getConfig"),
  getRegistry: () => ipcRenderer.invoke("registry:get"),
  listLayouts: () => ipcRenderer.invoke("layouts:list"),
  loadLayout: (id) => ipcRenderer.invoke("layouts:load", id),
  listDevices: () => ipcRenderer.invoke("adb:listDevices"),
  setDeviceSerial: (serial) => ipcRenderer.invoke("adb:setDevice", serial),
  runProbes: (probeIds) => ipcRenderer.invoke("probes:run", probeIds),
};

contextBridge.exposeInMainWorld("livePanel", api);
