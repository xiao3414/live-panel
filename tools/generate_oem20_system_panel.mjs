/**
 * 按 OEMConfig 2.0 产品框架 System Configuration.md + JSON schema 生成：
 * - registry/modules/oem20_system_probes.yaml
 * - layouts/oem20-system-*-panel.json（8 个子模块）
 *
 * 跑：node tools/generate_oem20_system_panel.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @typedef {{ oemPath: string, item: string, itemZh: string, kind: 'tri'|'enum'|'text', options?: string[], read?: object }} FieldDef */

/** ADB 可读映射（库内已有实况口径）；无映射则仅表单占位 */
const ADB_READ = {
  "clockStep.clockTimeMode": {
    kind: "adb.settings",
    namespace: "global",
    key: "auto_time",
    map: { Manual: "0", Auto: "1" },
  },
  "clockStep.clockTimeZoneMode": {
    kind: "adb.settings",
    namespace: "global",
    key: "auto_time_zone",
    map: { Manual: "0", Auto: "1" },
  },
  "clockStep.clockTimeFormat": {
    kind: "adb.settings",
    namespace: "system",
    key: "time_12_24",
  },
  "clockStep.clockManualTimeZone": {
    kind: "adb.shell",
    cmd: "getprop persist.sys.timezone",
  },
  "soundStep.mediaVolume": {
    kind: "adb.settings",
    namespace: "system",
    key: "volume_music",
  },
  "soundStep.ringVolume": {
    kind: "adb.settings",
    namespace: "system",
    key: "volume_ring",
  },
  "soundStep.alarmVolume": {
    kind: "adb.settings",
    namespace: "system",
    key: "volume_alarm",
  },
  "soundStep.callVolume": {
    kind: "adb.settings",
    namespace: "system",
    key: "volume_voice_call",
  },
  "displayStep.setFontSize": {
    kind: "adb.settings",
    namespace: "system",
    key: "font_scale",
  },
  "displayStep.displayTimeout": {
    kind: "adb.settings",
    namespace: "system",
    key: "screen_off_timeout",
  },
  "displayStep.displayStayAwake": {
    kind: "adb.settings",
    namespace: "global",
    key: "stay_on_while_plugged_in",
  },
  "displayStep.displayBackLightLevel": {
    kind: "adb.settings",
    namespace: "system",
    key: "screen_brightness",
  },
  "displayStep.displayAutoBrightness": {
    kind: "adb.settings",
    namespace: "system",
    key: "screen_brightness_mode",
    map: { Enable: "1", Disable: "0" },
  },
  "displayStep.displayAutoRotate": {
    kind: "adb.settings",
    namespace: "system",
    key: "accelerometer_rotation",
    map: { Enable: "1", Disable: "0" },
  },
  "languageInputStep.generalUiSystemLanguage": {
    kind: "adb.settings",
    namespace: "system",
    key: "system_locales",
  },
  "powerManagementStep.batteryPercentageEnable": {
    kind: "adb.settings",
    namespace: "system",
    key: "status_bar_show_battery_percent",
    map: { Enable: "1", Disable: "0" },
  },
};

