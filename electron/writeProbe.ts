import type { AppConfig, ProbeSpec, WriteSpec } from "./types.js";
import { adbShell } from "./adb.js";
import {
  applyAdbFallbackToggle,
  isUsdkWriteError,
  probeAdbReadFallback,
} from "./probeWriteFallback.js";
import { applyDockingSettings } from "./dockingBridge.js";
import { securityBridgeSet } from "./securityBridge.js";
import { resolveSideAppBarSupport } from "./sideAppBarCapability.js";
import { scanWedgeSetProperty } from "./scanWedgeWrite.js";
import {
  isOemVolumeSettingsKey,
  writeOemVolumePercent,
} from "./volumeAudio.js";
import {
  isDisplayFontScaleKey,
  isDisplayTimeoutKey,
  isStayAwakeKey,
  oemToFontScale,
  oemToStayAwakeRaw,
  oemToTimeoutMs,
} from "./displayOem.js";

/** 面板/期望 raw → DataWedge 属性值（多为数字字符串） */
function toScanWedgeWriteValue(
  property: string,
  value: string,
  spec: ProbeSpec,
): string {
  const v = value.trim();
  if (/^\d+$/.test(v)) return v;
  if (property === "TRIGGERING_MODES") {
    const t = v.toLowerCase();
    if (t.includes("hand_free") || t.includes("hand-free")) return "8";
    if (t.includes("short_press_continuous") || t === "1") return "1";
    if (t.includes("long_press_continuous")) return "3";
    if (t.includes("long_press")) return "2";
    if (t.includes("short_press") || t.includes("decode_or_timeout")) return "0";
  }
  if (property === "VIEW_FINDER_SIZE") {
    const t = v.toLowerCase();
    if (t.includes("full")) return "0";
    if (t.includes("expand")) return "1";
    if (t.includes("regular")) return "2";
  }
  if (property === "GOOD_READ_BEEP_ENABLE") {
    const t = v.toLowerCase();
    if (t === "none" || t === "无") return "0";
    if (t === "short" || t === "短") return "1";
    if (t === "sharp" || t === "尖" || t === "高") return "2";
  }
  if (property === "MULTI_DECODE_COORD_SORT") {
    const t = v.toLowerCase();
    if (t.includes("top")) return "0";
    if (t.includes("left")) return "1";
    if (t.includes("vertical")) return "2";
  }
  if (spec.labels) {
    for (const [raw, label] of Object.entries(spec.labels)) {
      const text = String(label ?? "");
      if (raw === v) return /^\d+$/.test(raw) ? raw : v;
      if (text === v || text.toLowerCase() === v.toLowerCase()) {
        if (/^\d+$/.test(raw)) return raw;
      }
    }
    // 期望侧常写 short_press_*，labels 里同时有数字键
    for (const [raw, label] of Object.entries(spec.labels)) {
      const text = String(label ?? "");
      if (
        /^\d+$/.test(raw) &&
        text.replace(/\s+/g, "_").toLowerCase() ===
          v.replace(/\s+/g, "_").toLowerCase()
      ) {
        return raw;
      }
    }
  }
  if (/^(enable|enabled|on|true)$/i.test(v)) return "1";
  if (/^(disable|disabled|off|false)$/i.test(v)) return "0";
  return v;
}

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

  if (
    spec.probe.kind === "security.bridge" &&
    (spec.display.type === "toggle" ||
      spec.display.type === "enum" ||
      spec.display.type === "text")
  ) {
    return { kind: "security.bridge", feature: spec.probe.feature };
  }

  if (spec.probe.kind === "adb.settings") {
    if (spec.display.type === "toggle") {
      const { on, off } = defaultOnOffValues(spec.labels);
      return {
        kind: "adb.settings",
        namespace: spec.probe.namespace,
        key: spec.probe.key,
        values: { on, off },
      };
    }
    if (spec.display.type === "enum" || spec.display.type === "text") {
      return {
        kind: "adb.settings",
        namespace: spec.probe.namespace,
        key: spec.probe.key,
      };
    }
  }

  if (spec.probe.kind === "scan.field" && spec.probe.property) {
    if (spec.display.type === "toggle") {
      const { on, off } = defaultOnOffValues(spec.labels);
      return {
        kind: "scan.property",
        property: spec.probe.property,
        values: { on, off },
      };
    }
    if (spec.display.type === "enum" || spec.display.type === "text") {
      return {
        kind: "scan.property",
        property: spec.probe.property,
      };
    }
  }

  if (spec.probe.kind === "docking.field") {
    if (spec.display.type === "toggle") {
      const { on, off } = defaultOnOffValues(spec.labels);
      return {
        kind: "docking.field",
        field: spec.probe.field,
        values: { on, off },
      };
    }
    if (spec.display.type === "enum" || spec.display.type === "text") {
      return {
        kind: "docking.field",
        field: spec.probe.field,
      };
    }
  }

  return null;
}

