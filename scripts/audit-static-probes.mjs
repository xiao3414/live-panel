/**
 * 审计 oem20_system_probes.yaml：仍标 static +「库内未找到」的项。
 * 若 USDK 接口文档里已有对应 set/get，打印告警，避免再出现「一致 0/0 · 无直读」。
 *
 * 用法：node scripts/audit-static-probes.mjs
 * 退出码：有「文档已有接口却仍 static」→ 1；仅剩真正缺口 → 0
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yamlPath = path.join(
  root,
  "registry/modules/oem20_system_probes.yaml",
);
const usdkDocCandidates = [
  path.join(
    root,
    "../../USDK/newest_usdk_auto/newest_usdk_auto/接口文件.txt",
  ),
  path.join(
    root,
    "../../USDK/newest_usdk_auto/newest_usdk_auto/USDK-JAR-Docs/part01.md",
  ),
  path.join(
    root,
    "../../USDK/newest_usdk_auto/newest_usdk_auto/接口文件/part01.md",
  ),
];

/** oemPath / item 关键词 → 文档中应出现的接口名片段 */
const HINTS = [
  { re: /glove|touchMode/i, apis: ["setGloveMode", "getGloveMode"] },
  {
    re: /doNotDisturb|勿扰/i,
    apis: ["setDoNotDisturbEnabled", "isDoNotDisturbEnabled"],
  },
  {
    re: /notificationDots|角标|Badging/i,
    apis: ["setNotificationBadgingEnabled", "getNotificationBadgingEnabled"],
  },
  {
    re: /notificationLed|通知灯|LightPulse/i,
    apis: [
      "setNotificationLightPulseEnabled",
      "getNotificationLightPulseEnabled",
    ],
  },
  {
    re: /dialPad|dtmf/i,
    apis: ["setDtmfToneEnabled", "getDtmfToneEnabled"],
  },
  {
    re: /touchSounds|sound_effects/i,
    apis: ["setSoundEffectsEnabled", "getSoundEffectsEnabled"],
  },
  {
    re: /touchVibration|haptic/i,
    apis: ["setHapticFeedbackEnabled", "getHapticFeedbackEnabled"],
  },
  {
    re: /screenLockingSounds|lockscreen_sounds/i,
    apis: ["setLockscreenSoundsEnabled", "getLockscreenSoundsEnabled"],
  },
  {
    re: /chargingSound|Charging Sound/i,
    apis: ["setChargingSoundsEnabled", "getChargingSoundsEnabled"],
  },
  {
    re: /lockTheVolume|FixedVolume|lockTheFull/i,
    apis: ["setFixedVolumeEnabled", "getFixedVolumeEnabled"],
  },
  {
    re: /screenOrientationSuggestion|OrientationSuggestion/i,
    apis: [
      "setOrientationSuggestionDisabled",
      "getOrientationSuggestionDisabled",
    ],
  },
  {
    // 仅主屏 Screen Orientation；勿匹配 displayExternalSecondaryScreenOrientation
    re: /syscfg\.displayStep__screenOrientation(?!Suggestion)|displayStep\.screenOrientation(?![A-Za-z])/i,
    apis: ["setScreenRotation", "getScreenRotation"],
  },
  {
    re: /autoRotate|Auto Rotate/i,
    apis: ["setAutoRotationEnabled", "getAutoRotationEnabled"],
  },
  {
    re: /batteryPercentage|Battery Percent/i,
    apis: ["setBatteryPercentVisible", "getBatteryPercentVisible"],
  },
  {
    re: /powerSavingMode|Battery Saver|power_save_mode/i,
    apis: ["setPowerSaveModeEnabled", "getPowerSaveModeEnabled"],
  },
  {
    re: /Battery_Optimized|Charging Optimization|charging_optimization/i,
    apis: ["setBatteryWorkMode", "getBatteryWorkMode"],
  },
  {
    re: /Battery_Type|Smart Charging|smart_charging/i,
    apis: ["setBatteryWorkMode", "getBatteryWorkMode"],
  },
  {
    re: /chargingRestrictionPercentage|charge_limit|ChargeLimit/i,
    apis: ["setChargeLimitPercent", "getChargeLimitPercent"],
  },
  {
    re: /smartChargingStep__health|health threshold|battery_health/i,
    apis: [
      "setBatteryHealthRetirementThreshold",
      "getBatteryHealthRetirementThreshold",
    ],
  },
  {
    re: /smartChargingStep__cycle|cycle threshold|battery_cycle/i,
    apis: [
      "setBatteryCycleRetirementThreshold",
      "getBatteryCycleRetirementThreshold",
    ],
  },
  {
    re: /smartChargingStep__temp|temperature threshold|battery_temp/i,
    apis: [
      "setBatteryHighTemperatureThreshold",
      "getBatteryHighTemperatureThreshold",
    ],
  },
  {
    re: /monitor_service|Battery info monitor/i,
    apis: [
      "setBatteryMonitorServiceEnabled",
      "getBatteryMonitorServiceEnabled",
    ],
  },
  {
    re: /battery_tip|Battery info battery tip|RetirementTip/i,
    apis: [
      "setBatteryRetirementTipEnabled",
      "getBatteryRetirementTipEnabled",
    ],
  },
  {
    re: /keymapScreenLeft|Left scan|left_scan_wakeup/i,
    apis: ["setLeftScanKeyWakeup", "getLeftScanKeyWakeup"],
  },
  {
    re: /keymapScreenRight|Right scan|right_scan_wakeup/i,
    apis: ["setRightScanKeyWakeup", "getRightScanKeyWakeup"],
  },
  {
    re: /keymapScreenPtt|TALK\(PTT\)|ptt_wakeup|PttKeyWakeup/i,
    apis: ["setPttKeyWakeupEnabled", "getPttKeyWakeupEnabled"],
  },
  {
    re: /batteryOptimization|App Battery Usage|Allow Background/i,
    apis: ["setBatteryOptimizationMode", "getBatteryOptimizationMode"],
  },
  {
    re: /generalUiSystemLanguage|System Language/i,
    apis: ["setSystemLanguage", "getSystemLanguage"],
  },
  {
    re: /languageInputStep\.inputMethod|__inputMethod\b/i,
    apis: ["setAutoPopInputMethod", "getAutoPopInputMethod"],
  },
  {
    re: /generalUiImeCurrentKeyboard|IME Current Keyboard|DefaultInputMethod/i,
    apis: ["setDefaultInputMethod", "getDefaultInputMethod"],
  },
  {
    re: /SpellChecker|spell_checker|拼写/i,
    apis: ["setSpellCheckerEnabled", "getSpellCheckerEnabled"],
  },
  {
    re: /PointerSpeed|pointer_speed|指针速度/i,
    apis: ["setPointerSpeed", "getPointerSpeed"],
  },
  {
    re: /permanentlyProhibit|DisablePopSoftinput/i,
    apis: ["setDisablePopSoftinput", "getDisablePopSoftinput"],
  },
  {
    re: /suspensionButton|KeyboardFloating/i,
    apis: ["setKeyboardFloatingWindow", "getKeyboardFloatingWindow"],
  },
  {
    re: /physicalButton|FnKeyControl/i,
    apis: ["setFnKeyControlSoftInput", "getFnKeyControlSoftInput"],
  },
  {
    re: /disableInputMethod(?!Action)|disable_imi/i,
    apis: ["setDisableImi", "getDisableImi"],
  },
  {
    re: /systemUiStep\.leftKey|__leftKey\b/i,
    apis: ["setLeftKeyEnabled", "getLeftKeyEnabled"],
  },
  {
    re: /systemUiStep\.middleKey|__middleKey\b/i,
    apis: ["enableHomeKey", "getHomeKeyEnabled"],
  },
  {
    re: /systemUiStep\.rightKey|__rightKey\b/i,
    apis: ["setRightKeyEnabled", "getRightKeyEnabled"],
  },
  {
    re: /navigationBar|Hide Navigation/i,
    apis: ["setBottomBarEnable", "getBottomBarEnable"],
  },
  {
    re: /statusBarDropdown|Dropdown Status/i,
    apis: ["enableStatusBar"],
  },
  {
    re: /sideAppBarMode|Side Bar Status/i,
    apis: ["enableSideAppBar", "getSideAppBarStatus"],
  },
  {
    re: /sideAppBarPosition|Side Bar Position/i,
    apis: ["setSideAppBarLeft", "isSideAppBarLeft"],
  },
  {
    re: /threeFingerScreenshots|MultiFinger/i,
    apis: [
      "setMultiFingerScreenShotEnabled",
      "getMultiFingerScreenShotEnabled",
    ],
  },
  {
    re: /QuickCamera|quicklyOpenCamera|Quickly Open/i,
    apis: ["enableQuicklyOpenCamera", "getQuicklyOpenCameraStatus"],
  },
  {
    re: /SystemNavigation|gesture_navigation|Gesture navigation/i,
    apis: ["setGestureNavigationEnabled", "getGestureNavigationEnabled"],
  },
  {
    re: /PowerButtonLongPress|LongPressPower|Digital assistant/i,
    apis: ["setLongPressPowerForAssistant", "getLongPressPowerForAssistant"],
  },
];