const TRI = ["Enable", "Disable"];
const MODULES = [
  {
    id: "date-time",
    step: "clockStep",
    title: "Date & Time",
    titleZh: "日期与时间",
    layoutId: "oem20-system-date-time-panel",
    fields: /** @type {FieldDef[]} */ ([
      {
        oemPath: "clockStep.clockTimeMode",
        item: "Time Mode",
        itemZh: "时间模式",
        kind: "enum",
        options: ["Manual", "Auto"],
      },
      {
        oemPath: "clockStep.clockManualDate",
        item: "Manual Date",
        itemZh: "手动日期",
        kind: "text",
      },
      {
        oemPath: "clockStep.clockManualTime",
        item: "Manual Time",
        itemZh: "手动时间",
        kind: "text",
      },
      {
        oemPath: "clockStep.clockTimeZoneMode",
        item: "Time Zone Mode",
        itemZh: "时区模式",
        kind: "enum",
        options: ["Manual", "Auto"],
      },
      {
        oemPath: "clockStep.clockManualTimeZone",
        item: "Manual Time Zone",
        itemZh: "手动时区",
        kind: "text",
      },
      {
        oemPath: "clockStep.clockTimeFormat",
        item: "Time Format",
        itemZh: "时间格式",
        kind: "enum",
        options: ["12", "24"],
      },
      {
        oemPath: "clockStep.clockNtpServer",
        item: "Manual Ntp Server",
        itemZh: "NTP 服务器",
        kind: "text",
      },
      {
        oemPath: "clockStep.timeServerSyncIntercal",
        item: "Time server sync interval",
        itemZh: "时间同步间隔",
        kind: "text",
      },
    ]),
  },
  {
    id: "sound",
    step: "soundStep",
    title: "Sound",
    titleZh: "声音",
    layoutId: "oem20-system-sound-panel",
    fields: [
      { oemPath: "soundStep.alarmVolume", item: "Alarm Volume", itemZh: "闹钟音量", kind: "text" },
      { oemPath: "soundStep.mediaVolume", item: "Media Volume", itemZh: "媒体音量", kind: "text" },
      { oemPath: "soundStep.ringVolume", item: "Ring Volume", itemZh: "铃声音量", kind: "text" },
      { oemPath: "soundStep.callVolume", item: "Call Volume", itemZh: "通话音量", kind: "text" },
      { oemPath: "soundStep.lockTheVolume", item: "Lock the Volume", itemZh: "锁定音量", kind: "tri" },
      { oemPath: "soundStep.lockTheFullVolume", item: "Lock at Full Volume", itemZh: "锁定最大音量", kind: "tri" },
      { oemPath: "soundStep.notificationSound", item: "Notification Sound", itemZh: "通知音", kind: "tri" },
      { oemPath: "soundStep.dialPadTones", item: "Dial Pad Tones", itemZh: "拨号音", kind: "tri" },
      { oemPath: "soundStep.touchSounds", item: "Touch Sounds", itemZh: "触摸音", kind: "tri" },
      { oemPath: "soundStep.touchVibration", item: "Touch Vibration", itemZh: "触摸振动", kind: "tri" },
      { oemPath: "soundStep.screenLockingSounds", item: "Screen Locking Sounds", itemZh: "锁屏音", kind: "tri" },
      {
        oemPath: "soundStep.chargingSoundAndVibration",
        item: "Charging Sound And Vibration",
        itemZh: "充电声振",
        kind: "tri",
      },
    ],
  },
  {
    id: "display",
    step: "displayStep",
    title: "Display",
    titleZh: "显示",
    layoutId: "oem20-system-display-panel",
    fields: [
      {
        oemPath: "displayStep.setFontSize",
        item: "Display Font Size",
        itemZh: "字体大小",
        kind: "enum",
        options: ["Default", "Small", "Large", "Largest"],
      },
      {
        oemPath: "displayStep.displayTimeout",
        item: "Display Timeout",
        itemZh: "熄屏超时",
        kind: "enum",
        options: [
          "Never",
          "15 seconds",
          "30 seconds",
          "1 minute",
          "2 minutes",
          "5 minutes",
          "10 minutes",
          "30 minutes",
        ],
      },
      { oemPath: "displayStep.displayStayAwake", item: "Stay Awake", itemZh: "保持唤醒", kind: "tri" },
      {
        oemPath: "displayStep.displayBackLightLevel",
        item: "Screen Brightness",
        itemZh: "屏幕亮度",
        kind: "text",
      },
      {
        oemPath: "displayStep.displayAutoBrightness",
        item: "Auto Brightness",
        itemZh: "自动亮度",
        kind: "tri",
      },
      { oemPath: "displayStep.displayAutoRotate", item: "Auto Rotate", itemZh: "自动旋转", kind: "tri" },
      {
        oemPath: "displayStep.screenOrientation",
        item: "Screen Orientation",
        itemZh: "屏幕方向",
        kind: "enum",
        options: ["0°", "90°", "180°", "270°"],
      },
      {
        oemPath: "displayStep.screenOrientationSuggestion",
        item: "Display Orientation Suggestion",
        itemZh: "方向建议",
        kind: "tri",
      },
      {
        oemPath: "displayStep.homeScreenWallpaper",
        item: "Home Screen Wallpaper",
        itemZh: "主屏壁纸",
        kind: "text",
      },
      {
        oemPath: "displayStep.lockScreenWallpaper",
        item: "Lock Screen Wallpaper",
        itemZh: "锁屏壁纸",
        kind: "text",
      },
      {
        oemPath: "displayStep.screenSaverStep.use_screen_saver",
        item: "Use Screen Saver",
        itemZh: "使用屏保",
        kind: "tri",
      },
      {
        oemPath: "displayStep.screenSaverStep.whenToStart",
        item: "When to Start",
        itemZh: "屏保启动时机",
        kind: "enum",
        options: ["While charging", "While docked and charging"],
      },
      {
        oemPath: "displayStep.screenSaverStep.screenSaver",
        item: "Choose A Screen Saver",
        itemZh: "屏保样式",
        kind: "enum",
        options: ["Clock", "Color", "Photos"],
      },
      {
        oemPath: "displayStep.displayExternalStep.displayExternalModeSelection",
        item: "Mode Selection",
        itemZh: "外接显示模式",
        kind: "enum",
        options: ["Desktop Mode", "Mirror Mode"],
      },
      {
        oemPath: "displayStep.displayExternalStep.displayExternalDisplayTarget",
        item: "Display Target",
        itemZh: "显示目标",
        kind: "enum",
        options: ["This Device", "External Device"],
      },
      {
        oemPath:
          "displayStep.displayExternalStep.displayExternalSecondaryScreenOrientation",
        item: "Secondary Screen Orientation",
        itemZh: "副屏方向",
        kind: "enum",
        options: ["0°", "90°", "180°", "270°"],
      },
    ],
  },
  {
    id: "touch-mode",
    step: "touchModeStep",
    title: "Touch Mode",
    titleZh: "触摸模式",
    layoutId: "oem20-system-touch-mode-panel",
    fields: [
      {
        oemPath: "touchModeStep.gloveModeEnable",
        item: "Glove Mode",
        itemZh: "手套模式",
        kind: "tri",
      },
    ],
  },
  {
    id: "notification",
    step: "notificationStep",
    title: "Notification",
    titleZh: "通知",
    layoutId: "oem20-system-notification-panel",
    fields: [
      { oemPath: "notificationStep.doNotDisturb", item: "Do Not Disturb", itemZh: "勿扰", kind: "tri" },
      {
        oemPath: "notificationStep.notificationDots",
        item: "Notification Dots on App Icon",
        itemZh: "通知角标",
        kind: "tri",
      },
      {
        oemPath: "notificationStep.notificationLed",
        item: "Enable Notification LED",
        itemZh: "通知灯",
        kind: "tri",
      },
    ],
  },
  {
    id: "language-input",
    step: "languageInputStep",
    title: "Language & Input",
    titleZh: "语言与输入",
    layoutId: "oem20-system-language-input-panel",
    fields: [
      {
        oemPath: "languageInputStep.generalUiSystemLanguage",
        item: "System Language",
        itemZh: "系统语言",
        kind: "text",
      },
      { oemPath: "languageInputStep.inputMethod", item: "Input Method", itemZh: "输入法弹出", kind: "tri" },
      {
        oemPath: "languageInputStep.generalUiImeCurrentKeyboard",
        item: "IME Current Keyboard",
        itemZh: "当前键盘",
        kind: "text",
      },
      {
        oemPath: "languageInputStep.generalUiImeSpellChecker",
        item: "Spell Checker",
        itemZh: "拼写检查",
        kind: "tri",
      },
      {
        oemPath: "languageInputStep.generalUiImePointerSpeed",
        item: "Pointer Speed",
        itemZh: "指针速度",
        kind: "text",
      },
      {
        oemPath: "languageInputStep.imeActivates.permanentlyProhibit",
        item: "Permanently Prohibit",
        itemZh: "永久禁止软键盘",
        kind: "tri",
      },
      {
        oemPath: "languageInputStep.imeActivates.suspensionButton",
        item: "Suspension Button",
        itemZh: "悬浮按钮",
        kind: "tri",
      },
      {
        oemPath: "languageInputStep.imeActivates.physicalButton",
        item: "Physical Button",
        itemZh: "物理按键",
        kind: "tri",
      },
      {
        oemPath: "languageInputStep.disableInputMethodStep.disableInputMethodAction",
        item: "Disable Input Method Action",
        itemZh: "禁用输入法动作",
        kind: "enum",
        options: ["Clear disabled", "Add disabled", "Cancel disabled"],
      },
      {
        oemPath: "languageInputStep.disableInputMethodStep.disableInputMethod",
        item: "Input Method Package Name",
        itemZh: "输入法包名",
        kind: "text",
      },
    ],
  },
  {
    id: "system-ui",
    step: "systemUiStep",
    title: "System UI",
    titleZh: "系统界面",
    layoutId: "oem20-system-ui-panel",
    fields: [
      { oemPath: "systemUiStep.leftKey", item: "Back", itemZh: "返回键", kind: "tri" },
      { oemPath: "systemUiStep.middleKey", item: "Home", itemZh: "主页键", kind: "tri" },
      { oemPath: "systemUiStep.rightKey", item: "Menu", itemZh: "菜单键", kind: "tri" },
      {
        oemPath: "systemUiStep.navigationBar",
        item: "Hide Navigation Bar",
        itemZh: "隐藏导航栏",
        kind: "tri",
      },
      {
        oemPath: "systemUiStep.statusBarDropdown",
        item: "Dropdown Status Bar",
        itemZh: "状态栏下拉",
        kind: "tri",
      },
      {
        oemPath: "systemUiStep.sideAppBarMode",
        item: "Side Bar Status (DT630)",
        itemZh: "侧边栏状态",
        kind: "tri",
      },
      {
        oemPath: "systemUiStep.sideAppBarPosition",
        item: "Side Bar Position (DT630)",
        itemZh: "侧边栏位置",
        kind: "enum",
        options: ["Left", "Right"],
      },
      {
        oemPath: "systemUiStep.generalUiGesturesStep.threeFingerScreenshots",
        item: "Three Finger Screenshots",
        itemZh: "三指截屏",
        kind: "tri",
      },
      {
        oemPath: "systemUiStep.generalUiGesturesStep.generalUiGestureQuickCamera",
        item: "Quickly Open the Camera",
        itemZh: "快速打开相机",
        kind: "tri",
      },
      {
        oemPath: "systemUiStep.generalUiGesturesStep.generalUiSystemNavigation",
        item: "System Navigation",
        itemZh: "系统导航",
        kind: "enum",
        options: ["Gesture navigation", "3- button navigation"],
      },
      {
        oemPath: "systemUiStep.generalUiGesturesStep.generalUiPowerButtonLongPress",
        item: "Press & Hold Power Button",
        itemZh: "长按电源键",
        kind: "enum",
        options: ["Access power menu", "Digital assistant"],
      },
    ],
  },
  {
    id: "power-management",
    step: "powerManagementStep",
    title: "Power Management",
    titleZh: "电源管理",
    layoutId: "oem20-system-power-management-panel",
    fields: [
      {
        oemPath: "powerManagementStep.batteryPercentageEnable",
        item: "Show Battery Percentage",
        itemZh: "显示电量百分比",
        kind: "tri",
      },
      {
        oemPath: "powerManagementStep.powerSavingMode",
        item: "Battery Saver Mode",
        itemZh: "省电模式",
        kind: "tri",
      },
      {
        oemPath: "powerManagementStep.appBatteryUsageStep.batteryOptimization",
        item: "Package name",
        itemZh: "电池优化包名",
        kind: "text",
      },
      {
        oemPath: "powerManagementStep.smartChargingStep.Battery_Optimized",
        item: "Charging Optimization",
        itemZh: "充电优化",
        kind: "enum",
        options: ["On", "Off"],
      },
      {
        oemPath: "powerManagementStep.smartChargingStep.Battery_Type",
        item: "Smart Charging",
        itemZh: "智能充电",
        kind: "tri",
      },
      {
        oemPath: "powerManagementStep.smartChargingStep.chargingRestrictionPercentage",
        item: "Charging Restriction Percentage",
        itemZh: "充电上限",
        kind: "enum",
        options: ["70", "75", "80", "85", "90", "95"],
      },
      {
        oemPath: "powerManagementStep.smartChargingStep.health",
        item: "Battery info health threshold",
        itemZh: "健康阈值",
        kind: "text",
      },
      {
        oemPath: "powerManagementStep.smartChargingStep.cycle",
        item: "Battery info cycle threshold",
        itemZh: "循环阈值",
        kind: "text",
      },
      {
        oemPath: "powerManagementStep.smartChargingStep.temp",
        item: "Battery info temperature threshold",
        itemZh: "温度阈值",
        kind: "text",
      },
      {
        oemPath: "powerManagementStep.smartChargingStep.monitor_service",
        item: "Battery info monitor service",
        itemZh: "监控服务",
        kind: "tri",
      },
      {
        oemPath: "powerManagementStep.smartChargingStep.battery_tip",
        item: "Battery info battery tip",
        itemZh: "电池提示",
        kind: "tri",
      },
      {
        oemPath: "powerManagementStep.screenWakeUpStep.keymapScreenLeftStep",
        item: "Left scan",
        itemZh: "左键唤醒",
        kind: "tri",
      },
      {
        oemPath: "powerManagementStep.screenWakeUpStep.keymapScreenRightStep",
        item: "Right scan",
        itemZh: "右键唤醒",
        kind: "tri",
      },
      {
        oemPath: "powerManagementStep.screenWakeUpStep.keymapScreenPttStep",
        item: "TALK(PTT)",
        itemZh: "PTT 唤醒",
        kind: "tri",
      },
    ],
  },
];

