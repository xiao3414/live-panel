import type { AppConfig, ProbeRunnerSpec, ProbeSpec } from "./types.js";
import { adbShell, settingsPut } from "./adb.js";
import { isUsdkRuntimeBroken } from "./securityProbeRead.js";

export function probeAdbReadFallback(
  spec: ProbeSpec,
): ProbeRunnerSpec | null {
  if (spec.probe.kind !== "security.bridge") return null;
  const fb = spec.probe.fallback;
  if (!fb) return null;
  if (fb.kind === "adb.settings" || fb.kind === "adb.shell") return fb;
  return null;
}

function quoteShellValue(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function applyAdbFallbackToggle(
  config: AppConfig,
  fallback: ProbeRunnerSpec,
  mode: "on" | "off",
): Promise<void> {
  if (fallback.kind === "adb.settings") {
    const w = fallback as { namespace: string; key: string; values?: { on: string; off: string } };
    let raw = mode === "on" ? w.values?.on : w.values?.off;
    if (raw == null) {
      if (w.key === "location_mode") {
        raw = mode === "on" ? "3" : "0";
      } else {
        raw = mode === "on" ? "1" : "0";
      }
    }
    await settingsPut(config, w.namespace, w.key, raw);
    return;
  }
  if (fallback.kind === "adb.shell") {
    await adbShell(config, fallback.cmd);
    return;
  }
  throw new Error("不支持的 ADB fallback 类型");
}

export function isUsdkWriteError(msg: string): boolean {
  return (
    isUsdkRuntimeBroken(msg) ||
    msg.includes("Failed resolution") ||
    msg.includes("usdk_not_available") ||
    msg.includes("Permission denial") ||
    msg.includes("WRITE_SECURE_SETTINGS") ||
    msg.includes("WRITE_SETTINGS") ||
    msg.includes("securitySet") ||
    msg.includes("write_no_effect")
  );
}

export function expectedToggleRaw(
  spec: ProbeSpec,
  mode: "on" | "off",
): string {
  const write = spec.write;
  if (write && typeof write === "object" && write.kind === "adb.settings") {
    return mode === "on" ? write.values.on : write.values.off;
  }
  return mode === "on" ? "1" : "0";
}

export function rawMatchesExpected(
  spec: ProbeSpec,
  expected: string,
  actual: string | null,
): boolean {
  if (actual == null || actual === "") return false;
  if (actual === expected) return true;
  if (expected === "1" && (actual === "true" || actual === "1")) return true;
  if (expected === "0" && (actual === "false" || actual === "0")) return true;
  const labels = spec.labels;
  if (labels && labels[expected] && labels[actual] === labels[expected]) {
    return true;
  }
  return false;
}
