import type { ProbeMeta, ProbeResult } from "./types";

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

function normToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

/** 将模板中的 human 值归一化为 probe raw（与 registry labels 对齐） */
export function normalizeExpectRaw(
  probeId: string,
  meta: ProbeMeta | undefined,
  expectValue: string,
): string {
  const v = expectValue.trim();
  if (!v) return v;
  const lower = normToken(v);

  if (meta?.valueLabels) {
    for (const [raw, label] of Object.entries(meta.valueLabels)) {
      if (normToken(label) === lower || label === v) return raw;
    }
  }

  if (meta?.displayType === "enum") {
    if (lower === "pin") return "pin";
    if (lower === "none" || lower === "无") return "none";
    if (lower === "slide" || lower === "滑动") return "slide";
    if (lower === "pattern" || lower === "图案") return "pattern";
  }

  if (meta?.displayType === "toggle") {
    if (probeId === "sec.disallow_screenshot") {
      if (lower === "disallow" || lower === "禁止截图") return "1";
      if (lower === "allow" || lower === "允许") return "0";
    }
    if (TRUTHY.has(lower) || v === meta.labelOn) return "1";
    if (FALSY.has(lower) || v === meta.labelOff) return "0";
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
  if (meta?.valueLabels?.[expectedRaw]) {
    return meta.valueLabels[expectedRaw];
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

export function actualDisplayLabel(row: CompareRow): string {
  if (row.actualDisplay && row.actualDisplay !== "…") return row.actualDisplay;
  if (row.actualRaw == null || row.actualRaw === "") return "未读到";
  return row.actualRaw;
}

/** 策略 JSON 文件中的原始写法（如 Disable / PIN / 10 minutes） */
export function jsonOriginalConfigLabel(row: CompareRow): string {
  return oemHintValue(row.expectedHint) ?? row.expectedDisplay;
}

function rawEqual(
  meta: ProbeMeta | undefined,
  expected: string,
  actual: string | null,
): boolean {
  if (actual == null || actual === "") return false;
  if (actual === expected) return true;
  const a = actual.toLowerCase();
  const e = expected.toLowerCase();
  if (a === e) return true;
  if (meta?.valueLabels) {
    const le = meta.valueLabels[expected];
    const la = meta.valueLabels[actual];
    if (le && la && le === la) return true;
  }
  if (
    (expected === "1" && (actual === "true" || a === "bool:1")) ||
    (expected === "0" && (actual === "false" || a === "bool:0"))
  ) {
    return true;
  }
  return false;
}

export function compareProbeToExpect(
  probeId: string,
  meta: ProbeMeta | undefined,
  result: ProbeResult | undefined,
  entry: ExpectEntry,
): CompareRow {
  const expectedRaw = normalizeExpectRaw(probeId, meta, entry.value);
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
  if (!result || !result.ok || result.raw == null || result.raw === "") {
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
  const match = rawEqual(meta, expectedRaw, result.raw);
  return {
    probeId,
    status: match ? "match" : "mismatch",
    expectedRaw,
    expectedHint: entry.hint,
    expectedDisplay,
    actualRaw: result.raw,
    actualDisplay: result.display,
  };
}

export function compareTemplateToValues(
  template: ExpectTemplate,
  probeMeta: Map<string, ProbeMeta>,
  values: Map<string, ProbeResult>,
): CompareRow[] {
  return Object.entries(template.expectations).map(([probeId, entry]) =>
    compareProbeToExpect(
      probeId,
      probeMeta.get(probeId),
      values.get(probeId),
      entry,
    ),
  );
}

export function summarizeCompare(rows: CompareRow[]): {
  match: number;
  mismatch: number;
  unread: number;
  platformLocked: number;
  total: number;
} {
  let match = 0;
  let mismatch = 0;
  let unread = 0;
  let platformLocked = 0;
  for (const r of rows) {
    if (r.status === "platform_locked") {
      platformLocked++;
      match++;
    } else if (r.status === "match") match++;
    else if (r.status === "mismatch") mismatch++;
    else unread++;
  }
  return { match, mismatch, unread, platformLocked, total: rows.length };
}

/** 下发验收通过：值一致，或平台强制（推送可能被 MDM 覆盖，计为一致） */
export function isCompareAcceptPass(status: CompareStatus | undefined): boolean {
  return status === "match" || status === "platform_locked";
}

/** 需在「仅显示异常」中保留的对比状态 */
export function isCompareAbnormal(status: CompareStatus | undefined): boolean {
  return status === "mismatch" || status === "unread";
}

