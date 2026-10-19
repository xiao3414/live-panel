import { findL1, OEM_L1_MODULES, type OemL1Node } from "./oemNavTree";

export type OemProjectHighlight = {
  title: string;
  body: string;
};

export type OemProjectProfile = {
  id: string;
  title: string;
  /** 面包屑与卡片标题 */
  shortTitle: string;
  tagline: string;
  description: string[];
  highlights: OemProjectHighlight[];
  /** 纳入本项目的 L1 模块 id（顺序即侧栏顺序） */
  moduleIds: string[];
  docLinks?: { label: string; href: string }[];
  /** planned：项目目录可见，尚不可进入配置 */
  status?: "active" | "planned";
};

const ALL_L1_IDS = OEM_L1_MODULES.map((m) => m.id);

const OEMCONFIG_PROJECT: OemProjectProfile = {
  id: "oemconfig",
  title: "OEM 2.0 托管配置",
  shortTitle: "OEM 2.0",
  tagline: "与 SOTI / OEMConfig 推送层级对齐的实况调试面板",
  description: [
    "在设备已连接时，可直接读写 settings 与 INI 探针，查看与托管配置一致的 Network、System 等模块。",
    "组合面板支持跨 L4 项自由排版，并可将布局保存为「我的方案」。",
  ],
  highlights: [
    {
      title: "层级一致",
      body: "L1 八大模块 → L2 子域 → L4 配置项，与 OEM 2.0 文档结构对应。",
    },
    {
      title: "实况 + 可写",
      body: "开关即时下发；表单类走 ADB / USDK 桥接（视设备能力）。",
    },
    {
      title: "可组合面板",
      body: "WLAN 等子域支持模块库、自动排版与自定义方案。",
    },
  ],
  moduleIds: ALL_L1_IDS,
  docLinks: [
    {
      label: "Network / WLAN 对齐说明",
      href: "docs/NETWORK_WLAN_OEM_ALIGNMENT.md",
    },
    {
      label: "模块开发规范",
      href: "docs/MODULE_DEVELOPMENT_SPEC.md",
    },
  ],
};

const DEVICE_SDK_PLACEHOLDER: OemProjectProfile = {
  id: "device-sdk",
  title: "Device SDK 探针",
  shortTitle: "Device SDK",
  tagline: "与 OEM 2.0 并列的 SDK / 原生能力调试（占位，后续接入 registry）",
  description: [
    "用于非 OEMConfig 推送链路的探针与实验面板。",
    "接入时在 oemProject.ts 注册 moduleIds 并设为 active。",
  ],
  highlights: [
    {
      title: "独立 registry",
      body: "可与 OEM 八大模块分离维护探针清单。",
    },
  ],
  moduleIds: [],
  status: "planned",
};

const PROJECTS: Record<string, OemProjectProfile> = {
  oemconfig: OEMCONFIG_PROJECT,
  "device-sdk": DEVICE_SDK_PLACEHOLDER,
};

export function listLivePanelProjects(): OemProjectProfile[] {
  return Object.values(PROJECTS);
}

export function resolveOemProject(projectId: string): OemProjectProfile {
  return PROJECTS[projectId] ?? OEMCONFIG_PROJECT;
}

export function modulesForProject(project: OemProjectProfile): OemL1Node[] {
  const out: OemL1Node[] = [];
  for (const id of project.moduleIds) {
    const m = findL1(id);
    if (m) out.push(m);
  }
  return out;
}

export function l1ModuleSummary(l1: OemL1Node): string {
  const n = l1.children.length;
  if (n === 1 && l1.children[0].title === l1.label) {
    return "固定布局面板";
  }
  const composable = l1.children.filter((c) => c.composable).length;
  if (composable > 0) {
    return `${n} 个子模块 · ${composable} 个可组合面板`;
  }
  return `${n} 个子模块`;
}
