import type { AppConfig, ProbeResult, ProbeRunnerSpec, ProbeSpec } from "./types.js";
import { adbShell, settingsGet } from "./adb.js";
import {
  classifyDeviceError,
  softReadSupportHint,
} from "./probeSupport.js";
import {
  normalizeLockPasswordTypeRaw,
  normalizeUsbModeFromProp,
} from "./oemNormalize.js";
import { securityBridgeGet } from "./securityBridge.js";

function labelFor(
  spec: ProbeSpec,
  raw: string | null,
): string {
  if (raw == null || raw === "") return "—";
  const labels = spec.labels;
  if (labels && raw in labels) return labels[raw];
  if (labels) {
    for (const [k, v] of Object.entries(labels)) {
      if (raw.includes(k)) return v;
    }
  }
  if (raw === "null" || raw === "NULL") return "未设置";
  return raw;
}

async function runRunner(
  config: AppConfig,
  runner: ProbeRunnerSpec,
  shellTimeoutMs?: number,
): Promise<{ raw: string | null; note?: string; displayOverride?: string }> {
  switch (runner.kind) {
    case "static":
      return { raw: null, note: runner.note };
    case "usdk":
      if (runner.fallback) {
        return runRunner(config, runner.fallback);
      }
      return { raw: null, note: `USDK ${runner.api} 未实现` };
    case "security.bridge": {
      const { raw, note } = await securityBridgeGet(config, runner.feature);
      if (raw != null && raw !== "") return { raw };
      if (runner.fallback) {
        const fb = await runRunner(config, runner.fallback);
        if (fb.raw != null && fb.raw !== "") return fb;
        if (!note) return fb;
      }
      return { raw, note };
    }
    case "adb.settings": {
      let raw = await settingsGet(config, runner.namespace, runner.key);
      if (runner.key === "lockscreen.password_type") {
        raw = normalizeLockPasswordTypeRaw(raw) ?? raw;
      }
      return { raw };
    }
    case "adb.shell": {
      let raw = await adbShell(config, runner.cmd, shellTimeoutMs ?? 8000);
      if (runner.parse === "regex" && runner.pattern) {
        const re = new RegExp(runner.pattern);
        const m = raw.match(re);
        raw = m?.[1] ?? raw;
      }
      if (runner.parse === "contains" && runner.map) {
        const entries = Object.entries(runner.map).sort(
          (a, b) => b[0].length - a[0].length,
        );
        for (const [needle, mapped] of entries) {
          if (raw.includes(needle)) {
            if (
              mapped === "0" ||
              mapped === "1" ||
              mapped === "true" ||
              mapped === "false"
            ) {
              return { raw: mapped };
            }
            return { raw: needle, displayOverride: mapped };
          }
        }
        const usb = normalizeUsbModeFromProp(raw);
        if (usb != null) return { raw: usb };
      }
      return { raw };
    }
    default:
      return { raw: null, note: "未知 probe kind" };
  }
}

function resolveReadRunner(spec: ProbeSpec): ProbeRunnerSpec {
  if (spec.readAfterWrite) return spec.readAfterWrite;
  if (spec.probe.kind === "usdk" && spec.probe.fallback) {
    return spec.probe.fallback;
  }
  return spec.probe;
}

function shortenReadNote(note: string): string {
  if (note.includes("Failed resolution") || note.includes("DeviceManagerEx")) {
    return "USDK 不可用";
  }
  if (note.includes("桥接无响应")) return "桥接无响应";
  if (note.includes("Security 批量读") || note.includes("securityGetBatch")) {
    return "读失败";
  }
  if (note.length > 56) return `${note.slice(0, 56)}…`;
  return note;
}

function buildDisplay(
  spec: ProbeSpec,
  raw: string | null,
  note?: string,
  displayOverride?: string,
): string {
  if (displayOverride) return displayOverride;
  if (note && (raw == null || raw === "")) return shortenReadNote(note);
  if (spec.display.type === "diff") {
    return note ?? "导入 SOTI 策略 JSON 后可对账";
  }
  return labelFor(spec, raw);
}

/** 写入后快速回读（仅单探针，不走 group） */
export async function readProbeValue(
  config: AppConfig,
  spec: ProbeSpec,
  shellTimeoutMs = 3500,
): Promise<ProbeResult> {
  const at = Date.now();
  const runner = resolveReadRunner(spec);
  const { raw, note, displayOverride } = await runRunner(
    config,
    runner,
    shellTimeoutMs,
  );
  return {
    probeId: spec.id,
    ok: true,
    raw,
    display: buildDisplay(spec, raw, note, displayOverride),
    at,
  };
}

export function buildProbeResultFromRead(
  spec: ProbeSpec,
  raw: string | null,
  note?: string,
  displayOverride?: string,
): ProbeResult {
  const at = Date.now();
  const display = buildDisplay(spec, raw, note, displayOverride);
  const readFailed = (raw == null || raw === "") && Boolean(note);
  const soft = softReadSupportHint(display, raw);
  return {
    probeId: spec.id,
    ok: !readFailed,
    raw,
    display,
    error: readFailed ? note : undefined,
    supportStatus: soft?.status,
    supportMessage: soft?.userMessage,
    at,
  };
}

export function probeResultFromWriteMode(
  spec: ProbeSpec,
  mode: "on" | "off",
): ProbeResult {
  const raw = mode === "on" ? "1" : "0";
  const labels = spec.labels;
  const display =
    mode === "on"
      ? (labels?.["1"] ?? labels?.["true"] ?? "开")
      : (labels?.["0"] ?? labels?.["false"] ?? "关");
  return {
    probeId: spec.id,
    ok: true,
    raw,
    display,
    at: Date.now(),
  };
}

export async function executeProbe(
  config: AppConfig,
  spec: ProbeSpec,
  registryById: Map<string, ProbeSpec>,
): Promise<ProbeResult> {
  const at = Date.now();
  try {
    if (spec.display.type === "group" && spec.probe.kind === "static") {
      const members = spec.probe.members ?? [];
      const lines: string[] = [];
      for (const mid of members) {
        const child = registryById.get(mid);
        if (!child) {
          lines.push(`${mid}: ?`);
          continue;
        }
        const childRes = await executeProbe(config, child, registryById);
        lines.push(`${child.item}: ${childRes.display}`);
      }
      return {
        probeId: spec.id,
        ok: true,
        raw: null,
        display: lines.join("\n"),
        at,
      };
    }

    const { raw, note, displayOverride } = await runRunner(config, spec.probe);
    let display: string;
    if (displayOverride) {
      display = displayOverride;
    } else if (note && (raw == null || raw === "")) {
      display = note;
    } else if (spec.display.type === "diff") {
      display = note ?? "导入 SOTI 策略 JSON 后可对账";
    } else {
      display = labelFor(spec, raw);
    }
    const soft = softReadSupportHint(display, raw);
    return {
      probeId: spec.id,
      ok: true,
      raw,
      display,
      supportStatus: soft?.status,
      supportMessage: soft?.userMessage,
      at,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const classified = classifyDeviceError(msg);
    return {
      probeId: spec.id,
      ok: false,
      raw: null,
      display:
        classified.status === "ok" ? "错误" : classified.userMessage,
      error: msg,
      supportStatus: classified.status === "ok" ? undefined : classified.status,
      supportMessage:
        classified.status === "ok" ? undefined : classified.userMessage,
      at,
    };
  }
}
