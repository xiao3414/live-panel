/**
 * OEM Sound 音量以「百分比 0–100」为准（无 % 符号）。
 * 读写走 AudioService（cmd media_session volume），勿只写 settings（改库不改实况）。
 * 公式：档位 = round(百分比/100×最大档)；回读落点百分比便于与 OEM JSON 同档对比。
 * 依据：OEMConfig_2.0_产品框架/System Configuration.md · Sound
 */
import type { AppConfig } from "./types.js";
import { adbShell } from "./adb.js";

/** settings key → AudioManager.STREAM_* 整型 */
const SETTINGS_KEY_TO_STREAM_ID: Record<string, number> = {
  volume_music: 3,
  volume_ring: 2,
  volume_alarm: 4,
  volume_voice_call: 0,
  volume_notification: 5,
};

const PROBE_ID_TO_SETTINGS_KEY: Record<string, string> = {
  "syscfg.soundStep__mediaVolume": "volume_music",
  "syscfg.soundStep__alarmVolume": "volume_alarm",
  "syscfg.soundStep__ringVolume": "volume_ring",
  "syscfg.soundStep__callVolume": "volume_voice_call",
};

export function isOemVolumeSettingsKey(key: string): boolean {
  return key in SETTINGS_KEY_TO_STREAM_ID;
}

export function isOemVolumeProbeId(probeId: string): boolean {
  return probeId in PROBE_ID_TO_SETTINGS_KEY;
}

type StreamVol = { index: number; max: number };

const lastByKey = new Map<string, StreamVol & { oemPercent: number }>();

/** OEM 百分比 → 最近档位 */
export function volumePercentToIndex(percent: number, max: number): number {
  if (max <= 0) return 0;
  const p = Math.min(100, Math.max(0, percent));
  return Math.min(max, Math.max(0, Math.round((p / 100) * max)));
}

/**
 * 档位 → OEM 落点百分比（该档可映射的最小整数 %；满档=100）。
 */
export function volumeIndexToOemPercent(index: number, max: number): number {
  if (max <= 0) return 0;
  const i = Math.min(max, Math.max(0, Math.round(index)));
  if (i <= 0) return 0;
  if (i >= max) return 100;
  return Math.min(
    100,
    Math.max(0, Math.ceil((i - 0.5) * (100 / max))),
  );
}

export function oemVolumePercentsEqual(
  expectedPercent: number,
  actualPercent: number,
  max: number,
): boolean {
  if (max <= 0) return expectedPercent === actualPercent;
  return (
    volumePercentToIndex(expectedPercent, max) ===
    volumePercentToIndex(actualPercent, max)
  );
}

function parseMediaSessionGet(out: string): StreamVol | null {
  // [V] volume is 15 in range [0..15]
  const m = out.match(
    /volume is\s+(\d+)\s+in range\s+\[(\d+)\.\.(\d+)\]/i,
  );
  if (!m) return null;
  const index = Number(m[1]);
  const max = Number(m[3]);
  if (!Number.isFinite(index) || !Number.isFinite(max) || max <= 0) return null;
  return { index, max };
}

async function readStreamViaMediaSession(
  config: AppConfig,
  streamId: number,
): Promise<StreamVol> {
  const out = await adbShell(
    config,
    `cmd media_session volume --stream ${streamId} --get`,
    8000,
  );
  const hit = parseMediaSessionGet(out);
  if (!hit) {
    throw new Error(
      `无法解析 media_session volume --get（stream=${streamId}）：${out.slice(0, 120)}`,
    );
  }
  return hit;
}

/**
 * 读 OEM 口径音量百分比。
 */
export async function readOemVolumePercent(
  config: AppConfig,
  settingsKey: string,
): Promise<
  | { raw: string; volumeMax: number; note?: string }
  | { raw: null; note: string }
> {
  const streamId = SETTINGS_KEY_TO_STREAM_ID[settingsKey];
  if (streamId == null) {
    return { raw: null, note: `未知音量键 ${settingsKey}` };
  }
  try {
    const hit = await readStreamViaMediaSession(config, streamId);
    const oemPercent = volumeIndexToOemPercent(hit.index, hit.max);
    lastByKey.set(settingsKey, {
      index: hit.index,
      max: hit.max,
      oemPercent,
    });
    return { raw: String(oemPercent), volumeMax: hit.max };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { raw: null, note: `读音量失败：${msg}` };
  }
}

/** 将 OEM 百分比写入真实 stream 音量（非仅 settings） */
export async function writeOemVolumePercent(
  config: AppConfig,
  settingsKey: string,
  percentText: string,
): Promise<void> {
  const streamId = SETTINGS_KEY_TO_STREAM_ID[settingsKey];
  if (streamId == null) throw new Error(`未知音量键 ${settingsKey}`);
  const pct = Number(String(percentText).replace(/%/g, "").trim());
  if (!Number.isFinite(pct)) {
    throw new Error(`音量须为 0–100 的百分比数字，收到：${percentText}`);
  }
  const before = await readStreamViaMediaSession(config, streamId);
  const index = volumePercentToIndex(pct, before.max);
  // 先改 AudioService，再同步 settings（兼容只读 settings 的旧逻辑）
  await adbShell(
    config,
    `cmd media_session volume --stream ${streamId} --set ${index}`,
    8000,
  );
  await adbShell(config, `settings put system ${settingsKey} ${index}`);
  const after = await readStreamViaMediaSession(config, streamId);
  lastByKey.set(settingsKey, {
    index: after.index,
    max: after.max,
    oemPercent: volumeIndexToOemPercent(after.index, after.max),
  });
  if (after.index !== index) {
    throw new Error(
      `已下发档位 ${index}（OEM ${pct}%），但设备仍为 ${after.index}/${after.max}` +
        `（约 ${volumeIndexToOemPercent(after.index, after.max)}%）。` +
        `请检查 OEM「Lock at Full Volume」是否为 Enable（锁最大音会强制满档）`,
    );
  }
}
