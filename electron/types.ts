export type AppConfig = {
  appId: string;
  productName: string;
  window: {
    title: string;
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
  };
  adb: {
    path: string;
    deviceSerial: string;
  };
  refresh: { globalMs: number };
  /** 实况面板 OEM 项目配置（侧栏说明、模块集合） */
  oemProject?: string;
  paths: {
    registry: string;
    layoutsDir: string;
    policiesDir: string;
  };
};

export type WriteSpec =
  | {
      kind: "adb.settings";
      namespace: string;
      key: string;
      values: { on: string; off: string };
    }
  | {
      kind: "adb.shell";
      onCmd: string;
      offCmd: string;
    }
  | {
      kind: "security.bridge";
      feature: string;
    };

export type ProbeSpec = {
  id: string;
  /** OEM L1 域名，批量模块读用 */
  l1?: string;
  module: string;
  item: string;
  display: { type: string };
  labels?: Record<string, string>;
  probe: ProbeRunnerSpec;
  /** 写入后快速回读（避免 dumpsys 等慢命令） */
  readAfterWrite?: ProbeRunnerSpec;
  write?: WriteSpec | false;
  refreshMs?: number;
  sotiKey?: string;
  risk?: string;
  verifyPath?: string;
  enabled?: boolean;
};

export type ProbeRunnerSpec =
  | { kind: "adb.settings"; namespace: string; key: string }
  | {
      kind: "adb.shell";
      cmd: string;
      parse?: "regex" | "contains";
      pattern?: string;
      map?: Record<string, string>;
    }
  | { kind: "usdk"; api: string; fallback?: ProbeRunnerSpec }
  | { kind: "security.bridge"; feature: string; fallback?: ProbeRunnerSpec }
  | {
      kind: "static";
      note?: string;
      members?: string[];
      sectionL1?: string;
      sectionTitle?: string;
      sectionHint?: string;
    };

export type RegistryFile = {
  version: number;
  meta?: Record<string, string>;
  probes: ProbeSpec[];
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
  /** 平台强制，不参与 OEM JSON 不符对比 */
  platformCompareExempt?: { message: string };
  at: number;
};

export type LayoutWidgetUi = {
  collapsed?: boolean;
  minimized?: boolean;
  pinned?: boolean;
};

export type LayoutWidget = {
  id: string;
  probeIds: string[];
  title?: string;
  oemPath?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  showDiff?: boolean;
  ui?: LayoutWidgetUi;
};

export type LayoutFile = {
  version: number;
  name: string;
  description?: string;
  oemModule?: string;
  grid: {
    cols: number;
    rowHeight: number;
    margin?: [number, number];
    compactType?: "vertical" | "horizontal" | null;
  };
  refresh?: { globalMs?: number; pauseWhenHidden?: boolean };
  widgets: LayoutWidget[];
  stash?: LayoutWidget[];
  layoutPrefs?: {
    followViewport?: boolean;
  };
};
