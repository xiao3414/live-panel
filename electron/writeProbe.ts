import type { AppConfig, ProbeSpec, WriteSpec } from "./types.js";
import { adbShell } from "./adb.js";
import {
  applyAdbFallbackToggle,
  isUsdkWriteError,
  probeAdbReadFallback,
} from "./probeWriteFallback.js";
import { securityBridgeSet } from "./securityBridge.js";

function defaultOnOffValues(
  labels?: Record<string, string>,
): { on: string; off: string } {
  if (labels && "1" in labels && "0" in labels) {
    return { on: "1", off: "0" };
  }
  if (labels && "true" in labels && "false" in labels) {
    return { on: "true", off: "false" };
  }
  return { on: "1", off: "0" };
}

/** 是否允许从 UI 写回设备 */
export function resolveWriteSpec(spec: ProbeSpec): WriteSpec | null {
  if (spec.risk === "block") return null;
  if (spec.write === false) return null;

  if (spec.write && typeof spec.write === "object") {
    return spec.write;
  }

  if (spec.display.type !== "toggle") return null;

  if (spec.probe.kind === "adb.settings") {
    const { on, off } = defaultOnOffValues(spec.labels);
    return {
      kind: "adb.settings",
      namespace: spec.probe.namespace,
      key: spec.probe.key,
      values: { on, off },
    };
  }

  return null;
}

async function securityBridgeSetWithToggleFallback(
  config: AppConfig,
  spec: ProbeSpec,
  feature: string,
  mode: "on" | "off",
): Promise<void> {
  const value = mode === "on" ? "on" : "off";
  try {
    await securityBridgeSet(config, feature, value);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fb = probeAdbReadFallback(spec);
    if (fb && isUsdkWriteError(msg)) {
      await applyAdbFallbackToggle(config, fb, mode);
      return;
    }
    throw e;
  }
}

export async function applyProbeWriteValue(
  config: AppConfig,
  spec: ProbeSpec,
  value: string,
): Promise<void> {
  const write = resolveWriteSpec(spec);
  if (!write || write.kind !== "security.bridge") {
    throw new Error(`${spec.id} 不支持写入指定值`);
  }
  try {
    await securityBridgeSet(config, write.feature, value);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fb = probeAdbReadFallback(spec);
    if (
      fb &&
      isUsdkWriteError(msg) &&
      (value === "0" || value === "1" || value === "on" || value === "off")
    ) {
      const mode: "on" | "off" =
        value === "1" || value === "on" ? "on" : "off";
      await applyAdbFallbackToggle(config, fb, mode);
      return;
    }
    throw e;
  }
}

function quoteShellValue(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function applyProbeWrite(
  config: AppConfig,
  spec: ProbeSpec,
  mode: "on" | "off",
): Promise<void> {
  const write = resolveWriteSpec(spec);
  if (!write) {
    throw new Error(`${spec.id} 不支持从实况面板写入`);
  }

  switch (write.kind) {
    case "adb.settings": {
      const rawValue = mode === "on" ? write.values.on : write.values.off;
      const cmd = `settings put ${write.namespace} ${write.key} ${quoteShellValue(rawValue)}`;
      await adbShell(config, cmd);
      return;
    }
    case "adb.shell": {
      const cmd = mode === "on" ? write.onCmd : write.offCmd;
      await adbShell(config, cmd);
      return;
    }
    case "security.bridge": {
      await securityBridgeSetWithToggleFallback(
        config,
        spec,
        write.feature,
        mode,
      );
      return;
    }
    default:
      throw new Error(`未知 write.kind`);
  }
}
