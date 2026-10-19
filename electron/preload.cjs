const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("livePanel", {
  getAppConfig: () => ipcRenderer.invoke("app:getConfig"),
  getRegistry: () => ipcRenderer.invoke("registry:get"),
  listLayouts: () => ipcRenderer.invoke("layouts:list"),
  loadLayout: (id) => ipcRenderer.invoke("layouts:load", id),
  saveLayout: (id, layout, meta) =>
    ipcRenderer.invoke("layouts:save", id, layout, meta),
  hasLayoutOverride: (id) => ipcRenderer.invoke("layouts:hasOverride", id),
  resetLayoutDefault: (id) => ipcRenderer.invoke("layouts:resetDefault", id),
  getLayoutCatalog: (id) => ipcRenderer.invoke("layouts:catalog", id),
  listDevices: () => ipcRenderer.invoke("adb:listDevices"),
  reconcileDevice: () => ipcRenderer.invoke("adb:reconcileDevice"),
  setDeviceSerial: (serial) => ipcRenderer.invoke("adb:setDevice", serial),
  ensureDeviceBridge: (force) =>
    ipcRenderer.invoke("device:ensureBridge", Boolean(force)),
  getDeviceBridgeStatus: () => ipcRenderer.invoke("device:getBridgeStatus"),
  probeWlanBridge: () => ipcRenderer.invoke("device:probeWlan"),
  runProbes: (probeIds) => ipcRenderer.invoke("probes:run", probeIds),
  readModuleByL1: (l1) => ipcRenderer.invoke("modules:readByL1", l1),
  writeProbe: (probeId, mode) =>
    ipcRenderer.invoke("probes:write", probeId, mode),
  writeProbeValue: (probeId, value) =>
    ipcRenderer.invoke("probes:writeValue", probeId, value),
  readWifiProfile: () => ipcRenderer.invoke("wifi:readProfile"),
  readWifiGeneralSettings: () => ipcRenderer.invoke("wifi:readGeneral"),
  applyWifiGeneralSettings: (payload) =>
    ipcRenderer.invoke("wifi:applyGeneral", payload),
  readWifiAdvancedSettings: () => ipcRenderer.invoke("wifi:readAdvanced"),
  applyWifiAdvancedSettings: (payload) =>
    ipcRenderer.invoke("wifi:applyAdvanced", payload),
  readWifiPreferenceSettings: () => ipcRenderer.invoke("wifi:readPreference"),
  applyWifiPreferenceSettings: (payload) =>
    ipcRenderer.invoke("wifi:applyPreference", payload),
  readWifiWhitelistSettings: () => ipcRenderer.invoke("wifi:readWhitelist"),
  applyWifiWhitelistSettings: (payload) =>
    ipcRenderer.invoke("wifi:applyWhitelist", payload),
  connectWifiNetwork: (payload) =>
    ipcRenderer.invoke("wifi:connect", payload),
  listPanelSchemes: (scopeKey) =>
    ipcRenderer.invoke("panelSchemes:list", scopeKey),
  savePanelScheme: (scopeKey, name, widgets) =>
    ipcRenderer.invoke("panelSchemes:save", scopeKey, name, widgets),
  deletePanelScheme: (scopeKey, schemeId) =>
    ipcRenderer.invoke("panelSchemes:delete", scopeKey, schemeId),
  listOemConfigCache: () => ipcRenderer.invoke("oemConfig:listCache"),
  loadOemConfigCache: (fileName) =>
    ipcRenderer.invoke("oemConfig:loadCache", fileName),
  pickAndImportOemConfig: () => ipcRenderer.invoke("oemConfig:pickAndImport"),
  refreshOemConfigCache: (fileName) =>
    ipcRenderer.invoke("oemConfig:refreshCache", fileName),
  removeOemConfigCache: (fileName) =>
    ipcRenderer.invoke("oemConfig:removeCache", fileName),
});