/** docking.field → applyDockingSettings extras */
async function applyDockingFieldWrite(
  config: AppConfig,
  field: string,
  rawValue: string,
): Promise<void> {
  const v = rawValue.trim();
  const asTri = (): "enable" | "disable" => {
    if (/^(1|true|enable|enabled|on)$/i.test(v)) return "enable";
    if (/^(0|false|disable|disabled|off)$/i.test(v)) return "disable";
    throw new Error(`Docking 开关值无效: ${v}`);
  };
  switch (field) {
    case "bottomHost":
      await applyDockingSettings(config, { bottomHost: asTri() });
      return;
    case "backHost":
      await applyDockingSettings(config, { backHost: asTri() });
      return;
    case "ethernet":
      await applyDockingSettings(config, { ethernet: asTri() });
      return;
    case "ipMode": {
      const mode = /static/i.test(v)
        ? "Static"
        : /dhcp/i.test(v)
          ? "DHCP"
          : null;
      if (!mode) throw new Error(`Docking IP 模式无效: ${v}`);
      await applyDockingSettings(config, { ipMode: mode });
      return;
    }
    case "ipAddress":
      await applyDockingSettings(config, { ipMode: "Static", ipAddress: v });
      return;
    case "gateway":
      await applyDockingSettings(config, { ipMode: "Static", gateway: v });
      return;
    case "netmask":
      await applyDockingSettings(config, { ipMode: "Static", netmask: v });
      return;
    case "dns1":
      await applyDockingSettings(config, { ipMode: "Static", dns1: v });
      return;
    case "dns2":
      await applyDockingSettings(config, { ipMode: "Static", dns2: v });
      return;
    case "proxyHost":
      await applyDockingSettings(config, { proxyHost: v });
      return;
    case "proxyPort":
      await applyDockingSettings(config, { proxyPort: v });
      return;
    case "proxyBypass":
      await applyDockingSettings(config, { proxyBypass: v });
      return;
    default:
      throw new Error(`Docking 字段不可写: ${field}`);
  }
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
  if (!write) {
    throw new Error(`${spec.id} 不支持写入指定值`);
  }
  if (write.kind === "scan.property") {
    await scanWedgeSetProperty(
      config,
      write.property,
      toScanWedgeWriteValue(write.property, value, spec),
    );
    return;
  }
  if (write.kind === "docking.field") {
    await applyDockingFieldWrite(config, write.field, value);
    return;
  }
  if (write.kind === "adb.settings") {
    let raw = value.trim();
    if (write.values) {
      if (/^(enable|enabled|on|auto|true)$/i.test(raw)) raw = write.values.on;
      else if (/^(disable|disabled|off|manual|false)$/i.test(raw))
        raw = write.values.off;
    } else if (spec.display?.type === "toggle") {
      // Enable/Disable → 1/0（勿被 labels 里 Enable:Enable 原样留下；settings 拒收非数字）
      if (/^(enable|enabled|on|auto|true|1)$/i.test(raw)) raw = "1";
      else if (/^(disable|disabled|off|manual|false|0)$/i.test(raw)) raw = "0";
    } else if (spec.labels) {
      // 优先匹配数字键（设备 raw），避免 Enable→Enable
      let mapped: string | undefined;
      for (const [k, label] of Object.entries(spec.labels)) {
        const text = String(label ?? "");
        if (
          k === raw ||
          text === raw ||
          text.toLowerCase() === raw.toLowerCase()
        ) {
          if (/^\d+(\.\d+)?$/.test(k)) {
            mapped = k;
            break;
          }
          if (!mapped) mapped = k;
        }
      }
      if (mapped) raw = mapped;
    }
    // 兜底：toggle/加速度旋转等仍收到 OEM 文案时强制数字化
    if (
      spec.display?.type === "toggle" ||
      write.key === "accelerometer_rotation"
    ) {
      if (/^(enable|enabled|on|auto|true)$/i.test(raw)) raw = "1";
      else if (/^(disable|disabled|off|manual|false)$/i.test(raw)) raw = "0";
    }
    if (isOemVolumeSettingsKey(write.key)) {
      await writeOemVolumePercent(config, write.key, raw);
      return;
    }
    if (isDisplayFontScaleKey(write.key)) {
      raw = oemToFontScale(raw);
    } else if (isDisplayTimeoutKey(write.key)) {
      raw = oemToTimeoutMs(raw);
    } else if (isStayAwakeKey(write.key)) {
      raw = oemToStayAwakeRaw(raw);
    }
    if (
      (write.key === "accelerometer_rotation" ||
        spec.display?.type === "toggle") &&
      !/^\d+$/.test(raw)
    ) {
      throw new Error(
        `${spec.id} 写入值无效（需 0/1，收到「${value.trim()}」→「${raw}」）`,
      );
    }
    const cmd = `settings put ${write.namespace} ${write.key} ${quoteShellValue(raw)}`;
    await adbShell(config, cmd);
    return;
  }
  if (write.kind !== "security.bridge") {
    throw new Error(`${spec.id} 不支持写入指定值`);
  }
  if (
    write.feature === "side_app_bar" ||
    write.feature === "side_app_bar_left"
  ) {
    const cap = await resolveSideAppBarSupport(config);
    if (!cap.supported) {
      throw new Error(
        cap.note ?? "侧边栏仅 DT630 等机型支持，本项免测/不可写",
      );
    }
  }
  let bridgeValue = value.trim();
  if (spec.display?.type === "toggle") {
    if (/^(enable|enabled|on|auto|true|1)$/i.test(bridgeValue))
      bridgeValue = "on";
    else if (/^(disable|disabled|off|manual|false|0)$/i.test(bridgeValue))
      bridgeValue = "off";
  }
  try {
    await securityBridgeSet(config, write.feature, bridgeValue);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fb = probeAdbReadFallback(spec);
    if (
      fb &&
      isUsdkWriteError(msg) &&
      (bridgeValue === "0" ||
        bridgeValue === "1" ||
        bridgeValue === "on" ||
        bridgeValue === "off")
    ) {
      const mode: "on" | "off" =
        bridgeValue === "1" || bridgeValue === "on" ? "on" : "off";
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
      const pair = write.values ?? defaultOnOffValues(spec.labels);
      const rawValue = mode === "on" ? pair.on : pair.off;
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
      if (
        write.feature === "side_app_bar" ||
        write.feature === "side_app_bar_left"
      ) {
        const cap = await resolveSideAppBarSupport(config);
        if (!cap.supported) {
          throw new Error(
            cap.note ?? "侧边栏仅 DT630 等机型支持，本项免测/不可写",
          );
        }
      }
      await securityBridgeSetWithToggleFallback(
        config,
        spec,
        write.feature,
        mode,
      );
      return;
    }
    case "scan.property": {
      const values = write.values ?? defaultOnOffValues(spec.labels);
      const rawValue = mode === "on" ? values.on : values.off;
      await scanWedgeSetProperty(config, write.property, rawValue);
      return;
    }
    case "docking.field": {
      const values = write.values ?? defaultOnOffValues(spec.labels);
      const rawValue = mode === "on" ? values.on : values.off;
      await applyDockingFieldWrite(config, write.field, rawValue);
      return;
    }
    default:
      throw new Error(`未知 write.kind`);
  }
}
