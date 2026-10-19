import type { AppConfig, ProbeSpec, ProbeResult, RegistryFile } from "./types.js";
import { executeProbe } from "./probeRunner.js";
import { runProbesParallel } from "./runProbesParallel.js";
import { readWifiAdvancedSettings } from "./wifiAdvancedSettings.js";
import { readWifiGeneralSettings } from "./wifiGeneralSettings.js";
import { readWifiPreferenceSettings } from "./wifiPreferenceSettings.js";
import { readWifiWhitelistSettings } from "./wifiWhitelistSettings.js";

export type ModuleReadRow = {
  probeId: string;
  item: string;
  module: string;
  kind: "probe" | "form";
  result: ProbeResult;
};

export type ModuleReadSummary = {
  l1: string;
  catalogPlaceholders: number;
  readableProbeCount: number;
  formCount: number;
  rows: ModuleReadRow[];
  readAt: number;
};

type ProbeWithL1 = ProbeSpec & { l1?: string };

export function probeL1Label(spec: ProbeSpec): string {
  const l1 = (spec as ProbeWithL1).l1;
  if (l1) return l1;
  const head = spec.module.split(" / ")[0]?.trim();
  return head ?? "";
}

const NON_READ_TYPES = new Set([
  "catalog",
  "layout_section",
  "group",
  "diff",
  "risk",
]);

export function isDirectReadableProbe(spec: ProbeSpec): boolean {
  if (spec.enabled === false) return false;
  const t = spec.display.type;
  if (NON_READ_TYPES.has(t)) return false;
  if (t.endsWith("_form")) return false;
  if (spec.probe.kind === "adb.settings" || spec.probe.kind === "adb.shell") {
    return true;
  }
  if (spec.probe.kind === "usdk" && spec.probe.fallback) return true;
  if (spec.probe.kind === "security.bridge") return true;
  return false;
}

export function isFormProbe(spec: ProbeSpec): boolean {
  return spec.display.type.endsWith("_form") && spec.enabled !== false;
}

function summarizeFormRead(
  probeId: string,
  spec: ProbeSpec,
  payload: Record<string, unknown>,
): ProbeResult {
  const parts: string[] = [];
  if (typeof payload.readSummary === "string") parts.push(payload.readSummary);
  if (Array.isArray(payload.readNotes) && payload.readNotes.length) {
    parts.push(String(payload.readNotes[0]));
  }
  if (Array.isArray(payload.ssids) && payload.ssids.length) {
    parts.push(`白名单: ${(payload.ssids as string[]).join(", ")}`);
  }
  if (payload.bridgeInstalled === false) {
    parts.push("USDK 桥接未安装（部分项不可读）");
  }
  const bridge = payload.bridgeInstalled;
  if (bridge === true && parts.length === 0) {
    parts.push("已连接设备（详见表单摘要）");
  }
  const display = parts.length ? parts.join(" · ") : JSON.stringify(payload).slice(0, 120);
  return {
    probeId,
    ok: true,
    raw: null,
    display,
    at: Date.now(),
  };
}

async function readFormProbe(
  config: AppConfig,
  spec: ProbeSpec,
): Promise<ProbeResult> {
  const id = spec.id;
  try {
    if (id === "wifi.general_settings") {
      const g = await readWifiGeneralSettings(config);
      const parts = [
        g.wifiEnabled != null ? (g.wifiEnabled ? "Wi‑Fi 开" : "Wi‑Fi 关") : null,
        g.ssid ? `SSID ${g.ssid}` : null,
        g.securityLabel !== "—" ? g.securityLabel : null,
      ].filter(Boolean);
      return {
        probeId: id,
        ok: true,
        raw: null,
        display: parts.length ? parts.join(" · ") : "（无连接 SSID 或读失败）",
        at: Date.now(),
      };
    }
    if (id === "wifi.advanced_settings") {
      const g = await readWifiAdvancedSettings(config);
      const parts = [
        `平台 ${g.platform}`,
        g.bridgeInstalled ? "USDK 桥接已安装" : "无 USDK 桥接",
        g.wifiScanning != null ? `Scanning ${g.wifiScanning ? "开" : "关"}` : null,
        g.countryCode ? `Country ${g.countryCode}` : null,
        g.powerSaveMode ? `PowerSave ${g.powerSaveMode}` : null,
      ].filter(Boolean);
      return {
        probeId: id,
        ok: true,
        raw: null,
        display: parts.length ? parts.join(" · ") : (g.readNotes?.[0] ?? "—"),
        at: Date.now(),
      };
    }
    if (id === "wifi.preference_settings") {
      const g = await readWifiPreferenceSettings(config);
      return summarizeFormRead(id, spec, g as unknown as Record<string, unknown>);
    }
    if (id === "wifi.whitelist_settings") {
      const g = await readWifiWhitelistSettings(config);
      return summarizeFormRead(id, spec, g as unknown as Record<string, unknown>);
    }
    return {
      probeId: id,
      ok: true,
      raw: null,
      display: spec.probe.kind === "static" ? (spec.probe.note ?? "表单读接口待接") : "—",
      at: Date.now(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      probeId: id,
      ok: false,
      raw: null,
      display: msg,
      error: msg,
      at: Date.now(),
    };
  }
}

export async function readModuleByL1(
  config: AppConfig,
  registry: RegistryFile,
  l1: string,
  byId: Map<string, ProbeSpec>,
): Promise<ModuleReadSummary> {
  const inL1 = registry.probes.filter((p) => probeL1Label(p) === l1);
  let catalogPlaceholders = 0;
  const readable: ProbeSpec[] = [];
  const forms: ProbeSpec[] = [];

  for (const p of inL1) {
    if (p.enabled === false) continue;
    if (p.display.type === "catalog") {
      catalogPlaceholders += 1;
      continue;
    }
    if (isFormProbe(p)) forms.push(p);
    else if (isDirectReadableProbe(p)) readable.push(p);
  }

  const probeIds = readable.map((p) => p.id);
  const probeResults = await runProbesParallel(config, probeIds, byId);
  const resultById = new Map(probeResults.map((r) => [r.probeId, r]));

  const rows: ModuleReadRow[] = [];

  for (const spec of readable) {
    rows.push({
      probeId: spec.id,
      item: spec.item,
      module: spec.module,
      kind: "probe",
      result: resultById.get(spec.id) ?? {
        probeId: spec.id,
        ok: false,
        raw: null,
        display: "未执行",
        at: Date.now(),
      },
    });
  }

  for (const spec of forms) {
    rows.push({
      probeId: spec.id,
      item: spec.item,
      module: spec.module,
      kind: "form",
      result: await readFormProbe(config, spec),
    });
  }

  rows.sort((a, b) => a.module.localeCompare(b.module) || a.item.localeCompare(b.item));

  return {
    l1,
    catalogPlaceholders,
    readableProbeCount: readable.length,
    formCount: forms.length,
    rows,
    readAt: Date.now(),
  };
}

/** 单探针读（供 probes:run 之外的批量工具） */
export async function readOneProbe(
  config: AppConfig,
  spec: ProbeSpec,
  byId: Map<string, ProbeSpec>,
): Promise<ProbeResult> {
  if (isFormProbe(spec)) return readFormProbe(config, spec);
  return executeProbe(config, spec, byId);
}
