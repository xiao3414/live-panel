import type { ProbeMeta, ProbeResult } from "./types";
import {
  isOemVolumeProbeId,
  oemVolumePercentsEqualGuessMax,
} from "./volumeOem";
import {
  isBrightnessProbe,
  isDisplayFontProbe,
  isDisplayTimeoutProbe,
  isStayAwakeProbe,
  normalizeDisplayFontRaw,
  normalizeDisplayTimeoutRaw,
  normalizeStayAwakeRaw,
} from "./displayOem";

export type ExpectEntry = {
  value: string;
  hint?: string;
};

export type ExpectTemplate = {
  version: number;
  id: string;
  name: string;
  description?: string;
  scope?: {
    layoutId?: string;
    module?: string;
  };
  expectations: Record<string, ExpectEntry>;
  /** 由 OEM 配置文件直接生成时保留源路径，便于刷新/追溯 */
  source?: {
    kind: "oem_app_configuration";
    path?: string;
  };
};

export type CompareStatus =
  | "match"
  | "mismatch"
  | "unread"
  | "out_of_scope"
  | "platform_locked";

export type CompareRow = {
  probeId: string;
  status: CompareStatus;
  expectedRaw: string;
  expectedHint?: string;
  /** 与面板块内一致的期望展示文案 */
  expectedDisplay: string;
  actualRaw: string | null;
  actualDisplay?: string;
  /** 平台强制说明（不参与不符统计） */
  platformNote?: string;
};

const TRUTHY = new Set([
  "1",
  "true",
  "on",
  "enable",
  "enabled",
  "allow",
  "allowed",
  "开",
  "允许",
  "启用",
]);
const FALSY = new Set([
  "0",
  "false",
  "off",
  "disable",
  "disabled",
  "disallow",
  "关",
  "禁止",
  "禁用",
]);

