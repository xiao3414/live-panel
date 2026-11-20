import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { PanelErrorBoundary } from "./components/PanelErrorBoundary";
import { ExpectCompareBar } from "./components/ExpectCompareBar";
import {
  compareTemplateToValues,
  type CompareRow,
  type ExpectTemplate,
} from "./expectCompare";
import { isProbeWritable } from "./probeWritable";
import { OemFocusPanel } from "./components/OemFocusPanel";
import { OemL4Catalog } from "./components/OemL4Catalog";
import { PanelComposerToolbar } from "./components/PanelComposerToolbar";
import { OemModuleMenu } from "./components/OemModuleMenu";
import { OemNavBreadcrumb } from "./components/OemNavBreadcrumb";
import { OemNavBar } from "./components/OemNavBar";
import { OemConfigModuleSidebar } from "./components/OemConfigModuleSidebar";
import { OemConfigModuleHub } from "./components/OemConfigModuleHub";
import { LivePanelProjectCatalog } from "./components/LivePanelProjectCatalog";
import { OemProjectOverview } from "./components/OemProjectOverview";
import {
  listLivePanelProjects,
  modulesForProject,
  resolveOemProject,
} from "./navigation/oemProject";
import { WidgetLibrary } from "./components/WidgetLibrary";
import { defaultWidgetForProbeMeta } from "./layout/defaultWidget";
import { migrateLegacyScanProbeId } from "./layout/scanProbeLegacyMap";
import {
  defaultL2IdForL1,
  findL1,
  findL2,
  findL4,
  oemPathForL2,
  panelSchemeScope,
  resolveLayoutId,
  type OemL4Node,
  type PanelPreset,
} from "./navigation/oemNavTree";
import type {
  LayoutCatalogEntry,
  LivePanelApi,
  PanelScheme,
} from "./livePanel.d";
import {
  formatProbeErrorMessage,
  isProbeLocalSignError,
} from "./formatProbeError";
import {
  autoArrangeWidgets,
  isLayoutProbablyCorrupt,
} from "./layout/autoArrange";
import { bumpWidgetGridHeight } from "./layout/bumpWidgetGridHeight";
import {
  normalizeScannerLayout,
  SCANNER_PANEL_LAYOUT_ID,
  scannerLayoutDrifted,
} from "./layout/scannerPanelLayout";
import { responsiveGrid } from "./layout/responsiveGrid";
import type { LayoutFile, LayoutWidget, ProbeMeta, ProbeResult } from "./types";

export default function App() {
  if (!window.livePanel) {
    return (
      <main className="app-main" style={{ padding: 24 }}>
        <h1>实况面板</h1>
        <p style={{ color: "var(--err)" }}>
          未加载 Electron 接口（window.livePanel 为空）。
        </p>
        <p style={{ color: "var(--muted)" }}>
          请关闭后通过 <strong>LivePanel.lnk</strong> /{" "}
          <strong>start-livepanel.bat</strong> 重新启动（勿用浏览器打开 5173）。
        </p>
      </main>
    );
  }
  return <AppReady api={window.livePanel} />;
}

const NAV_STORAGE_KEY = "livepanel.oemNav";

type LivePanelNavView = "catalog" | "projectHome" | "config";

type StoredNav = {
  view: LivePanelNavView;
  projectId: string | null;
  l1: string | null;
  l2: string | null;
  l4: string | null;
};

