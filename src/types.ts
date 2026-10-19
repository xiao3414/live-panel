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

export type LayoutWidgetUi = {
  collapsed?: boolean;
  minimized?: boolean;
  pinned?: boolean;
};

export type LayoutWidget = {
  id: string;
  probeIds: string[];
  title?: string;
  /** OEM 面包屑，如 Network Configuration › WLAN */
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
  refresh?: { globalMs?: number };
  widgets: LayoutWidget[];
  stash?: LayoutWidget[];
  layoutPrefs?: {
    followViewport?: boolean;
  };
};

export type ProbeMeta = {
  id: string;
  item: string;
  module: string;
  verifyPath?: string;
  refreshMs?: number;
  displayType: string;
  writable?: boolean;
  risk?: string;
  memberIds?: string[];
  labelOn?: string;
  labelOff?: string;
  valueLabels?: Record<string, string>;
  sectionL1?: string;
  sectionTitle?: string;
  sectionHint?: string;
};
