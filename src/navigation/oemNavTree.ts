/** OEM 2.0 导航：L1 → L2 →（L4 配置项 + 可组合面板） */

export type OemL4Kind = "form" | "toggle" | "other";

export type OemL4Node = {
  id: string;
  probeId: string;
  title: string;
  kind: OemL4Kind;
};

export type PanelPreset = {
  id: string;
  label: string;
  probeIds: string[];
};

export type OemL2Node = {
  id: string;
  title: string;
  subtitle?: string;
  /** 固定 catalog 布局 */
  layoutId?: string;
  /** 可组合：空面板 + L4 目录（表单/开关均可加） */
  composable?: boolean;
  panelLayoutId?: string;
  l4Items?: OemL4Node[];
  panelPresets?: PanelPreset[];
};

export type OemL1Node = {
  id: string;
  label: string;
  children: OemL2Node[];
};

const WLAN_L4: OemL4Node[] = [
  {
    id: "wifi-general",
    probeId: "wifi.general_settings",
    title: "WiFi General Settings",
    kind: "form",
  },
  {
    id: "wifi-advanced",
    probeId: "wifi.advanced_settings",
    title: "WiFi Advanced Settings",
    kind: "form",
  },
  {
    id: "wifi-preference",
    probeId: "wifi.preference_settings",
    title: "WiFi Preference",
    kind: "form",
  },
  {
    id: "wifi-whitelist",
    probeId: "wifi.whitelist_settings",
    title: "WiFi Whitelist",
    kind: "form",
  },
  {
    id: "wifi-state",
    probeId: "wifi.state",
    title: "WiFi State",
    kind: "toggle",
  },
];

/** 与 SOTI / OEM 托管「Network Configuration」二级菜单一致（顺序对齐） */
export const OEM_NETWORK_L2_ORDER = [
  "WLAN",
  "SIM Configuration",
  "Hotspot & Tethering",
  "Private DNS",
  "NFC",
  "Ethernet",
] as const;