function readStoredNav(): StoredNav {
  const fallback: StoredNav = {
    view: "catalog",
    projectId: null,
    l1: null,
    l2: null,
    l4: null,
  };
  try {
    const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<StoredNav> & {
      l1?: string | null;
      l2?: string | null;
      l4?: string | null;
    };
    if (p.view === "catalog") return { ...fallback, view: "catalog" };
    if (p.view === "projectHome" && p.projectId) {
      return {
        view: "projectHome",
        projectId: p.projectId,
        l1: null,
        l2: null,
        l4: null,
      };
    }
    if (p.view === "config" && p.projectId) {
      const l1 =
        p.l1 && findL1(p.l1) ? p.l1 : null;
      return {
        view: "config",
        projectId: p.projectId,
        l1,
        l2: l1 && p.l2 ? p.l2 : null,
        l4: l1 && p.l2 && p.l4 ? p.l4 : null,
      };
    }
    if (p.l1 && findL1(p.l1)) {
      return {
        view: "config",
        projectId: p.projectId ?? "oemconfig",
        l1: p.l1,
        l2: p.l2 ?? null,
        l4: p.l4 ?? null,
      };
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function AppReady({ api }: { api: LivePanelApi }) {
  const storedNav = readStoredNav();
  const [navView, setNavView] = useState<LivePanelNavView>(() => storedNav.view);
  const [oemProjectId, setOemProjectId] = useState(
    () => storedNav.projectId ?? "oemconfig",
  );
  const [oemL1Id, setOemL1Id] = useState(() => storedNav.l1);
  const [oemL2Id, setOemL2Id] = useState<string | null>(() => storedNav.l2);
  const [oemL4Id, setOemL4Id] = useState<string | null>(() => storedNav.l4);
  const [layout, setLayout] = useState<LayoutFile | null>(null);
  const [probeMeta, setProbeMeta] = useState<Map<string, ProbeMeta>>(new Map());
  const [values, setValues] = useState<Map<string, ProbeResult>>(new Map());
  const [devices, setDevices] = useState<
    { serial: string; state: string; model?: string }[]
  >([]);
  const [serial, setSerial] = useState("");
  const [adbError, setAdbError] = useState<string | null>(null);
  const [refreshMs, setRefreshMs] = useState(12000);
  const pauseRefreshWhenHiddenRef = useRef(true);
  const timerRef = useRef<number | null>(null);
  const refreshBusyRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const writeBusyRef = useRef<Set<string>>(new Set());
  const [gridWidth, setGridWidth] = useState(1100);
  const [writingProbeId, setWritingProbeId] = useState<string | null>(null);
  const writingProbeIdRef = useRef<string | null>(null);
  writingProbeIdRef.current = writingProbeId;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [catalog, setCatalog] = useState<LayoutCatalogEntry[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const gridHostRef = useRef<HTMLDivElement>(null);
  const manualLayoutRef = useRef(false);
  const layoutBeforeAbnormalRef = useRef<LayoutWidget[] | null>(null);
  const layoutRepairOnceRef = useRef<string | null>(null);
  const scanLayoutRepairOnceRef = useRef(false);
  const dockingLayoutRepairOnceRef = useRef(false);
  const DOCKING_PANEL_LAYOUT_ID = "oem20-data-capture-docking-panel";
  const layoutUndoRef = useRef<LayoutWidget[][]>([]);

  const cloneLayoutWidgets = useCallback(
    (widgets: LayoutWidget[]) =>
      widgets.map((w) => ({
        ...w,
        ui: w.ui ? { ...w.ui } : undefined,
      })),
    [],
  );

  const pushLayoutUndo = useCallback(
    (widgets: LayoutWidget[]) => {
      layoutUndoRef.current = [
        ...layoutUndoRef.current.slice(-24),
        cloneLayoutWidgets(widgets),
      ];
    },
    [cloneLayoutWidgets],
  );
  const lastBreakpointRef = useRef<string | null>(null);
  const pendingInitialAutoRef = useRef(false);
  const reflowTimerRef = useRef<number | null>(null);
  const sidebarReflowTimerRef = useRef<number | null>(null);
  const [followViewport, setFollowViewport] = useState(true);
  const [userSchemes, setUserSchemes] = useState<PanelScheme[]>([]);
  const [schemeMessage, setSchemeMessage] = useState<string | null>(null);
  const [schemeSaving, setSchemeSaving] = useState(false);
  const [devicePrepNote, setDevicePrepNote] = useState<string | null>(null);
  const [devicePrepOk, setDevicePrepOk] = useState<boolean | null>(null);
  const [deviceRefreshBusy, setDeviceRefreshBusy] = useState(false);
  const deviceRefreshBusyRef = useRef(false);
  const [probesReading, setProbesReading] = useState(false);
  const probeRefreshDebounceRef = useRef<number | null>(null);
  const [expectTemplate, setExpectTemplate] = useState<ExpectTemplate | null>(
    null,
  );
  const [expectShowAbnormalOnly, setExpectShowAbnormalOnly] = useState(false);
  const [showEnSubtitles, setShowEnSubtitles] = useState(() => {
    try {
      return sessionStorage.getItem("livepanel.showEnSubtitles") === "1";
    } catch {
      return false;
    }
  });
  const schemeApiReady =
    typeof api.listPanelSchemes === "function" &&
    typeof api.savePanelScheme === "function";

  const oemProject = useMemo(
    () => resolveOemProject(oemProjectId),
    [oemProjectId],
  );
  const projectModules = useMemo(
    () => modulesForProject(oemProject),
    [oemProject],
  );

  const activeL1 = useMemo(
    () => (oemL1Id ? findL1(oemL1Id) : undefined),
    [oemL1Id],
  );
  const activeL2 = useMemo(
    () =>
      oemL1Id && oemL2Id ? findL2(oemL1Id, oemL2Id) : undefined,
    [oemL1Id, oemL2Id],
  );
  const activeL4 = useMemo(
    () =>
      oemL1Id && oemL2Id && oemL4Id
        ? findL4(oemL1Id, oemL2Id, oemL4Id)
        : undefined,
    [oemL1Id, oemL2Id, oemL4Id],
  );
  const layoutId = useMemo(
    () =>
      oemL1Id && oemL2Id ? resolveLayoutId(oemL1Id, oemL2Id) : null,
    [oemL1Id, oemL2Id],
  );

  useEffect(() => {
    if (!layoutId) {
      setExpectTemplate(null);
      return;
    }
    setExpectTemplate((prev) => {
      if (!prev?.scope?.layoutId) return prev;
      if (prev.scope.layoutId === layoutId) return prev;
      return null;
    });
  }, [layoutId]);
  const l2OemPath = useMemo(
    () =>
      oemL1Id && activeL2 ? oemPathForL2(oemL1Id, activeL2) : undefined,
    [oemL1Id, activeL2],
  );
  const schemeScope = useMemo(
    () =>
      oemL1Id && oemL2Id && activeL2?.composable
        ? panelSchemeScope(oemL1Id, oemL2Id)
        : null,
    [oemL1Id, oemL2Id, activeL2?.composable],
  );

  const projectRootCrumb = useMemo(
    () => ({ label: oemProject.shortTitle, projectRoot: true as const }),
    [oemProject.shortTitle],
  );

  const allProjectsCrumb = useMemo(
    () => ({
      label: "所有项目",
      onClick: () => {
        setNavView("catalog");
        setOemL1Id(null);
        setOemL2Id(null);
        setOemL4Id(null);
      },
    }),
    [],
  );

  const configCrumb = useMemo(
    () => ({
      label: "配置项",
      onClick: () => {
        setOemL1Id(null);
        setOemL2Id(null);
        setOemL4Id(null);
      },
    }),
    [],
  );

  const goCatalog = useCallback(() => {
    setNavView("catalog");
    setOemL1Id(null);
    setOemL2Id(null);
    setOemL4Id(null);
  }, []);

  const openProject = useCallback((projectId: string) => {
    const p = resolveOemProject(projectId);
    if (p.status === "planned") return;
    setOemProjectId(projectId);
    setNavView("projectHome");
    setOemL1Id(null);
    setOemL2Id(null);
    setOemL4Id(null);
  }, []);

  const backProjectHome = useCallback(() => {
    setNavView("projectHome");
    setOemL1Id(null);
    setOemL2Id(null);
    setOemL4Id(null);
  }, []);

  const openConfigTree = useCallback(() => {
    if (projectModules.length === 0) return;
    setNavView("config");
    setOemL1Id(null);
    setOemL2Id(null);
    setOemL4Id(null);
  }, [projectModules.length]);

  const goL1Hub = useCallback((l1Id: string) => {
    setOemL1Id(l1Id);
    setOemL4Id(null);
    setOemL2Id(defaultL2IdForL1(l1Id));
  }, []);

  /** 二级/三级配置页 → 上一级（与块标题右键「布局撤回」无关） */
  const navigateBackOneLevel = useCallback(() => {
    if (oemL4Id) {
      setOemL4Id(null);
      return;
    }
    if (oemL2Id) {
      setOemL2Id(null);
      setOemL4Id(null);
      return;
    }
    if (oemL1Id) {
      setOemL1Id(null);
      setOemL2Id(null);
      setOemL4Id(null);
      return;
    }
    if (navView === "config") {
      backProjectHome();
      return;
    }
    if (navView === "projectHome") {
      goCatalog();
    }
  }, [
    oemL4Id,
    oemL2Id,
    oemL1Id,
    navView,
    backProjectHome,
    goCatalog,
  ]);

  const refreshUserSchemes = useCallback(async () => {
    if (!schemeScope || typeof api.listPanelSchemes !== "function") {
      setUserSchemes([]);
      if (schemeScope && !schemeApiReady) {
        setSchemeMessage(
          "方案接口未加载：请完全退出 LivePanel 后重新启动（非仅刷新页面）。",
        );
      }
      return;
    }
    setSchemeMessage(null);
    try {
      setUserSchemes(await api.listPanelSchemes(schemeScope));
    } catch (e) {
      setSchemeMessage(e instanceof Error ? e.message : String(e));
    }
  }, [api, schemeApiReady, schemeScope]);

  useEffect(() => {
    void refreshUserSchemes();
  }, [refreshUserSchemes]);

  useEffect(() => {
    if (!oemL1Id) {
      if (oemL2Id || oemL4Id) {
        setOemL2Id(null);
        setOemL4Id(null);
      }
      return;
    }
    if (!findL1(oemL1Id)) {
      setOemL1Id(null);
      setOemL2Id(null);
      setOemL4Id(null);
      return;
    }
    if (oemL2Id && !findL2(oemL1Id, oemL2Id)) {
      setOemL2Id(null);
      setOemL4Id(null);
    }
    if (oemL4Id && oemL2Id && !findL4(oemL1Id, oemL2Id, oemL4Id)) {
      setOemL4Id(null);
    }
  }, [oemL1Id, oemL2Id, oemL4Id]);

  useEffect(() => {
    if (navView === "config" && projectModules.length === 0) {
      setNavView("projectHome");
    }
  }, [navView, projectModules.length]);

  useEffect(() => {
    sessionStorage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({
        view: navView,
        projectId: navView === "catalog" ? null : oemProjectId,
        l1: navView === "config" ? oemL1Id : null,
        l2: navView === "config" ? oemL2Id : null,
        l4: navView === "config" ? oemL4Id : null,
      }),
    );
  }, [navView, oemProjectId, oemL1Id, oemL2Id, oemL4Id]);

  const gridSpec = useMemo(
    () => responsiveGrid(gridWidth),
    [gridWidth],
  );

  const allProbeIds = useMemo(() => {
    const ids = new Set<string>();
    if (activeL4) ids.add(activeL4.probeId);
    if (!layout) return [...ids];
    for (const w of layout.widgets) {
      for (const id of w.probeIds) {
        const m = probeMeta.get(id);
        if (
          (m?.displayType === "group" ||
            m?.displayType === "scan_module_form" ||
            m?.displayType === "docking_station_form" ||
            m?.displayType === "oem_module_form") &&
          m.memberIds?.length
        ) {
          for (const mid of m.memberIds) ids.add(mid);
        } else if (!m || m.displayType !== "group") {
          ids.add(id);
        }
      }
    }
    return [...ids];
  }, [layout, probeMeta, activeL4]);

  const compareByProbeId = useMemo(() => {
    if (!expectTemplate) return undefined;
    const scope = new Set(allProbeIds);
    const rows = compareTemplateToValues(
      expectTemplate,
      probeMeta,
      values,
      scope.size ? scope : null,
    );
    return new Map(rows.map((r) => [r.probeId, r]));
  }, [expectTemplate, probeMeta, values, allProbeIds]);

  const prepareDeviceComponents = useCallback(
    async (force?: boolean): Promise<boolean> => {
      if (typeof api.ensureDeviceBridge !== "function") {
        setDevicePrepOk(false);
        setDevicePrepNote(
          "device API 未加载：请完全退出 LivePanel 后重新启动",
        );
        return false;
      }
      setDevicePrepOk(null);
      setDevicePrepNote("正在检查/安装 USDK 桥接组件…");
      try {
        const r = await api.ensureDeviceBridge(Boolean(force));
        if (r.action === "missing_apk") {
          setDevicePrepOk(false);
          setDevicePrepNote(
            r.message ??
              "缺少内置 USDK 组件包：请在工程目录执行 npm run build:bridge 后重启",
          );
          return false;
        }
        if (!r.ok && r.action === "failed") {
          setDevicePrepOk(false);
          setDevicePrepNote(r.message ?? "USDK 桥接安装/校验失败");
          return false;
        }
        if (r.action === "no_device") {
          setDevicePrepOk(false);
          setDevicePrepNote(r.message ?? "未选择设备");
          return false;
        }
        setDevicePrepOk(true);
        setDevicePrepNote(
          r.message ??
            (r.action === "installed"
              ? "USDK 桥接已安装/升级完成"
              : "USDK 桥接已就绪"),
        );
        return true;
      } catch (e) {
        setDevicePrepOk(false);
        setDevicePrepNote(
          e instanceof Error ? e.message : "设备组件准备失败",
        );
        return false;
      }
    },
    [api],
  );

  const pickDevice = useCallback(
    async (next: string) => {
      setSerial(next);
      if (next) {
        await api.setDeviceSerial(next);
        await prepareDeviceComponents();
      } else {
        setDevicePrepNote(null);
      }
    },
    [api, prepareDeviceComponents],
  );

  const refreshProbes = useCallback(async () => {
    if (!allProbeIds.length || !serial) return;
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }
    const job = (async () => {
      refreshBusyRef.current = true;
      setProbesReading(true);
      try {
        const results = await api.runProbes(allProbeIds);
        setValues((prev) => {
          const next = new Map(prev);
          for (const r of results) next.set(r.probeId, r);
          return next;
        });
        const failed = results.filter(
          (r) =>
            !r.ok &&
            !isProbeLocalSignError(r) &&
            r.supportStatus !== "unsupported",
        );
        if (failed.length === results.length) {
          setAdbError(
            failed[0]?.error ??
              failed[0]?.display ??
              "全部读数失败：请「刷新设备」检查 USDK 桥接",
          );
        } else if (failed.length > 0) {
          setAdbError(
            `部分项读数失败（${failed.length}/${results.length}），可点「立即刷新」重试`,
          );
        } else {
          setAdbError(null);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setAdbError(msg);
      } finally {
        refreshBusyRef.current = false;
        refreshInFlightRef.current = null;
        setProbesReading(false);
      }
    })();
    refreshInFlightRef.current = job;
    return job;
  }, [api, allProbeIds, serial]);

  const scheduleRefreshProbes = useCallback(
    (delayMs = 400) => {
      if (probeRefreshDebounceRef.current) {
        window.clearTimeout(probeRefreshDebounceRef.current);
      }
      probeRefreshDebounceRef.current = window.setTimeout(() => {
        probeRefreshDebounceRef.current = null;
        void refreshProbes();
      }, delayMs);
    },
    [refreshProbes],
  );

  const refreshProbesRef = useRef(refreshProbes);
  refreshProbesRef.current = refreshProbes;

  const refreshDevices = useCallback(async () => {
    if (deviceRefreshBusyRef.current) return;
    deviceRefreshBusyRef.current = true;
    setDeviceRefreshBusy(true);
    setDevicePrepOk(null);
    setDevicePrepNote("正在刷新设备列表…");
    try {
      const list = await api.listDevices();
      setDevices(list);
      const online = list.filter((d) => d.state === "device");
      if (online.length === 0) {
        setDevicePrepOk(false);
        setDevicePrepNote(null);
        if (list.some((d) => d.state === "unauthorized")) {
          setAdbError("设备未授权：请在设备上点「允许 USB 调试」");
        } else if (list.length) {
          setAdbError("设备为 offline，请重新插拔 USB 或换线");
        } else {
          setAdbError("未检测到设备（请确认 USB 调试已开）");
        }
        return;
      }
      setAdbError(null);

      let activeSerial = serial;
      if (typeof api.reconcileDevice === "function") {
        const sync = await api.reconcileDevice();
        if (sync.serial) {
          activeSerial = sync.serial;
          setSerial(sync.serial);
        }
      }

      if (
        !activeSerial ||
        !online.some((d) => d.serial === activeSerial)
      ) {
        activeSerial = online[0]!.serial;
        setSerial(activeSerial);
        await api.setDeviceSerial(activeSerial);
      }

      const bridgeOk = await Promise.race([
        prepareDeviceComponents(true),
        new Promise<boolean>((resolve) =>
          window.setTimeout(() => resolve(false), 120_000),
        ),
      ]);
      if (!bridgeOk) {
        setDevicePrepOk(false);
        setDevicePrepNote((prev) =>
          prev?.includes("桥接")
            ? `${prev}（超时 120s，可重试或检查 USB）`
            : "USDK 桥接检查超时（120s），请重试「刷新设备」",
        );
      } else if (activeSerial && layout) {
        scheduleRefreshProbes(280);
      }
      if (online.length > 1 && !serial) {
        setAdbError("检测到多台设备：请确认顶栏「设备」下拉框选中目标机器");
      }
    } catch (e) {
      setDevicePrepOk(false);
      setDevicePrepNote(null);
      setAdbError(e instanceof Error ? e.message : String(e));
    } finally {
      deviceRefreshBusyRef.current = false;
      setDeviceRefreshBusy(false);
    }
  }, [api, layout, prepareDeviceComponents, scheduleRefreshProbes, serial]);

  useEffect(() => {
    (async () => {
      const cfg = await api.getAppConfig();
      setSerial(cfg.adb.deviceSerial);
      setRefreshMs(cfg.refresh.globalMs);
      const reg = await api.getRegistry();
      const meta = new Map<string, ProbeMeta>();
      for (const p of reg.probes) {
        if (p.enabled === false) continue;
        const labels = p.labels as Record<string, string> | undefined;
        meta.set(p.id, {
          id: p.id,
          item: p.item,
          itemZh: (p as { itemZh?: string }).itemZh,
          module: p.module,
          verifyPath: p.verifyPath,
          refreshMs: p.refreshMs,
          displayType: p.display?.type ?? "text",
          writable: isProbeWritable(p),
          risk: p.risk,
          memberIds:
            p.probe?.kind === "static" && "members" in p.probe
              ? (p.probe.members as string[])
              : undefined,
          sectionL1:
            p.probe?.kind === "static" && "sectionL1" in p.probe
              ? (p.probe.sectionL1 as string)
              : undefined,
          sectionTitle:
            p.probe?.kind === "static" && "sectionTitle" in p.probe
              ? (p.probe.sectionTitle as string)
              : undefined,
          sectionHint:
            p.probe?.kind === "static" && "sectionHint" in p.probe
              ? (p.probe.sectionHint as string)
              : undefined,
          labelOn: String(labels?.["1"] ?? labels?.["true"] ?? "开"),
          labelOff: String(labels?.["0"] ?? labels?.["false"] ?? "关"),
          valueLabels: labels
            ? Object.fromEntries(
                Object.entries(labels).map(([k, v]) => [
                  String(k),
                  v == null ? "" : String(v),
                ]),
              )
            : undefined,
        });
      }
      setProbeMeta(meta);
      if (cfg.oemProject) {
        setOemProjectId((prev) =>
          resolveOemProject(prev).status === "planned" ? cfg.oemProject! : prev,
        );
      }
    })().catch(console.error);
  }, [api]);

  const persistLayout = useCallback(
    (next: LayoutFile, opts?: { followViewport?: boolean }) => {
      if (!layoutId || typeof api.saveLayout !== "function") return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      const fv = opts?.followViewport ?? followViewport;
      saveTimerRef.current = window.setTimeout(() => {
        void api.saveLayout!(layoutId, next, {
          grid: { cols: gridSpec.cols, rowHeight: gridSpec.rowHeight },
          followViewport: fv,
        });
      }, 400);
    },
    [api, layoutId, followViewport, gridSpec.cols, gridSpec.rowHeight],
  );

  const applyAutoLayout = useCallback(() => {
      if (!layout || !probeMeta.size) return;
      pushLayoutUndo(layout.widgets);
      const widgets =
        layoutId === SCANNER_PANEL_LAYOUT_ID
          ? normalizeScannerLayout(
              layout.widgets,
              probeMeta,
              gridSpec.cols,
            )
          : autoArrangeWidgets(layout.widgets, probeMeta, gridSpec.cols, {
              preserveOrder: false,
            });
      const next: LayoutFile = {
        ...layout,
        widgets,
        grid: {
          ...layout.grid,
          cols: gridSpec.cols,
          rowHeight: layout.grid.rowHeight ?? gridSpec.rowHeight,
          compactType: layout.grid.compactType ?? "vertical",
        },
      };
      setLayout(next);
      persistLayout(next);
      lastBreakpointRef.current = gridSpec.breakpoint;
    }, [layoutId, layout, probeMeta, gridSpec, persistLayout, pushLayoutUndo]);

  const onConfigSidebarToggleCollapse = useCallback(() => {
    if (!oemL2Id || !layout) return;
    manualLayoutRef.current = false;
    if (sidebarReflowTimerRef.current) {
      window.clearTimeout(sidebarReflowTimerRef.current);
    }
    sidebarReflowTimerRef.current = window.setTimeout(() => {
      const host = gridHostRef.current;
      if (host) {
        setGridWidth(Math.max(320, host.clientWidth - 12));
      }
      applyAutoLayout();
    }, 300);
  }, [oemL2Id, layout, applyAutoLayout]);

  const refreshCatalog = useCallback(async () => {
    if (!layoutId || typeof api.getLayoutCatalog !== "function") return;
    setCatalog(await api.getLayoutCatalog(layoutId));
  }, [api, layoutId]);

  const updateLayout = useCallback(
    (updater: (prev: LayoutFile) => LayoutFile) => {
      setLayout((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        persistLayout(next);
        void refreshCatalog();
        return next;
      });
    },
    [persistLayout, refreshCatalog],
  );

  useEffect(() => {
    if (!layoutId) {
      setLayout(null);
      setCatalog([]);
      return;
    }
    (async () => {
      manualLayoutRef.current = false;
      lastBreakpointRef.current = null;
      pendingInitialAutoRef.current = false;
      const loaded = await api.loadLayout(layoutId);
      const hasOverride =
        typeof api.hasLayoutOverride === "function"
          ? await api.hasLayoutOverride(layoutId)
          : false;
      pendingInitialAutoRef.current = !hasOverride;
      layoutUndoRef.current = [];
      setFollowViewport(loaded.layoutPrefs?.followViewport ?? true);
      setLayout({ ...loaded, stash: loaded.stash ?? [] });
      setRefreshMs(loaded.refresh?.globalMs ?? 12000);
      pauseRefreshWhenHiddenRef.current =
        loaded.refresh?.pauseWhenHidden ?? true;
      await refreshCatalog();
    })().catch(console.error);
  }, [api, layoutId, refreshCatalog]);

  useEffect(() => {
    if (!layout || !probeMeta.size) return;
    if (pendingInitialAutoRef.current) {
      pendingInitialAutoRef.current = false;
      if (layoutId === SCANNER_PANEL_LAYOUT_ID) {
        const widgets = normalizeScannerLayout(
          layout.widgets,
          probeMeta,
          gridSpec.cols,
        );
        if (scannerLayoutDrifted(layout.widgets, probeMeta, gridSpec.cols)) {
          updateLayout((prev) => ({ ...prev, widgets }));
        }
      } else {
        applyAutoLayout();
      }
      return;
    }
    if (!followViewport || manualLayoutRef.current) return;
    if (lastBreakpointRef.current === gridSpec.breakpoint) return;
    if (reflowTimerRef.current) window.clearTimeout(reflowTimerRef.current);
    reflowTimerRef.current = window.setTimeout(() => {
      applyAutoLayout();
    }, 450);
    return () => {
      if (reflowTimerRef.current) window.clearTimeout(reflowTimerRef.current);
    };
  }, [
    layoutId,
    layout,
    probeMeta,
    gridSpec.cols,
    gridSpec.breakpoint,
    followViewport,
    applyAutoLayout,
    updateLayout,
    persistLayout,
  ]);

  /** Scanner：本地缓存坐标漂移（大块空白/块乱序）→ 静默恢复装箱 */
  useEffect(() => {
    if (layoutId !== SCANNER_PANEL_LAYOUT_ID || !layout || !probeMeta.size) {
      return;
    }
    if (manualLayoutRef.current) return;
    if (!scannerLayoutDrifted(layout.widgets, probeMeta, gridSpec.cols)) {
      return;
    }
    const widgets = normalizeScannerLayout(
      layout.widgets,
      probeMeta,
      gridSpec.cols,
    );
    updateLayout((prev) => ({ ...prev, widgets }));
  }, [layoutId, layout, probeMeta, gridSpec.cols, updateLayout]);

  const onLayoutWidgetsChange = useCallback(
    (widgets: LayoutWidget[]) => {
      manualLayoutRef.current = true;
      updateLayout((prev) => {
        pushLayoutUndo(prev.widgets);
        return { ...prev, widgets };
      });
    },
    [updateLayout, pushLayoutUndo],
  );

  const onScanWidgetNeedHeight = useCallback(
    (widgetId: string, gridRows: number) => {
      // Scanner / Display 等表单块：按内容增高，避免底部字段被裁切
      updateLayout((prev) => {
        const nextWidgets = bumpWidgetGridHeight(
          prev.widgets,
          widgetId,
          gridRows,
        );
        if (nextWidgets === prev.widgets) return prev;
        return { ...prev, widgets: nextWidgets };
      });
    },
    [updateLayout],
  );

  const revertLayoutStep = useCallback(() => {
    const stack = layoutUndoRef.current;
    if (!stack.length) return false;
    const prev = stack.pop()!;
    layoutUndoRef.current = stack;
    manualLayoutRef.current = true;
    updateLayout((l) => ({ ...l, widgets: cloneLayoutWidgets(prev) }));
    return true;
  }, [updateLayout, cloneLayoutWidgets]);

  const handleShowAbnormalOnlyChange = useCallback(
    (v: boolean) => {
      if (v && layout) {
        layoutBeforeAbnormalRef.current = layout.widgets.map((w) => ({ ...w }));
      }
      setExpectShowAbnormalOnly(v);
      if (!v && layout) {
        const snap = layoutBeforeAbnormalRef.current;
        layoutBeforeAbnormalRef.current = null;
        if (snap && !isLayoutProbablyCorrupt(snap, gridSpec.cols)) {
          manualLayoutRef.current = true;
          onLayoutWidgetsChange(snap);
        } else {
          manualLayoutRef.current = false;
          applyAutoLayout();
        }
      }
    },
    [layout, gridSpec.cols, onLayoutWidgetsChange, applyAutoLayout],
  );

  useEffect(() => {
    if (!layoutId || !layout || !probeMeta.size) return;
    if (layoutRepairOnceRef.current === layoutId) return;
    if (!isLayoutProbablyCorrupt(layout.widgets, gridSpec.cols)) return;
    layoutRepairOnceRef.current = layoutId;
    manualLayoutRef.current = false;
    applyAutoLayout();
  }, [
    layoutId,
    layout,
    probeMeta.size,
    gridSpec.cols,
    applyAutoLayout,
  ]);

  useEffect(() => {
    scanLayoutRepairOnceRef.current = false;
    dockingLayoutRepairOnceRef.current = false;
  }, [layoutId]);

  /** Docking：旧三卡/placeholder → 恢复 WiFi 风格整页表单（layoutVersion≥3） */
  useEffect(() => {
    if (layoutId !== DOCKING_PANEL_LAYOUT_ID || !layout || !probeMeta.size) return;
    if (dockingLayoutRepairOnceRef.current) return;
    if (typeof api.resetLayoutDefault !== "function") return;

    const hasUnknown = layout.widgets.some((w) =>
      w.probeIds.some((id) => !probeMeta.has(id)),
    );
    const layoutVer = (layout as LayoutFile & { layoutVersion?: number })
      .layoutVersion;
    const stale = layoutVer == null || layoutVer < 3;
    const missingForm = !layout.widgets.some((w) =>
      w.probeIds.includes("dock.module.station"),
    );
    if (!hasUnknown && !stale && !missingForm) return;

    dockingLayoutRepairOnceRef.current = true;
    void api.resetLayoutDefault!(DOCKING_PANEL_LAYOUT_ID).then((fresh) => {
      manualLayoutRef.current = false;
      pendingInitialAutoRef.current = true;
      layoutUndoRef.current = [];
      setLayout({ ...fresh, stash: [] });
      void refreshCatalog();
    });
  }, [layoutId, layout, probeMeta, api, refreshCatalog]);

  /** Scanner：旧 13 块 probeId / 缺项 → 恢复仓库默认 129+ 分区（SOTI 顺序） */
  useEffect(() => {
    if (layoutId !== SCANNER_PANEL_LAYOUT_ID || !layout || !probeMeta.size) return;
    if (scanLayoutRepairOnceRef.current) return;
    if (typeof api.resetLayoutDefault !== "function") return;

    const probeKnown = (id: string) =>
      probeMeta.has(id) ||
      id.startsWith("meta.layout_section.") ||
      id.startsWith("scan.module.");
    const migratedWidgets = layout.widgets.map((w) => ({
      ...w,
      probeIds: w.probeIds.map((id) => migrateLegacyScanProbeId(id)),
    }));
    const moduleWidgets = migratedWidgets.filter((w) =>
      w.probeIds[0]?.startsWith("scan.module."),
    );
    const hasUnknown = migratedWidgets.some((w) =>
      w.probeIds.some((id) => !probeKnown(id)),
    );
    const layoutVer = (layout as LayoutFile & { layoutVersion?: number })
      .layoutVersion;
    const staleLayout = layoutVer == null || layoutVer < 16;

    if (!hasUnknown && !staleLayout && moduleWidgets.length >= 10) return;

    scanLayoutRepairOnceRef.current = true;
    void api.resetLayoutDefault!(SCANNER_PANEL_LAYOUT_ID).then((fresh) => {
      manualLayoutRef.current = false;
      pendingInitialAutoRef.current = true;
      layoutUndoRef.current = [];
      setLayout({ ...fresh, stash: [] });
      void refreshCatalog();
    });
  }, [layoutId, layout, probeMeta, api, refreshCatalog]);

  const onWidgetUiChange = useCallback(
    (widgetId: string, patch: Partial<LayoutWidget["ui"]>) => {
      updateLayout((prev) => ({
        ...prev,
        widgets: prev.widgets.map((w) =>
          w.id === widgetId ? { ...w, ui: { ...w.ui, ...patch } } : w,
        ),
      }));
    },
    [updateLayout],
  );

  const onRemoveWidget = useCallback(
    (widgetId: string) => {
      updateLayout((prev) => {
        const removed = prev.widgets.find((w) => w.id === widgetId);
        if (!removed) return prev;
        const stash = [...(prev.stash ?? []), { ...removed, ui: undefined }];
        return {
          ...prev,
          widgets: prev.widgets.filter((w) => w.id !== widgetId),
          stash,
        };
      });
    },
    [updateLayout],
  );

  const addProbeToPanel = useCallback(
    (probeId: string) => {
      if (!oemL1Id || !activeL2) return;
      const meta = probeMeta.get(probeId);
      if (!meta) return;
      const path = oemPathForL2(oemL1Id, activeL2);
      updateLayout((prev) => {
        if (prev.widgets.some((w) => w.probeIds[0] === probeId)) return prev;
        const base = defaultWidgetForProbeMeta(meta, path);
        const maxY = prev.widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
        const widget: LayoutWidget = {
          ...base,
          x: 0,
          y: maxY,
          ui: undefined,
        };
        manualLayoutRef.current = true;
        return { ...prev, widgets: [...prev.widgets, widget] };
      });
    },
    [activeL2, oemL1Id, probeMeta, updateLayout],
  );

  const onAddL4ToPanel = useCallback(
    (item: OemL4Node) => addProbeToPanel(item.probeId),
    [addProbeToPanel],
  );

  const onApplyBuiltinPreset = useCallback(
    (preset: PanelPreset) => {
      for (const pid of preset.probeIds) addProbeToPanel(pid);
    },
    [addProbeToPanel],
  );

  const onSaveCurrentScheme = useCallback(
    async (name: string) => {
      if (!layout || !schemeScope || typeof api.savePanelScheme !== "function") {
        setSchemeMessage("无法保存：请完全重启 LivePanel。");
        return;
      }
      if (layout.widgets.length === 0) {
        setSchemeMessage("面板为空，请先添加配置块。");
        return;
      }
      setSchemeSaving(true);
      setSchemeMessage(null);
      try {
        await api.savePanelScheme(schemeScope, name, layout.widgets);
        await refreshUserSchemes();
        setSchemeMessage(`已保存方案「${name}」`);
      } catch (e) {
        setSchemeMessage(e instanceof Error ? e.message : String(e));
      } finally {
        setSchemeSaving(false);
      }
    },
    [api, layout, refreshUserSchemes, schemeScope],
  );

  const onApplyUserScheme = useCallback(
    (scheme: PanelScheme) => {
      const ok = window.confirm(
        `用方案「${scheme.name}」替换当前面板（${scheme.widgets.length} 块）？`,
      );
      if (!ok) return;
      manualLayoutRef.current = true;
      updateLayout((prev) => ({
        ...prev,
        widgets: JSON.parse(JSON.stringify(scheme.widgets)) as LayoutWidget[],
      }));
    },
    [updateLayout],
  );

  const onClearPanel = useCallback(() => {
    if (!layout || layout.widgets.length === 0) return;
    const ok = window.confirm(
      "清空组合面板上的所有块？已保存的「我的方案」不会删除。",
    );
    if (!ok) return;
    manualLayoutRef.current = true;
    updateLayout((prev) => ({
      ...prev,
      stash: [
        ...(prev.stash ?? []),
        ...prev.widgets.map((w) => ({ ...w, ui: undefined })),
      ],
      widgets: [],
    }));
    setSchemeMessage(null);
  }, [layout, updateLayout]);

  const onDeleteUserScheme = useCallback(
    async (schemeId: string) => {
      if (!schemeScope || typeof api.deletePanelScheme !== "function") return;
      const ok = window.confirm("删除该方案？");
      if (!ok) return;
      await api.deletePanelScheme(schemeScope, schemeId);
      await refreshUserSchemes();
    },
    [api, refreshUserSchemes, schemeScope],
  );

  const onAddFromCatalog = useCallback(
    (entry: LayoutCatalogEntry) => {
      updateLayout((prev) => {
        const stash = (prev.stash ?? []).filter(
          (w) => w.probeIds[0] !== entry.probeId,
        );
        const maxY = prev.widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
        const widget: LayoutWidget = {
          ...entry.widget,
          x: 0,
          y: maxY,
          ui: undefined,
        };
        return {
          ...prev,
          stash,
          widgets: [...prev.widgets, widget],
        };
      });
      setLibraryOpen(false);
    },
    [updateLayout],
  );

  const onRestoreAutoLayout = useCallback(() => {
    manualLayoutRef.current = false;
    applyAutoLayout();
  }, [applyAutoLayout]);

  const onResetLayout = useCallback(async () => {
    if (!layoutId || typeof api.resetLayoutDefault !== "function") return;
    const ok = window.confirm(
      "将恢复「出厂 JSON」模块列表与坐标（不是自动排版）。继续？",
    );
    if (!ok) return;
    const fresh = await api.resetLayoutDefault(layoutId);
    manualLayoutRef.current = false;
    pendingInitialAutoRef.current = true;
    setLayout({ ...fresh, stash: [] });
    await refreshCatalog();
  }, [api, layoutId, refreshCatalog]);

  useEffect(() => {
    void refreshDevices();
    // 仅启动时拉一次设备列表；勿依赖 refreshDevices，否则会与「刷新中」状态形成死循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = gridHostRef.current;
    if (!el) return;
    const update = () => {
      setGridWidth(Math.max(320, el.clientWidth - 12));
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [navView, oemL1Id, oemL2Id]);

  useEffect(() => {
    if (!serial) {
      setValues(new Map());
      return;
    }
  }, [serial]);

  useEffect(() => {
    if (!layout || !serial) return;
    scheduleRefreshProbes(180);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (
        pauseRefreshWhenHiddenRef.current &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      if (
        writingProbeIdRef.current ||
        deviceRefreshBusyRef.current ||
        refreshBusyRef.current
      ) {
        return;
      }
      void refreshProbesRef.current();
    }, refreshMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (probeRefreshDebounceRef.current) {
        window.clearTimeout(probeRefreshDebounceRef.current);
        probeRefreshDebounceRef.current = null;
      }
    };
  }, [layout, serial, refreshMs, scheduleRefreshProbes]);

  const onDeviceChange = async (next: string) => {
    await pickDevice(next);
    await refreshProbes();
  };

  const onWriteProbe = useCallback(
    async (probeId: string, mode: "on" | "off") => {
      if (typeof api.writeProbe !== "function") {
        const msg =
          "writeProbe 未加载：请完全退出实况面板（关窗口+关黑色命令行）后重新双击 LivePanel.lnk 启动。";
        setAdbError(msg);
        throw new Error(msg);
      }
      if (writeBusyRef.current.has(probeId)) {
        throw new Error("该项正在写回，请稍候");
      }

      const meta = probeMeta.get(probeId);
      if (meta?.risk === "warn") {
        const ok = window.confirm(
          `「${meta.item}」将写入设备（测试用途，可能与 OEM 策略冲突）。继续？`,
        );
        if (!ok) throw new Error("用户取消写回");
      }

      const labelOn = meta?.labelOn ?? "开";
      const labelOff = meta?.labelOff ?? "关";
      const optimisticRaw = mode === "on" ? "1" : "0";
      writeBusyRef.current.add(probeId);
      setWritingProbeId(probeId);

      setValues((prev) =>
        new Map(prev).set(probeId, {
          probeId,
          ok: true,
          raw: optimisticRaw,
          display: mode === "on" ? labelOn : labelOff,
          at: Date.now(),
        }),
      );

      try {
        const result = await api.writeProbe(probeId, mode);
        setValues((prev) => new Map(prev).set(probeId, result));
        if (!result.ok && !isProbeLocalSignError(result)) {
          const msg = formatProbeErrorMessage(result);
          setAdbError(msg);
          throw new Error(msg);
        }
        if (result.ok) setAdbError(null);
        return result;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const stub = { ok: false as const, error: msg, display: msg };
        if (!isProbeLocalSignError(stub)) {
          setAdbError(formatProbeErrorMessage(stub));
        }
        throw e instanceof Error ? e : new Error(msg);
      } finally {
        writeBusyRef.current.delete(probeId);
        setWritingProbeId((cur) => (cur === probeId ? null : cur));
      }
    },
    [api, probeMeta],
  );

  const onWriteProbeValue = useCallback(
    async (probeId: string, value: string) => {
      if (typeof api.writeProbeValue !== "function") {
        const msg =
          "writeProbeValue 未加载：请完全退出实况面板后重新启动，并确认 USDK 桥接 APK 已升级（versionCode 4）。";
        setAdbError(msg);
        throw new Error(msg);
      }
      if (writeBusyRef.current.has(probeId)) {
        throw new Error("该项正在写回，请稍候");
      }

      const meta = probeMeta.get(probeId);
      if (meta?.risk === "warn") {
        const ok = window.confirm(
          `「${meta.item}」将写入设备（测试用途）。继续？`,
        );
        if (!ok) throw new Error("用户取消写回");
      }

      writeBusyRef.current.add(probeId);
      setWritingProbeId(probeId);

      try {
        const result = await api.writeProbeValue(probeId, value);
        setValues((prev) => new Map(prev).set(probeId, result));
        if (!result.ok && !isProbeLocalSignError(result)) {
          const msg = formatProbeErrorMessage(result);
          setAdbError(msg);
          throw new Error(msg);
        }
        if (result.ok) setAdbError(null);
        return result;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const stub = { ok: false as const, error: msg, display: msg };
        if (!isProbeLocalSignError(stub)) {
          setAdbError(formatProbeErrorMessage(stub));
        }
        throw e instanceof Error ? e : new Error(msg);
      } finally {
        writeBusyRef.current.delete(probeId);
        setWritingProbeId((cur) => (cur === probeId ? null : cur));
      }
    },
    [api, probeMeta],
  );

  const onWriteAllCompareMismatches = useCallback(
    async (mismatchRows: CompareRow[]) => {
      if (
        typeof api.writeProbe !== "function" ||
        typeof api.writeProbeValue !== "function"
      ) {
        setAdbError("写回 API 未加载，请重启实况面板。");
        return;
      }
      const order = [
        "scan.scanSwitch",
        "scan.scanFloatingButton",
        "scan.scannerSelectionStep__internalSelection",
      ];
      const sorted = [...mismatchRows].sort((a, b) => {
        const ia = order.indexOf(a.probeId);
        const ib = order.indexOf(b.probeId);
        const ra = ia < 0 ? 999 : ia;
        const rb = ib < 0 ? 999 : ib;
        return ra - rb || a.probeId.localeCompare(b.probeId);
      });
      const failed: string[] = [];
      let wrote = 0;
      for (const row of sorted) {
        const meta = probeMeta.get(row.probeId);
        // ProbeMeta 已在加载 registry 时算好 writable；勿再对 meta 调 isProbeWritable（缺 probe/display）
        if (!meta || !meta.writable) {
          failed.push(`${meta?.itemZh ?? meta?.item ?? row.probeId}（不可写）`);
          continue;
        }
        if (meta.risk === "warn") {
          const ok = window.confirm(
            `「${meta.item}」将按 JSON 写回设备。继续写剩余 ${sorted.length} 项？`,
          );
          if (!ok) break;
        }
        try {
          // Scan 项统一走 raw 写回（Enable/Short/枚举文案由 toScanWedgeWriteValue 归一）
          // toggle：Enable/Disable/1/0 一律走 writeProbe on|off，避免 settings 收到「Enable」被拒
          let result;
          const er = String(row.expectedRaw ?? "").trim();
          const erLower = er.toLowerCase();
          if (meta.displayType === "toggle") {
            if (
              er === "1" ||
              erLower === "true" ||
              erLower === "enable" ||
              erLower === "enabled" ||
              erLower === "on" ||
              erLower === "auto"
            ) {
              result = await api.writeProbe(row.probeId, "on");
            } else if (
              er === "0" ||
              erLower === "false" ||
              erLower === "disable" ||
              erLower === "disabled" ||
              erLower === "off" ||
              erLower === "manual"
            ) {
              result = await api.writeProbe(row.probeId, "off");
            } else {
              result = await api.writeProbeValue(row.probeId, er);
            }
          } else {
            result = await api.writeProbeValue(row.probeId, er);
          }
          setValues((prev) => new Map(prev).set(row.probeId, result));
          if (!result.ok) {
            failed.push(
              `${meta.itemZh ?? meta.item}：${result.error ?? result.display}`,
            );
          } else {
            wrote++;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          failed.push(`${meta.itemZh ?? meta.item}：${msg}`);
          break;
        }
        await new Promise((r) => setTimeout(r, 450));
      }
      await refreshProbes();
      if (failed.length) {
        setAdbError(
          `按 JSON 写回：成功 ${wrote}/${sorted.length}。失败：${failed.slice(0, 4).join("；")}${failed.length > 4 ? "…" : ""}`,
        );
      } else {
        setAdbError(null);
      }
    },
    [api, probeMeta, refreshProbes],
  );

  const connected = devices.some((d) => d.serial === serial && d.state === "device");
  const showComposerChrome = Boolean(
    activeL2?.composable && oemL2Id && !oemL4Id && layout && serial,
  );

  return (
    <>
      <header className="app-header">
        <h1>实况面板</h1>
        <span
          className={`status-dot ${connected ? "ok" : serial ? "err" : ""}`}
          title={connected ? "已连接" : "未连接"}
        />
        <label>
          设备
          <select
            value={serial}
            onChange={(e) => onDeviceChange(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="">— 选择 —</option>
            {devices.map((d) => (
              <option key={d.serial} value={d.serial}>
                {d.serial}
                {d.model ? ` (${d.model})` : ""} — {d.state}
              </option>
            ))}
          </select>
        </label>
        {navView !== "catalog" ? (
          <>
            <button type="button" className="secondary" onClick={goCatalog}>
              所有项目
            </button>
            <span
              className="header-project-pill"
              title={`项目：${oemProject.id}`}
            >
              {oemProject.shortTitle}
            </span>
          </>
        ) : null}
        <button
          type="button"
          className="secondary"
          disabled={deviceRefreshBusy}
          onClick={() => void refreshDevices()}
        >
          {deviceRefreshBusy ? "刷新中…" : "刷新设备"}
        </button>
        <button
          type="button"
          onClick={() => void refreshProbes()}
          disabled={!serial || probesReading}
        >
          {probesReading ? "读取中…" : "立即刷新"}
        </button>
        {showComposerChrome ? (
          <>
            <button
              type="button"
              className="secondary"
              onClick={() => void onResetLayout()}
            >
              恢复出厂布局
            </button>
            <label
              className="header-check"
              title="窗口变宽/变窄时按 breakpoint 重新自动排版"
            >
              <input
                type="checkbox"
                checked={followViewport}
                onChange={(e) => {
                  const v = e.target.checked;
                  setFollowViewport(v);
                  manualLayoutRef.current = false;
                  if (layout) persistLayout(layout, { followViewport: v });
                  if (v) applyAutoLayout();
                }}
              />
              随窗口自适应
            </label>
          </>
        ) : null}
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          开关即时写设备；后台约 {Math.round(refreshMs / 1000)}s 刷新读数
          {probesReading ? " · 正在从设备读取…" : ""}
        </span>
        {devicePrepNote ? (
          <span
            style={{
              color:
                devicePrepOk === false
                  ? "var(--err)"
                  : devicePrepOk === true
                    ? "var(--ok, #3dd68c)"
                    : "var(--muted)",
              fontSize: "0.78rem",
              maxWidth: 420,
            }}
          >
            {devicePrepNote}
          </span>
        ) : null}
        {adbError ? (
          <span
            className="app-header__err"
            title={adbError}
          >
            {adbError}
          </span>
        ) : null}
      </header>
      <main className="app-main" ref={mainRef}>
        {navView === "catalog" ? (
          <LivePanelProjectCatalog
            projects={listLivePanelProjects()}
            onOpenProject={openProject}
          />
        ) : (
          <div
            className={`oem-workspace${
              navView === "config" ? " oem-workspace--config" : ""
            }${
              navView === "config" && oemL2Id ? " oem-workspace--panel" : ""
            }`}
          >
            {navView === "config" && oemL1Id ? (
              <OemConfigModuleSidebar
                modules={projectModules}
                activeL1Id={oemL1Id}
                onBackProjectHome={backProjectHome}
                onSelectL1={goL1Hub}
                onToggleCollapse={onConfigSidebarToggleCollapse}
              />
            ) : null}
            <div className="oem-workspace__main" ref={gridHostRef}>
              {!serial ? (
                <div className="oem-device-banner">
                  {!devices.length ? (
                    <p>请连接 Android 设备并开启 USB 调试，然后点「刷新设备」。</p>
                  ) : !serial ? (
                    <p>已在列表中看到设备，请在上方的「设备」下拉框选择序列号。</p>
                  ) : null}
                  {devices.length ? (
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                      {devices.map((d) => (
                        <li key={d.serial}>
                          {d.model ?? d.serial} — {d.state}
                          {d.state === "device" ? (
                            <button
                              type="button"
                              className="secondary"
                              style={{ marginLeft: 8, padding: "2px 8px" }}
                              onClick={() => onDeviceChange(d.serial)}
                            >
                              选用
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {navView === "projectHome" ? (
                <>
                  <div className="oem-nav-shell">
                    <OemNavBreadcrumb
                      crumbs={[allProjectsCrumb, { label: oemProject.shortTitle }]}
                    />
                  </div>
                  <OemProjectOverview
                    project={oemProject}
                    moduleCount={projectModules.length}
                    onOpenConfig={openConfigTree}
                  />
                </>
              ) : null}

              {navView === "config" && !oemL1Id ? (
                <>
                  <div className="oem-nav-shell oem-nav-shell--hub">
                    <OemNavBar
                      onBack={navigateBackOneLevel}
                      crumbs={[
                        allProjectsCrumb,
                        projectRootCrumb,
                        { label: "配置项" },
                      ]}
                    />
                  </div>
                  <OemConfigModuleHub
                    modules={projectModules}
                    onSelectModule={goL1Hub}
                  />
                </>
              ) : null}

              {navView === "config" && activeL1 && !oemL2Id ? (
                <div className="oem-nav-shell">
                  <OemNavBar
                    onBack={navigateBackOneLevel}
                    crumbs={[
                      allProjectsCrumb,
                      projectRootCrumb,
                      configCrumb,
                      { label: activeL1.label },
                    ]}
                  />
                  <OemModuleMenu
                    l1={activeL1}
                    onPick={(child) => {
                      setOemL2Id(child.id);
                      setOemL4Id(null);
                    }}
                  />
                </div>
              ) : null}

              {navView === "config" &&
              layout &&
              serial &&
              activeL1 &&
              activeL2 &&
              activeL4 ? (
                <>
                  <div className="oem-nav-shell">
                    <OemNavBar
                      onBack={navigateBackOneLevel}
                      crumbs={[
                        allProjectsCrumb,
                        projectRootCrumb,
                        configCrumb,
                        {
                          label: activeL1.label,
                          onClick: () => {
                            setOemL4Id(null);
                            setOemL2Id(null);
                          },
                        },
                        {
                          label: activeL2.title,
                          onClick: () => setOemL4Id(null),
                        },
                        { label: activeL4.title },
                      ]}
                    />
                  </div>
                <OemFocusPanel
                  title={activeL4.title}
                  oemPath={l2OemPath}
                  deviceSerial={serial}
                  probeId={activeL4.probeId}
                  meta={probeMeta.get(activeL4.probeId)}
                  results={
                    values.get(activeL4.probeId)
                      ? [values.get(activeL4.probeId)!]
                      : [
                          {
                            probeId: activeL4.probeId,
                            ok: true,
                            raw: null,
                            display: "…",
                            at: 0,
                          },
                        ]
                  }
                  onWriteProbe={onWriteProbe}
                  onWriteProbeValue={onWriteProbeValue}
                  writingProbeId={writingProbeId}
                />
              </>
              ) : null}

              {navView === "config" &&
              layout &&
              serial &&
              activeL1 &&
              activeL2 &&
              !activeL4 ? (
                <>
                  <div className="oem-nav-shell oem-nav-shell--with-grid">
                    <OemNavBar
                      onBack={navigateBackOneLevel}
                      crumbs={[
                        allProjectsCrumb,
                        projectRootCrumb,
                        configCrumb,
                        {
                          label: activeL1.label,
                          onClick: () => {
                            setOemL4Id(null);
                            setOemL2Id(null);
                          },
                        },
                        { label: activeL2.title },
                      ]}
                    />
                  {activeL2.subtitle && !activeL2.composable ? (
                    <p className="oem-nav-l2-hint">{activeL2.subtitle}</p>
                  ) : null}
                  {serial && layout ? (
                    <ExpectCompareBar
                      probeMeta={probeMeta}
                      values={values}
                      template={expectTemplate}
                      onTemplateChange={setExpectTemplate}
                      compareScopeLayoutId={layoutId}
                      compareScopeProbeIds={allProbeIds}
                      showAbnormalOnly={expectShowAbnormalOnly}
                      onShowAbnormalOnlyChange={handleShowAbnormalOnlyChange}
                      onAutoLayout={() => {
                        manualLayoutRef.current = false;
                        applyAutoLayout();
                      }}
                      showEnSubtitles={showEnSubtitles}
                      onShowEnSubtitlesChange={(v) => {
                        setShowEnSubtitles(v);
                        try {
                          sessionStorage.setItem(
                            "livepanel.showEnSubtitles",
                            v ? "1" : "0",
                          );
                        } catch {
                          /* ignore */
                        }
                      }}
                      onWriteAllCompareMismatches={onWriteAllCompareMismatches}
                    />
                  ) : null}
                </div>
                {activeL2.composable ? (
                  <PanelComposerToolbar
                    panelCount={layout.widgets.length}
                    onOpenLibrary={() => {
                      void refreshCatalog();
                      setLibraryOpen(true);
                    }}
                    onAutoLayout={() => {
                      manualLayoutRef.current = false;
                      applyAutoLayout();
                    }}
                    onRestoreDefault={onRestoreAutoLayout}
                    onClearPanel={onClearPanel}
                  />
                ) : null}
                <div className="oem-panel-grid-host">
                  <PanelErrorBoundary title="模块面板渲染出错">
                    <Dashboard
                      layout={layout}
                      gridCols={gridSpec.cols}
                      gridRowHeight={
                        layout.grid.rowHeight ?? gridSpec.rowHeight
                      }
                      probeMeta={probeMeta}
                      values={values}
                      width={gridWidth}
                      deviceSerial={serial}
                      hideLayoutSections
                      compareByProbeId={compareByProbeId}
                      expectShowAbnormalOnly={Boolean(
                        expectTemplate && expectShowAbnormalOnly,
                      )}
                      showEnSubtitles={showEnSubtitles}
                      onWriteProbe={onWriteProbe}
                      onWriteProbeValue={onWriteProbeValue}
                      writingProbeId={writingProbeId}
                      onLayoutChange={onLayoutWidgetsChange}
                      onLayoutRevert={revertLayoutStep}
                      onWidgetUiChange={onWidgetUiChange}
                      onRemoveWidget={onRemoveWidget}
                      onScanWidgetNeedHeight={onScanWidgetNeedHeight}
                    />
                  </PanelErrorBoundary>
                </div>
                {activeL2.composable && activeL2.l4Items?.length ? (
                  <OemL4Catalog
                    l2={activeL2}
                    userSchemes={userSchemes}
                    canSaveScheme={layout.widgets.length > 0}
                    schemeApiReady={schemeApiReady}
                    schemeMessage={schemeMessage}
                    schemeSaving={schemeSaving}
                    onOpen={(item) => setOemL4Id(item.id)}
                    onAddToPanel={onAddL4ToPanel}
                    onApplyBuiltinPreset={onApplyBuiltinPreset}
                    onSaveCurrentScheme={(name) => void onSaveCurrentScheme(name)}
                    onApplyUserScheme={onApplyUserScheme}
                    onDeleteUserScheme={(id) => void onDeleteUserScheme(id)}
                  />
                ) : null}
                <WidgetLibrary
                  open={libraryOpen}
                  entries={catalog}
                  onClose={() => setLibraryOpen(false)}
                  onAdd={onAddFromCatalog}
                />
              </>
              ) : null}

              {navView === "config" && serial && activeL1 && oemL2Id && !layout ? (
                <p style={{ color: "var(--err)" }}>
                  未找到布局：{layoutId ?? "—"}，请检查 navigation 配置。
                </p>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
