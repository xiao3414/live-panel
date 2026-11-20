/**
 * OEM Sound 音量对比/展示（与 electron/volumeAudio.ts 同口径）。
 * 百分比为主；设备档位仅作量化中间量。
 */

const VOLUME_PROBE_IDS = new Set([
  "syscfg.soundStep__alarmVolume",
  "syscfg.soundStep__mediaVolume",
  "syscfg.soundStep__ringVolume",
  "syscfg.soundStep__callVolume",
]);

export function isOemVolumeProbeId(probeId: string): boolean {
  return VOLUME_PROBE_IDS.has(probeId);
}

export function volumePercentToIndex(percent: number, max: number): number {
  if (max <= 0) return 0;
  const p = Math.min(100, Math.max(0, percent));
  return Math.min(max, Math.max(0, Math.round((p / 100) * max)));
}

/** 两 OEM 百分比是否落到同一档 */
export function oemVolumePercentsEqual(
  expectedPercent: number,
  actualPercent: number,
  max: number,
): boolean {
  if (!(max > 0)) return expectedPercent === actualPercent;
  return (
    volumePercentToIndex(expectedPercent, max) ===
    volumePercentToIndex(actualPercent, max)
  );
}

/**
 * 无 max 时：用常见 stream 上限试算；任一档位一致即视为 OEM 同档。
 */
export function oemVolumePercentsEqualGuessMax(
  expectedPercent: number,
  actualPercent: number,
  hintMax?: number | null,
): boolean {
  if (
    hintMax &&
    hintMax > 0 &&
    oemVolumePercentsEqual(expectedPercent, actualPercent, hintMax)
  ) {
    return true;
  }
  for (const max of [7, 15, 8, 10, 16, 20, 25]) {
    if (oemVolumePercentsEqual(expectedPercent, actualPercent, max)) {
      return true;
    }
  }
  return false;
}