function probeIdFromOem(oemPath) {
  return `syscfg.${oemPath.replace(/\./g, "__")}`;
}

function yamlEscape(s) {
  if (s == null) return '""';
  const t = String(s);
  // 纯数字/布尔词必须加引号，否则 js-yaml 会解析成 number/boolean → 渲染崩黑屏
  if (
    /^-?\d+(\.\d+)?$/.test(t) ||
    /^(true|false|null|yes|no|on|off)$/i.test(t) ||
    /[:#{}[\],&*?|>!%@`]/.test(t) ||
    t.includes("\n") ||
    t.includes('"')
  ) {
    return JSON.stringify(t);
  }
  return t;
}

function labelsBlock(options) {
  const lines = ["    labels:"];
  for (const o of options) {
    // 键值都用 yamlEscape，避免 12/24 等变成 number
    lines.push(`      ${yamlEscape(o)}: ${yamlEscape(o)}`);
  }
  // Enable/Disable also accept 1/0 for ADB
  if (options.includes("Enable") && options.includes("Disable")) {
    lines.push(`      "1": "Enable"`);
    lines.push(`      "0": "Disable"`);
  }
  if (options.includes("Auto") && options.includes("Manual")) {
    lines.push(`      "1": "Auto"`);
    lines.push(`      "0": "Manual"`);
  }
  return lines.join("\n");
}

function emitField(mod, f) {
  const id = probeIdFromOem(f.oemPath);
  const display =
    f.kind === "tri" ? "toggle" : f.kind === "enum" ? "enum" : "text";
  const options = f.kind === "tri" ? TRI : f.options ?? [];
  const read = ADB_READ[f.oemPath];
  const lines = [];
  lines.push(`  - id: ${id}`);
  lines.push(`    l1: System Configuration`);
  lines.push(`    module: System Configuration / ${mod.title}`);
  lines.push(`    item: ${yamlEscape(f.item)}`);
  lines.push(`    itemZh: ${yamlEscape(f.itemZh)}`);
  lines.push(`    display:`);
  lines.push(`      type: ${display}`);
  if (options.length) lines.push(labelsBlock(options));
  lines.push(`    probe:`);
  if (read?.kind === "adb.settings") {
    lines.push(`      kind: adb.settings`);
    lines.push(`      namespace: ${read.namespace}`);
    lines.push(`      key: ${read.key}`);
  } else if (read?.kind === "adb.shell") {
    lines.push(`      kind: adb.shell`);
    lines.push(`      cmd: ${yamlEscape(read.cmd)}`);
  } else {
    lines.push(`      kind: static`);
    lines.push(
      `      note: ${yamlEscape(`OEM ${f.oemPath} · 库内未找到 ADB/USDK 直读映射`)}`,
    );
  }
  lines.push(`    oemPath: ${yamlEscape(f.oemPath)}`);
  lines.push(
    `    verifyPath: ${yamlEscape(`OEM 2.0 · System Configuration / ${mod.title} · ${f.item}`)}`,
  );
  lines.push(`    refreshMs: 12000`);
  lines.push(`    enabled: true`);
  return { id, yaml: lines.join("\n") };
}

function emitModule(mod) {
  const fieldIds = [];
  const fieldYamls = [];
  for (const f of mod.fields) {
    const { id, yaml } = emitField(mod, f);
    fieldIds.push(id);
    fieldYamls.push(yaml);
  }
  const mid = `syscfg.module.${mod.id.replace(/-/g, "_")}`;
  const modYaml = [
    `  - id: ${mid}`,
    `    l1: System Configuration`,
    `    module: System Configuration / ${mod.title}`,
    `    item: ${yamlEscape(mod.title)}`,
    `    itemZh: ${yamlEscape(mod.titleZh)}`,
    `    display:`,
    `      type: oem_module_form`,
    `    probe:`,
    `      kind: static`,
    `      members:`,
    ...fieldIds.map((id) => `        - ${id}`),
    `      note: "OEM 2.0 System Configuration · ${mod.title}（表单对齐 Docking/WiFi）"`,
    `    verifyPath: ${yamlEscape(`03_接口与配置映射/OEMConfig_2.0_产品框架/System Configuration.md · ${mod.title}`)}`,
    `    enabled: true`,
    `    refreshMs: 12000`,
  ].join("\n");

  const layout = {
    version: 1,
    name: `OEM2.0 · System · ${mod.title}`,
    oemModule: "System Configuration",
    description: `${mod.titleZh}（WiFi/Docking 风格表单 · ADB 可读项已接）`,
    grid: {
      cols: 12,
      rowHeight: 64,
      margin: [10, 10],
      compactType: "vertical",
    },
    layoutVersion: 1,
    refresh: { globalMs: 12000, pauseWhenHidden: true },
    widgets: [
      {
        id: `w_syscfg_${mod.id.replace(/-/g, "_")}`,
        probeIds: [mid],
        title: mod.title,
        titleZh: mod.titleZh,
        x: 0,
        y: 0,
        w: 12,
        h: Math.max(8, 2 + Math.ceil(mod.fields.length * 1.2)),
      },
    ],
  };

  return { mid, modYaml, fieldYamls, layout, layoutId: mod.layoutId, fieldIds };
}

const parts = MODULES.map(emitModule);
const header = `# OEM 2.0 System Configuration — 分模块表单（自动生成）
# 重新生成: node tools/generate_oem20_system_panel.mjs
# 依据: 03_接口与配置映射/OEMConfig_2.0_产品框架/System Configuration.md
module: System Configuration
frameworkRef: 03_接口与配置映射/OEMConfig_2.0_产品框架/System Configuration.md
probes:
`;

const body = parts
  .flatMap((p) => [p.modYaml, ...p.fieldYamls])
  .join("\n");

const outYaml = path.join(ROOT, "registry/modules/oem20_system_probes.yaml");
fs.writeFileSync(outYaml, header + body + "\n", "utf8");
console.log("wrote", outYaml);

for (const p of parts) {
  const lp = path.join(ROOT, "layouts", `${p.layoutId}.json`);
  fs.writeFileSync(lp, JSON.stringify(p.layout, null, 2) + "\n", "utf8");
  console.log("wrote", lp);
}

const mapPath = path.join(ROOT, "registry/system/oem20_system_probe_map.json");
fs.mkdirSync(path.dirname(mapPath), { recursive: true });
const map = {};
for (const mod of MODULES) {
  for (const f of mod.fields) {
    map[f.oemPath] = probeIdFromOem(f.oemPath);
  }
}
fs.writeFileSync(mapPath, JSON.stringify(map, null, 2) + "\n", "utf8");
console.log("wrote", mapPath, Object.keys(map).length, "fields");
