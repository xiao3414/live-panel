import type { AppConfig, ProbeResult, ProbeSpec } from "./types.js";
import { executeProbe, probeLabelFor } from "./probeRunner.js";
import {
  normalizeEnableDisableRaw,
  normalizeInternalSelectionFromProps,
  normalizeTriggeringModesRaw,
  normalizeViewFinderWindowRaw,
  prefetchScanWedgeCache,
  scanWedgeProperty,
} from "./scanWedgeRead.js";

function oemPathFromSpec(spec: ProbeSpec): string | null {
  const probe = spec.probe;
  if (probe.kind === "scan.field") return probe.oemPath;
  if (probe.kind === "scan.profile") return null;
  return null;
}

function postProcessByOemPath(oemPath: string, raw: string | null): string | null {
  if (raw == null) return null;
  if (oemPath === "scanTriggerMode") return normalizeTriggeringModesRaw(raw);
  if (oemPath.endsWith("rearCameraViewFinderWindow"))
    return normalizeViewFinderWindowRaw(raw);
  if (oemPath.endsWith("internalSelection")) {
    if (raw.includes("|")) {
      const [engine, cam] = raw.split("|");
      return (
        normalizeInternalSelectionFromProps(engine ?? null, cam ?? null) ?? raw
      );
    }
    const t = raw.trim();
    if (/^[012]$/.test(t)) {
      return normalizeInternalSelectionFromProps(null, t) ?? raw;
    }
    const lower = raw.toLowerCase();
    if (lower.includes("rear")) return "rear_camera";
    if (lower.includes("engine")) return "scan_engine";
  }
  if (oemPath === "outputMode.outputModeSelect") {
    const t = String(raw).trim();
    if (t === "4" || t === "0") return "0";
    if (t === "1" || t === "8") return "1";
  }
  if (oemPath.endsWith("continuousScanningMode")) {
    const t = String(raw).trim();
    if (/^[0-4]$/.test(t)) return t;
  }
  if (
    /Enable|Switch|Floating|Torch|Target|Multibarcode|fullReadMode|pasteBoard|parseUrl|tcpNetwork|lowPower|GsCodeSet|applicationIdentifier/i.test(
      oemPath,
    )
  ) {
    const n = normalizeEnableDisableRaw(raw);
    if (n === "1" || n === "0") return n;
  }
  return raw;
}

export async function readScanProbeResults(
  config: AppConfig,
  probeIds: string[],
  byId: Map<string, ProbeSpec>,
): Promise<ProbeResult[]> {
  await prefetchScanWedgeCache(config);
  const engine = await scanWedgeProperty(config, "SCANNER_ENGINE_TYPE_SELECT");
  const camera = await scanWedgeProperty(config, "SCANNER_INTERNAL_CAMERA_ID");

  const base = await Promise.all(
    probeIds.map((id) => {
      const spec = byId.get(id);
      if (!spec) {
        return Promise.resolve({
          probeId: id,
          ok: false,
          raw: null,
          display: "未注册",
          error: `未知 probe: ${id}`,
          at: Date.now(),
        } satisfies ProbeResult);
      }
      return executeProbe(config, spec, byId);
    }),
  );

  return base.map((r) => {
    if (!r.ok) return r;
    const spec = byId.get(r.probeId);
    if (!spec) return r;
    const oemPath = oemPathFromSpec(spec);
    if (!oemPath) return r;

    let raw = r.raw;
    if (oemPath.endsWith("internalSelection")) {
      if (raw == null || raw === "" || /^[012]$/.test(String(raw).trim())) {
        const cam = /^[012]$/.test(String(raw ?? "").trim())
          ? String(raw).trim()
          : camera.raw;
        raw = normalizeInternalSelectionFromProps(engine.raw, cam) ?? raw;
      }
    }

    const finalRaw = postProcessByOemPath(oemPath, raw);
    const display = probeLabelFor(spec, finalRaw);
    if (finalRaw === r.raw && display === r.display) return r;
    return { ...r, raw: finalRaw, display };
  });
}