function loadUsdkText() {
  const parts = [];
  for (const p of usdkDocCandidates) {
    if (fs.existsSync(p)) parts.push(fs.readFileSync(p, "utf8"));
  }
  return parts.join("\n");
}

function parseStaticGaps(yamlText) {
  const blocks = yamlText.split(/\n  - id: /).slice(1);
  const gaps = [];
  for (const block of blocks) {
    const id = block.match(/^(\S+)/)?.[1];
    if (!id) continue;
    // probe: 后直接 kind:（勿要求多余空行）
    const kind = block.match(/\n    probe:\n\s*kind:\s*(\S+)/)?.[1];
    if (kind !== "static") continue;
    const note = block.match(/\n\s+note:\s*(.+)/)?.[1] ?? "";
    if (!/库内未找到/.test(note)) continue;
    const item = block.match(/\n    item:\s*(.+)/)?.[1] ?? "";
    const oemPath = block.match(/\n    oemPath:\s*(\S+)/)?.[1] ?? "";
    gaps.push({ id, item, oemPath, note });
  }
  return gaps;
}

const yaml = fs.readFileSync(yamlPath, "utf8");
const usdk = loadUsdkText();
const gaps = parseStaticGaps(yaml);

const falseNegatives = [];
const trueGaps = [];
for (const g of gaps) {
  const blob = `${g.id} ${g.item} ${g.oemPath}`;
  const hit = HINTS.find((h) => h.re.test(blob));
  if (!hit) {
    trueGaps.push(g);
    continue;
  }
  const present = hit.apis.filter((a) => usdk.includes(a));
  if (present.length) {
    falseNegatives.push({ ...g, apis: present });
  } else {
    trueGaps.push(g);
  }
}

console.log(`静态「库内未找到」共 ${gaps.length} 项`);
if (falseNegatives.length) {
  console.log("\n【应改为直读/写回，勿再标 static】");
  for (const g of falseNegatives) {
    console.log(`- ${g.id}  → USDK: ${g.apis.join(", ")}`);
  }
}
if (trueGaps.length) {
  console.log("\n【文档未命中已知映射，可暂留；对比侧会显示「未读到」】");
  for (const g of trueGaps.slice(0, 40)) {
    console.log(`- ${g.id}`);
  }
  if (trueGaps.length > 40) console.log(`  …另有 ${trueGaps.length - 40} 项`);
}

if (falseNegatives.length) {
  console.error(
    `\n审计失败：${falseNegatives.length} 项文档已有接口却仍 static。`,
  );
  process.exit(1);
}
console.log("\n审计通过：无「有接口却 static」项。");
process.exit(0);
