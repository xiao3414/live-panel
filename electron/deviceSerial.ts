import { listDevices } from "./adb.js";
import type { AppConfig } from "./types.js";

export type ReconcileResult = {
  config: AppConfig;
  changed: boolean;
  message?: string;
};

/** 换机后 config 里仍是旧 serial 时，自动切到当前唯一在线设备 */
export async function reconcileDeviceSerial(
  config: AppConfig,
  saveSerial: (serial: string) => void,
): Promise<ReconcileResult> {
  const list = await listDevices({
    ...config,
    adb: { ...config.adb, deviceSerial: "" },
  });
  const online = list.filter((d) => d.state === "device");
  const cur = config.adb.deviceSerial;

  if (cur && online.some((d) => d.serial === cur)) {
    return { config, changed: false };
  }

  if (online.length === 1) {
    const serial = online[0].serial;
    saveSerial(serial);
    const next = {
      ...config,
      adb: { ...config.adb, deviceSerial: serial },
    };
    const model = online[0].model ? ` (${online[0].model})` : "";
    return {
      config: next,
      changed: true,
      message: `已切换到当前设备 ${serial}${model}`,
    };
  }

  if (cur && online.length === 0) {
    throw new Error(
      `adb 找不到设备 ${cur}：请插好 USB、开启调试后点「刷新设备」。`,
    );
  }

  if (cur && online.length > 1) {
    throw new Error(
      `adb 找不到设备 ${cur}：列表中有 ${online.length} 台设备，请在顶栏下拉框选择当前机器。`,
    );
  }

  if (!cur && online.length === 1) {
    const serial = online[0].serial;
    saveSerial(serial);
    return {
      config: { ...config, adb: { ...config.adb, deviceSerial: serial } },
      changed: true,
    };
  }

  return { config, changed: false };
}