function normToken(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** 与 electron/scanWedgeRead.normalizeTriggeringModesRaw 对齐 */
function canonicalScanTriggerRaw(raw: string): string {
  const t = raw.trim();
  const byNum: Record<string, string> = {
    "0": "short_press_decode_or_timeout",
    "10": "short_press_decode_or_timeout",
    "1": "short_press_continuous",
    "2": "long_press_release_stop",
    "3": "long_press_continuous_release_stop",
    "4": "hand_free_continuous",
    "8": "hand_free_continuous",
  };
  if (t in byNum) return byNum[t]!;
  const lower = t.toLowerCase();
  if (lower.includes("hand-free") || lower.includes("hand free"))
    return "hand_free_continuous";
  if (lower.includes("short press") && lower.includes("continuous"))
    return "short_press_continuous";
  if (lower.includes("short press")) return "short_press_decode_or_timeout";
  if (lower.includes("long press") && lower.includes("continuous"))
    return "long_press_continuous_release_stop";
  if (lower.includes("long press")) return "long_press_release_stop";
  return t;
}

function enumDisplayLabel(
  meta: ProbeMeta | undefined,
  raw: string,
): string | null {
  if (!meta?.valueLabels) return null;
  if (meta.valueLabels[raw] != null) return String(meta.valueLabels[raw]);
  const nt = normToken(raw);
  const rawLower = raw.trim().toLowerCase();
  for (const label of Object.values(meta.valueLabels)) {
    const text = String(label ?? "");
    if (normToken(text) === nt || text.toLowerCase() === rawLower) return text;
  }
  return null;
}

/** 将模板中的 human 值归一化为 probe raw（与 registry labels 对齐） */
export function normalizeExpectRaw(
  probeId: string,
  meta: ProbeMeta | undefined,
  expectValue: string,
): string {
  const v = String(expectValue ?? "").trim();
  if (!v) return v;
  const lower = normToken(v);

  if (isDisplayFontProbe(probeId)) return normalizeDisplayFontRaw(v);
  if (isDisplayTimeoutProbe(probeId)) return normalizeDisplayTimeoutRaw(v);
  if (isStayAwakeProbe(probeId)) return normalizeStayAwakeRaw(v);

  // toggle 必须先于 valueLabels：否则 Enable 会原样留下，写 settings 变成非法字符串
  if (meta?.displayType === "toggle") {
    if (probeId === "sec.disallow_screenshot") {
      if (lower === "disallow" || lower === "禁止截图") return "1";
      if (lower === "allow" || lower === "允许") return "0";
    }
    if (TRUTHY.has(lower) || v === meta.labelOn) return "1";
    if (FALSY.has(lower) || v === meta.labelOff) return "0";
    if (meta.valueLabels) {
      for (const [raw, label] of Object.entries(meta.valueLabels)) {
        if (normToken(String(label ?? "")) === lower || String(label) === v) {
          if (raw === "1" || raw === "0") return raw;
        }
      }
    }
  }

  if (meta?.valueLabels && v in meta.valueLabels) return v;

  if (meta?.valueLabels) {
    for (const [raw, label] of Object.entries(meta.valueLabels)) {
      const text = String(label ?? "");
      if (normToken(text) === lower || text === v) return raw;
    }
  }

  if (meta?.displayType === "enum") {
    if (lower === "pin") return "pin";
    if (lower === "none" || lower === "无") return "none";
    if (lower === "slide" || lower === "滑动") return "slide";
    if (lower === "pattern" || lower === "图案") return "pattern";
  }

  if (lower.endsWith("min")) {
    const n = Number(lower.replace(/min$/, ""));
    if (!Number.isNaN(n) && n > 0) return String(n * 60_000);
  }

  return v;
}

/** 从 OEM hint 提取原始配置值（如 Disable / File Transfer） */
export function oemHintValue(hint?: string): string | null {
  if (!hint) return null;
  const eq = hint.indexOf("=");
  if (eq < 0) return null;
  let tail = hint.slice(eq + 1).trim();
  const paren = tail.indexOf("（");
  if (paren >= 0) tail = tail.slice(0, paren).trim();
  return tail || null;
}

/** JSON 期望 → 与面板同风格的中文/枚举文案 */
export function displayLabelForExpectRaw(
  meta: ProbeMeta | undefined,
  expectedRaw: string,
  hint?: string,
): string {
  if (meta?.valueLabels?.[expectedRaw] != null) {
    return String(meta.valueLabels[expectedRaw]);
  }
  if (meta?.displayType === "toggle") {
    if (expectedRaw === "1") return meta.labelOn ?? "开";
    if (expectedRaw === "0") return meta.labelOff ?? "关";
  }
  if (expectedRaw === "set") return meta?.valueLabels?.set ?? "已设置";
  if (expectedRaw === "none") return meta?.valueLabels?.none ?? "无";
  if (expectedRaw === "pin") return meta?.valueLabels?.pin ?? "PIN";
  if (expectedRaw === "pattern") return meta?.valueLabels?.pattern ?? "图案";
  if (expectedRaw === "slide") return meta?.valueLabels?.slide ?? "滑动";
  const oem = oemHintValue(hint);
  if (oem) return oem;
  return expectedRaw;
}

export function actualDisplayLabel(
  row: CompareRow,
  meta?: ProbeMeta,
): string {
  if (row.actualDisplay && row.actualDisplay !== "…") {
    const d = String(row.actualDisplay);
    if (!/^\d+$/.test(d)) return d;
    if (meta?.valueLabels?.[d] != null) return String(meta.valueLabels[d]);
    if (row.actualRaw && meta?.valueLabels?.[row.actualRaw] != null) {
      return String(meta.valueLabels[row.actualRaw]);
    }
    return d;
  }
  if (row.actualRaw == null || row.actualRaw === "") return "未读到";
  if (meta?.valueLabels?.[row.actualRaw] != null) {
    return String(meta.valueLabels[row.actualRaw]);
  }
  return String(row.actualRaw);
}

/** 策略 JSON 文件中的原始写法（如 Disable / PIN / 10 minutes） */
export function jsonOriginalConfigLabel(row: CompareRow): string {
  return oemHintValue(row.expectedHint) ?? row.expectedDisplay;
}

function rawEqual(
  meta: ProbeMeta | undefined,
  expected: string,
  actual: string | null,
  opts?: { probeId?: string; volumeMax?: number },
): boolean {
  if (actual == null || actual === "") return false;
  if (actual === expected) return true;
  // Sound 音量：OEM 百分比同档即一致
  if (opts?.probeId && isOemVolumeProbeId(opts.probeId)) {
    const ep = Number(String(expected).replace(/%/g, "").trim());
    const ap = Number(String(actual).replace(/%/g, "").trim());
    if (
      Number.isFinite(ep) &&
      Number.isFinite(ap) &&
      oemVolumePercentsEqualGuessMax(ep, ap, opts.volumeMax)
    ) {
      return true;
    }
  }
  // Display：Largest≡1.3、30 minutes≡1800000、Enable≡15(Stay Awake)
  if (opts?.probeId && isDisplayFontProbe(opts.probeId)) {
    if (
      normalizeDisplayFontRaw(expected) === normalizeDisplayFontRaw(actual)
    ) {
      return true;
    }
  }
  if (opts?.probeId && isDisplayTimeoutProbe(opts.probeId)) {
    if (
      normalizeDisplayTimeoutRaw(expected) ===
      normalizeDisplayTimeoutRaw(actual)
    ) {
      return true;
    }
  }
  if (opts?.probeId && isStayAwakeProbe(opts.probeId)) {
    if (normalizeStayAwakeRaw(expected) === normalizeStayAwakeRaw(actual)) {
      return true;
    }
  }
  // System Language：OEM zh-CN ≡ 设备 zh-CN,zh-Hans-CN（比主 locale）
  if (opts?.probeId && isSystemLanguageProbe(opts.probeId)) {
    if (systemLocalesEqual(expected, actual)) return true;
  }
  // 当前键盘 / 禁用输入法列表：包名包含即一致
  if (opts?.probeId && isImePackageProbe(opts.probeId)) {
    if (imePackageEqual(expected, actual)) return true;
  }
  const a = actual.toLowerCase();
  const e = expected.toLowerCase();
  if (a === e) return true;
  const expectedLabel = enumDisplayLabel(meta, expected);
  const actualLabel = enumDisplayLabel(meta, actual);
  if (expectedLabel && actualLabel && expectedLabel === actualLabel) return true;
  if (meta?.valueLabels) {
    const le = meta.valueLabels[expected] != null
      ? String(meta.valueLabels[expected])
      : undefined;
    const la = meta.valueLabels[actual] != null
      ? String(meta.valueLabels[actual])
      : undefined;
    if (le && la && le === la) return true;
    if (la && (normToken(la) === e || la === expected)) return true;
    if (le && (normToken(le) === a || le === actual)) return true;
    for (const [rawKey, label] of Object.entries(meta.valueLabels)) {
      if (rawKey !== actual) continue;
      const text = String(label ?? "");
      if (normToken(text) === e || text === expected) return true;
    }
  }
  if (
    (expected === "1" && (actual === "true" || a === "bool:1")) ||
    (expected === "0" && (actual === "false" || a === "bool:0"))
  ) {
    return true;
  }
  const disableSet = new Set(["0", "disable", "disabled", "disallow", "off"]);
  const enableSet = new Set(["1", "enable", "enabled", "allow", "on"]);
  if (disableSet.has(e) && disableSet.has(a)) return true;
  if (enableSet.has(e) && enableSet.has(a)) return true;
  if (/^\d+$/.test(expected) && /^\d+$/.test(actual) && expected === actual)
    return true;
  const handFree = new Set([
    "hand_free_continuous",
    "4",
    "8",
  ]);
  if (handFree.has(expected) && handFree.has(actual)) return true;
  const shortPressDecode = new Set([
    "short_press_decode_or_timeout",
    "0",
    "10",
  ]);
  if (shortPressDecode.has(expected) && shortPressDecode.has(actual)) {
    return true;
  }
  if (
    meta?.valueLabels &&
    (expected.includes("_") || /^[0-4]$/.test(actual))
  ) {
    for (const [rawKey, label] of Object.entries(meta.valueLabels)) {
      const text = String(label ?? "");
      if (rawKey === actual && normToken(text) === e) return true;
      if (rawKey === expected && normToken(text) === a) return true;
    }
  }
  return false;
}

function isNoDirectReadProbe(result: ProbeResult | undefined): boolean {
  if (!result) return false;
  const text = `${result.display ?? ""}\n${result.error ?? ""}\n${result.supportMessage ?? ""}`;
  return /库内未找到/.test(text);
}

function isSystemLanguageProbe(probeId: string): boolean {
  return (
    probeId === "syscfg.languageInputStep__generalUiSystemLanguage" ||
    /systemLanguage|system_locales/i.test(probeId)
  );
}

function isImePackageProbe(probeId: string): boolean {
  return probeId === "syscfg.languageInputStep__generalUiImeCurrentKeyboard";
}

function isDisableImiListProbe(probeId: string): boolean {
  return (
    probeId ===
    "syscfg.languageInputStep__disableInputMethodStep__disableInputMethod"
  );
}

function isSideAppBarPositionProbe(probeId: string): boolean {
  return probeId === "syscfg.systemUiStep__sideAppBarPosition";
}

function allowsEmptyRaw(probeId: string): boolean {
  return isDisableImiListProbe(probeId);
}

/** OEM 多用 `;`，USDK getDisableImi 多用 `:` */
export function splitImeIdList(raw: string): string[] {
  return raw
    .split(/[;,:]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function imeIdInList(imeId: string, listRaw: string): boolean {
  if (!imeId.trim()) return false;
  const list = splitImeIdList(listRaw);
  if (!list.length) return false;
  return list.some((item) => imePackageEqual(imeId, item));
}

/**
 * Add → 包名应在禁用列表；Cancel → 不应在列表；Clear → 列表应为空。
 * 支持多包（`;` / `,` / `:`）。
 */
export function disableImiListMatches(
  action: string,
  expectedPackage: string,
  actualList: string,
): { match: boolean; note?: string } {
  const act = action.trim().toLowerCase();
  const list = actualList.trim();
  const expectedIds = splitImeIdList(expectedPackage);
  if (/clear/.test(act)) {
    return {
      match: !list,
      note: list
        ? "Clear disabled：禁用列表非空"
        : "Clear disabled：禁用列表已空",
    };
  }
  if (/cancel/.test(act)) {
    const still = expectedIds.filter((id) => imeIdInList(id, list));
    return {
      match: still.length === 0,
      note:
        still.length === 0
          ? "Cancel disabled：包名已不在禁用列表（解除成功）"
          : `Cancel disabled：仍在禁用列表：${still.join("; ")}`,
    };
  }
  // Add disabled（默认）：期望中每一个都要在设备列表里
  if (/add/.test(act) || !act) {
    if (!expectedIds.length) {
      return { match: !list, note: "Add disabled：无包名期望" };
    }
    const missing = expectedIds.filter((id) => !imeIdInList(id, list));
    return {
      match: missing.length === 0,
      note:
        missing.length === 0
          ? `Add disabled：已禁用 ${expectedIds.length} 个输入法`
          : `Add disabled：未禁用：${missing.join("; ")}`,
    };
  }
  return { match: false, note: `未知 Disable Action：${action}` };
}

/** zh-CN ≡ zh-CN,zh-Hans-CN（主语言一致即可） */
export function systemLocalesEqual(expected: string, actual: string): boolean {
  const exp = expected.trim();
  const act = actual.trim();
  if (!exp || !act) return false;
  if (exp === act) return true;
  const primary = act.split(",")[0]?.trim() ?? act;
  if (exp.toLowerCase() === primary.toLowerCase()) return true;
  // 设备仅返回主语言、OEM 带列表时反向也认
  const expPrimary = exp.split(",")[0]?.trim() ?? exp;
  return expPrimary.toLowerCase() === primary.toLowerCase();
}

/** IME 包名：完全相等，或期望包名出现在设备列表/完整 ComponentName 中 */
export function imePackageEqual(expected: string, actual: string): boolean {
  const exp = expected.trim();
  const act = actual.trim();
  if (!exp || !act) return false;
  if (exp === act) return true;
  const el = exp.toLowerCase();
  const al = act.toLowerCase();
  if (al.includes(el) || el.includes(al)) return true;
  // 比 package 段（/ 前）
  const expPkg = el.split("/")[0] ?? el;
  const parts = al.split(/[;,\s]+/).filter(Boolean);
  for (const p of parts) {
    const pkg = p.split("/")[0] ?? p;
    if (pkg === expPkg || p.includes(el) || el.includes(p)) return true;
  }
  return false;
}

function isAutoBrightnessOn(
  values: Map<string, ProbeResult> | undefined,
  entryAuto?: string,
): boolean {
  const r = values?.get("syscfg.displayStep__displayAutoBrightness");
  const device = (r?.raw ?? r?.display ?? "").toString().trim().toLowerCase();
  if (device === "1" || device === "enable" || device === "true") return true;
  const exp = (entryAuto ?? "").toString().trim().toLowerCase();
  if (exp === "1" || exp === "enable" || exp === "true") return true;
  return false;
}

export function compareProbeToExpect(
  probeId: string,
  meta: ProbeMeta | undefined,
  result: ProbeResult | undefined,
  entry: ExpectEntry,
  allValues?: Map<string, ProbeResult>,
  allExpect?: Record<string, ExpectEntry>,
): CompareRow {
  let expectedRaw = normalizeExpectRaw(probeId, meta, entry.value);
  if (probeId === "scan.scanTriggerMode") {
    expectedRaw = canonicalScanTriggerRaw(expectedRaw);
  }
  const expectedDisplay = displayLabelForExpectRaw(
    meta,
    expectedRaw,
    entry.hint,
  );
  if (result?.platformCompareExempt) {
    return {
      probeId,
      status: "platform_locked",
      expectedRaw,
      expectedHint: entry.hint,
      expectedDisplay,
      actualRaw: result.raw,
      actualDisplay: result.display,
      platformNote: result.platformCompareExempt.message,
    };
  }
  // 自动亮度开启时，screen_brightness 为环境自适应值，不与 OEM 目标 255 硬比
  if (
    isBrightnessProbe(probeId) &&
    isAutoBrightnessOn(
      allValues,
      allExpect?.["syscfg.displayStep__displayAutoBrightness"]?.value,
    )
  ) {
    return {
      probeId,
      status: "platform_locked",
      expectedRaw,
      expectedHint: entry.hint,
      expectedDisplay,
      actualRaw: result?.raw ?? null,
      actualDisplay: result?.display ?? result?.raw ?? "—",
      platformNote: "自动亮度已开启：当前亮度为自适应值，不与 OEM 目标比对",
    };
  }
  // 有 JSON 期望但尚无设备直读：计入「未读到」，禁止再变成 一致 0/0 · 无直读 N
  if (isNoDirectReadProbe(result)) {
    return {
      probeId,
      status: "unread",
      expectedRaw,
      expectedHint: entry.hint,
      expectedDisplay,
      actualRaw: null,
      actualDisplay: "未读到",
      platformNote: "该项尚无 ADB/USDK 直读；JSON 期望已加载，请补探针或仅作期望对照",
    };
  }
  const emptyOk = allowsEmptyRaw(probeId);
  if (
    !result ||
    !result.ok ||
    result.raw == null ||
    (!emptyOk && result.raw === "")
  ) {
    return {
      probeId,
      status: "unread",
      expectedRaw,
      expectedHint: entry.hint,
      expectedDisplay,
      actualRaw: result?.raw ?? null,
      actualDisplay: result?.display,
    };
  }
  let actualRaw = result.raw;
  if (probeId === "scan.scanTriggerMode" && actualRaw) {
    actualRaw = canonicalScanTriggerRaw(actualRaw);
  }
  // Disable Input Method：按 Action（Add/Cancel/Clear）解释包名期望
  if (isDisableImiListProbe(probeId)) {
    const action =
      allExpect?.[
        "syscfg.languageInputStep__disableInputMethodStep__disableInputMethodAction"
      ]?.value ?? "";
    const verdict = disableImiListMatches(action, expectedRaw, actualRaw ?? "");
    return {
      probeId,
      status: verdict.match ? "match" : "mismatch",
      expectedRaw,
      expectedHint: entry.hint,
      expectedDisplay,
      actualRaw: result.raw,
      actualDisplay:
        result.display ||
        (actualRaw && actualRaw.trim() ? actualRaw : "（无禁用）"),
      platformNote: verdict.note,
    };
  }
  // 侧边栏位置：侧边栏关闭时不可见，不必硬比；非 630 机型由读侧 unsupported 豁免
  if (isSideAppBarPositionProbe(probeId)) {
    const modeExp =
      allExpect?.["syscfg.systemUiStep__sideAppBarMode"]?.value ?? "";
    const modeDev = allValues?.get("syscfg.systemUiStep__sideAppBarMode");
    const modeOff =
      /disable/i.test(modeExp) ||
      modeDev?.raw === "0" ||
      /disable/i.test(String(modeDev?.display ?? ""));
    if (modeOff) {
      return {
        probeId,
        status: "platform_locked",
        expectedRaw,
        expectedHint: entry.hint,
        expectedDisplay,
        actualRaw: result.raw,
        actualDisplay: result.display ?? "—",
        platformNote:
          "侧边栏已关闭（Disable），设备上看不到侧边栏，位置项免测/不硬比",
      };
    }
  }
  // 当前键盘 + 禁用动作同包推送时的已知坑
  if (isImePackageProbe(probeId) && allExpect) {
    const action =
      allExpect[
        "syscfg.languageInputStep__disableInputMethodStep__disableInputMethodAction"
      ]?.value ?? "";
    const disabledPkgs =
      allExpect[
        "syscfg.languageInputStep__disableInputMethodStep__disableInputMethod"
      ]?.value ?? "";
    const deviceMatch = rawEqual(meta, expectedRaw, actualRaw, {
      probeId,
      volumeMax: result.volumeMax,
    });
    if (/add/i.test(action) && imeIdInList(expectedRaw, disabledPkgs)) {
      return {
        probeId,
        status: deviceMatch ? "match" : "platform_locked",
        expectedRaw,
        expectedHint: entry.hint,
        expectedDisplay,
        actualRaw: result.raw,
        actualDisplay: result.display,
        platformNote:
          "OEM 自相矛盾：当前键盘也在「Add disabled」列表中；禁用后系统会改用其它输入法，不与 JSON 当前键盘硬比",
      };
    }
    // Clear 常排在 setDefault 之后：清空禁用会重置默认输入法，同包「当前键盘」易被冲掉
    if (/clear/i.test(action) && !deviceMatch) {
      return {
        probeId,
        status: "mismatch",
        expectedRaw,
        expectedHint: entry.hint,
        expectedDisplay,
        actualRaw: result.raw,
        actualDisplay: result.display,
        platformNote:
          "疑似下发顺序：先设当前键盘再 Clear disabled 时，Clear 会把默认输入法打回系统项；请先 Clear/Cancel 再单独推当前键盘，或分两次配置",
      };
    }
  }
  const match = rawEqual(meta, expectedRaw, actualRaw, {
    probeId,
    volumeMax: result.volumeMax,
  });
  // 展示侧以 OEM 文案为主
  let actualDisplay = result.display;
  if (match && isOemVolumeProbeId(probeId)) {
    actualDisplay = expectedDisplay;
  } else if (isDisplayFontProbe(probeId) && result.raw) {
    actualDisplay = normalizeDisplayFontRaw(result.raw);
  } else if (isDisplayTimeoutProbe(probeId) && result.raw) {
    actualDisplay = normalizeDisplayTimeoutRaw(result.raw);
  } else if (isStayAwakeProbe(probeId) && result.raw) {
    actualDisplay = normalizeStayAwakeRaw(result.raw);
  }
  return {
    probeId,
    status: match ? "match" : "mismatch",
    expectedRaw,
    expectedHint: entry.hint,
    expectedDisplay,
    actualRaw: result.raw,
    actualDisplay,
  };
}

export function compareTemplateToValues(
  template: ExpectTemplate,
  probeMeta: Map<string, ProbeMeta>,
  values: Map<string, ProbeResult>,
  /** 仅保留当前面板相关探针（避免全量 System JSON 串到 Date & Time） */
  scopeProbeIds?: ReadonlySet<string> | null,
): CompareRow[] {
  return Object.entries(template.expectations)
    .filter(([probeId]) => !scopeProbeIds || scopeProbeIds.has(probeId))
    .map(([probeId, entry]) =>
      compareProbeToExpect(
        probeId,
        probeMeta.get(probeId),
        values.get(probeId),
        entry,
        values,
        template.expectations,
      ),
    );
}

export function summarizeCompare(rows: CompareRow[]): {
  match: number;
  mismatch: number;
  unread: number;
  platformLocked: number;
  outOfScope: number;
  total: number;
} {
  let match = 0;
  let mismatch = 0;
  let unread = 0;
  let platformLocked = 0;
  let outOfScope = 0;
  for (const r of rows) {
    if (r.status === "out_of_scope") {
      outOfScope++;
      continue;
    }
    if (r.status === "platform_locked") {
      platformLocked++;
      match++;
    } else if (r.status === "match") match++;
    else if (r.status === "mismatch") mismatch++;
    else unread++;
  }
  return {
    match,
    mismatch,
    unread,
    platformLocked,
    outOfScope,
    total: rows.length - outOfScope,
  };
}

/** 下发验收通过：值一致，或平台强制（推送可能被 MDM 覆盖，计为一致） */
export function isCompareAcceptPass(status: CompareStatus | undefined): boolean {
  return status === "match" || status === "platform_locked";
}

/** 需在「仅显示异常」中保留的对比状态 */
export function isCompareAbnormal(status: CompareStatus | undefined): boolean {
  return status === "mismatch" || status === "unread";
}

