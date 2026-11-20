import type { AppConfig } from "./types.js";
import { adbShell } from "./adb.js";
import { scanBridgeSetProperty } from "./scanBridge.js";
import { invalidateScanWedgeCache } from "./scanWedgeRead.js";

const SET_ACTIONS = [
  "com.urovo.scanner.scanwedge.api.SET_PROPERTY",
  "com.urovo.scanwedge.api.SET_PROPERTY",
  "com.scanwedge.api.SET_PROPERTY",
  "android.intent.action.SCANNER_CONFIG",
];

function quote(v: string) {
  return `'${v.replace(/'/g, `'\\''`)}'`;
}

export async function scanWedgeSetProperty(
  config: AppConfig,
  propertyName: string,
  propertyValue: string,
): Promise<void> {
  try {
    await scanBridgeSetProperty(config, propertyName, propertyValue);
    invalidateScanWedgeCache();
    return;
  } catch {
    /* fall back to legacy broadcast */
  }
  let lastErr = "";
  for (const action of SET_ACTIONS) {
    const cmd = [
      "am broadcast",
      `-a ${quote(action)}`,
      `--es propertyName ${quote(propertyName)}`,
      `--es propertyValue ${quote(propertyValue)}`,
    ].join(" ");
    try {
      const out = await adbShell(config, cmd, 12_000);
      if (/SecurityException|Permission Denial|not allowed/i.test(out)) {
        lastErr = out;
        continue;
      }
      invalidateScanWedgeCache();
      return;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(
    lastErr
      ? `ScanWedge 写属性失败：${lastErr.slice(0, 120)}`
      : "ScanWedge 写属性失败（未识别广播 Action）",
  );
}
