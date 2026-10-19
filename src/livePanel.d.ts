import type { LayoutFile, LayoutWidget } from "./types";

export type DeviceInfo = {
  serial: string;
  state: string;
  model?: string;
};

export type SupportStatus =
  | "ok"
  | "unsupported"
  | "not_allowed"
  | "panel_readonly";

export type ProbeResult = {
  probeId: string;
  ok: boolean;
  raw: string | null;
  display: string;
  error?: string;
  supportStatus?: SupportStatus;
  supportMessage?: string;
  platformCompareExempt?: { message: string };
  at: number;
};

export type LayoutCatalogEntry = {
  widget: {
    id: string;
    probeIds: string[];
    title?: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  source: "stash" | "registry";
  module: string;
  probeId: string;
};

export type LivePanelApi = {
  ensureDeviceBridge?: (force?: boolean) => Promise<{
    ok: boolean;
    installed: boolean;
    action: string;
    message?: string;
  }>;
  getDeviceBridgeStatus?: () => Promise<{
    installed: boolean;
    bundledApk: boolean;
    expectedVersionCode: number;
  }>;
  getAppConfig: () => Promise<{
    adb: { path: string; deviceSerial: string };
    refresh: { globalMs: number };
    window: { title: string };
    oemProject?: string;
  }>;
  readModuleByL1?: (l1: string) => Promise<{
    l1: string;
    catalogPlaceholders: number;
    readableProbeCount: number;
    formCount: number;
    rows: Array<{
      probeId: string;
      item: string;
      module: string;
      kind: "probe" | "form";
      result: ProbeResult;
    }>;
    readAt: number;
  }>;
  getRegistry: () => Promise<{
    probes: Array<{
      id: string;
      item: string;
      module: string;
      verifyPath?: string;
      refreshMs?: number;
      enabled?: boolean;
      display?: { type: string };
      risk?: string;
      write?: unknown | false;
      probe?: { kind?: string; members?: string[] };
      labels?: Record<string, string>;
    }>;
  }>;
  listLayouts: () => Promise<{ id: string; name: string }[]>;
  loadLayout: (id: string) => Promise<LayoutFile>;
  saveLayout?: (
    id: string,
    layout: LayoutFile,
    meta?: {
      grid?: { cols?: number; rowHeight?: number };
      followViewport?: boolean;
    },
  ) => Promise<{ ok: boolean }>;
  hasLayoutOverride?: (id: string) => Promise<boolean>;
  resetLayoutDefault?: (id: string) => Promise<LayoutFile>;
  getLayoutCatalog?: (id: string) => Promise<LayoutCatalogEntry[]>;
  listDevices: () => Promise<DeviceInfo[]>;
  reconcileDevice?: () => Promise<{
    serial: string;
    changed: boolean;
    message?: string;
  }>;
  setDeviceSerial: (serial: string) => Promise<unknown>;
  runProbes: (probeIds: string[]) => Promise<ProbeResult[]>;
  writeProbe: (
    probeId: string,
    mode: "on" | "off",
  ) => Promise<ProbeResult>;
  writeProbeValue?: (probeId: string, value: string) => Promise<ProbeResult>;
  readWifiProfile?: () => Promise<{
    ssid: string | null;
    security: string | null;
    securityLabel: string;
    hidden: boolean | null;
    passwordNote: string;
  }>;
  connectWifiNetwork?: (payload: {
    ssid: string;
    security: "open" | "owe" | "wpa2" | "wpa3" | "wep";
    password?: string;
    hidden?: boolean;
  }) => Promise<void>;
  readWifiGeneralSettings?: () => Promise<Record<string, unknown>>;
  applyWifiGeneralSettings?: (payload: Record<string, unknown>) => Promise<void>;
  readWifiAdvancedSettings?: () => Promise<Record<string, unknown>>;
  applyWifiAdvancedSettings?: (payload: Record<string, unknown>) => Promise<void>;
  readWifiPreferenceSettings?: () => Promise<Record<string, unknown>>;
  applyWifiPreferenceSettings?: (payload: Record<string, unknown>) => Promise<void>;
  readWifiWhitelistSettings?: () => Promise<Record<string, unknown>>;
  applyWifiWhitelistSettings?: (payload: Record<string, unknown>) => Promise<void>;
  listPanelSchemes?: (scopeKey: string) => Promise<PanelScheme[]>;
  savePanelScheme?: (
    scopeKey: string,
    name: string,
    widgets: LayoutWidget[],
  ) => Promise<PanelScheme>;
  deletePanelScheme?: (
    scopeKey: string,
    schemeId: string,
  ) => Promise<{ ok: boolean }>;
  listOemConfigCache?: () => Promise<
    Array<{
      fileName: string;
      sourcePath: string;
      mtimeMs: number;
      size: number;
      importedAt: string;
      stale: boolean;
    }>
  >;
  loadOemConfigCache?: (fileName: string) => Promise<{
    meta: {
      fileName: string;
      sourcePath: string;
      mtimeMs: number;
      size: number;
      importedAt: string;
    };
    template: Record<string, unknown>;
    stale: boolean;
  } | null>;
  pickAndImportOemConfig?: () => Promise<{
    template: Record<string, unknown>;
    fromCache: boolean;
    meta: {
      fileName: string;
      sourcePath: string;
      mtimeMs: number;
      size: number;
      importedAt: string;
    };
  } | null>;
  refreshOemConfigCache?: (fileName: string) => Promise<{
    template: Record<string, unknown>;
    meta: {
      fileName: string;
      sourcePath: string;
      mtimeMs: number;
      size: number;
      importedAt: string;
    };
  }>;
  removeOemConfigCache?: (fileName: string) => Promise<{ ok: boolean }>;
};

export type PanelScheme = {
  id: string;
  name: string;
  widgets: LayoutWidget[];
  savedAt: string;
};

declare global {
  interface Window {
    livePanel: LivePanelApi;
  }
}

export {};