export const OEM_L1_MODULES: OemL1Node[] = [
  {
    id: "network",
    label: "Network Configuration",
    children: [
      {
        id: "wlan",
        title: "WLAN",
        subtitle: "WiFi State · Networks · Advanced · Preference · Whitelist",
        composable: true,
        panelLayoutId: "panel-network-wlan",
        l4Items: WLAN_L4,
        panelPresets: [
          {
            id: "wlan-forms",
            label: "快捷：WLAN 四项表单",
            probeIds: [
              "wifi.general_settings",
              "wifi.advanced_settings",
              "wifi.preference_settings",
              "wifi.whitelist_settings",
            ],
          },
          {
            id: "wlan-toggles",
            label: "快捷：WiFi 开关 + 通知",
            probeIds: [
              "wifi.state",
              "wifi.notification",
              "wifi.wakeup",
            ],
          },
        ],
      },
      {
        id: "sim-configuration",
        title: "SIM Configuration",
        subtitle: "Default SIM · SIM1/2 · eSIM · APN（直读 + 框架 catalog）",
        layoutId: "oem20-network-sim-configuration",
      },
      {
        id: "hotspot-tethering",
        title: "Hotspot & Tethering",
        subtitle: "热点 / USB 共享（ADB 直读，写回待接）",
        layoutId: "oem20-network-hotspot-tethering",
      },
      {
        id: "private-dns",
        title: "Private DNS",
        subtitle: "Private DNS Mode · Hostname",
        layoutId: "oem20-network-private-dns",
      },
      {
        id: "nfc",
        title: "NFC",
        subtitle: "NFC Adapter（读状态 + 写回）",
        layoutId: "oem20-network-nfc",
      },
      {
        id: "wireless-general",
        title: "Wireless General",
        subtitle: "飞行模式 · 蓝牙 · NFC · GPS（与早期探针页一致）",
        layoutId: "oem20-network-wireless-general",
      },
      {
        id: "ethernet",
        title: "Ethernet",
        subtitle: "Ethernet enable · Proxy",
        layoutId: "oem20-network-ethernet",
      },
      {
        id: "framework",
        title: "框架目录",
        subtitle: "维护：111 项 OEM 框架 catalog 对照",
        layoutId: "oem20-network-framework",
      },
    ],
  },
  {
    id: "system",
    label: "System Configuration",
    children: [
      {
        id: "configuration",
        title: "System Configuration",
        subtitle: "显示 / 日期时间 / 音量等（自动刷新）",
        layoutId: "oem20-system-configuration-live",
      },
      {
        id: "overview",
        title: "框架目录",
        subtitle: "OEM 框架 catalog 对照",
        layoutId: "oem20-system-configuration",
      },
    ],
  },
  {
    id: "application",
    label: "Application Management",
    children: [
      {
        id: "management",
        title: "Application Management",
        subtitle: "应用策略项（自动刷新）",
        layoutId: "oem20-application-management-live",
      },
      {
        id: "overview",
        title: "框架目录",
        layoutId: "oem20-application-management",
      },
    ],
  },
  {
    id: "package",
    label: "Package Configuration",
    children: [
      {
        id: "configuration",
        title: "Package Configuration",
        subtitle: "安装/卸载策略（自动刷新）",
        layoutId: "oem20-package-configuration-live",
      },
      {
        id: "overview",
        title: "框架目录",
        layoutId: "oem20-package-configuration",
      },
    ],
  },
  {
    id: "security",
    label: "Security&Restriction",
    children: [
      {
        id: "security",
        title: "Security",
        subtitle: "21 项 OEM 配置（自动刷新 · 可写回）",
        layoutId: "oem20-securityandrestriction-panel",
      },
      {
        id: "overview",
        title: "框架目录",
        layoutId: "oem20-securityandrestriction",
      },
    ],
  },
  {
    id: "data-capture",
    label: "Data Capture & Peripherals",
    children: [
      {
        id: "configuration",
        title: "Data Capture & Peripherals",
        subtitle: "采集与外设（自动刷新）",
        layoutId: "oem20-data-capture-and-peripherals-live",
      },
      {
        id: "overview",
        title: "框架目录",
        layoutId: "oem20-data-capture-and-peripherals",
      },
    ],
  },
  {
    id: "device-maintenance",
    label: "Device Maintenance",
    children: [
      {
        id: "maintenance",
        title: "Device Maintenance",
        subtitle: "维护项（自动刷新）",
        layoutId: "oem20-device-maintenance-live",
      },
      {
        id: "overview",
        title: "框架目录",
        layoutId: "oem20-device-maintenance",
      },
    ],
  },
  {
    id: "profile",
    label: "Profile Configuration",
    children: [
      {
        id: "configuration",
        title: "Profile Configuration",
        subtitle: "配置导入等（自动刷新）",
        layoutId: "oem20-profile-configuration-live",
      },
      {
        id: "overview",
        title: "框架目录",
        layoutId: "oem20-profile-configuration",
      },
    ],
  },
];

const FRAMEWORK_L2_IDS = new Set(["overview", "framework"]);

/** 进入 L1 时若仅有一个「非框架」子域，可直接打开该面板 */
export function defaultL2IdForL1(l1Id: string): string | null {
  const l1 = findL1(l1Id);
  if (!l1) return null;
  const primary = l1.children.filter((c) => !FRAMEWORK_L2_IDS.has(c.id));
  if (primary.length === 1) return primary[0]!.id;
  return null;
}

export function findL1(id: string): OemL1Node | undefined {
  return OEM_L1_MODULES.find((m) => m.id === id);
}

export function findL2(l1Id: string, l2Id: string): OemL2Node | undefined {
  return findL1(l1Id)?.children.find((c) => c.id === l2Id);
}

export function findL4(
  l1Id: string,
  l2Id: string,
  l4Id: string,
): OemL4Node | undefined {
  return findL2(l1Id, l2Id)?.l4Items?.find((x) => x.id === l4Id);
}

/** 当前应加载的布局 JSON（组合面板 or 固定布局） */
export function resolveLayoutId(l1Id: string, l2Id: string): string | null {
  const n = findL2(l1Id, l2Id);
  if (!n) return null;
  if (n.composable && n.panelLayoutId) return n.panelLayoutId;
  return n.layoutId ?? null;
}

export function oemPathForL2(l1Id: string, l2: OemL2Node): string {
  const l1 = findL1(l1Id);
  return `${l1?.label ?? l1Id} › ${l2.title}`;
}

/** 用户自定义面板方案的存储 scope（每个 L2 组合面板独立） */
export function panelSchemeScope(l1Id: string, l2Id: string): string {
  return `${l1Id}/${l2Id}`;
}
