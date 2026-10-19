import { spawn } from "node:child_process";
import { withAdbSlot } from "./adbSlot.js";
import type { AppConfig } from "./types.js";

export type DeviceInfo = {
  serial: string;
  state: string;
  model?: string;
};

export function runAdb(
  config: AppConfig,
  args: string[],
  timeoutMs = 15000,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return withAdbSlot(
    () =>
      new Promise((resolve, reject) => {
        const proc = spawn(config.adb.path, buildSpawnArgs(config, args), {
          windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
          proc.kill();
          reject(new Error(`adb 超时 (${timeoutMs}ms): ${args.join(" ")}`));
        }, timeoutMs);

        proc.stdout.on("data", (d) => {
          stdout += d.toString();
        });
        proc.stderr.on("data", (d) => {
          stderr += d.toString();
        });
        proc.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
        proc.on("close", (code) => {
          clearTimeout(timer);
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
        });
      }),
  );
}

function buildSpawnArgs(config: AppConfig, args: string[]): string[] {
  const out: string[] = [];
  if (config.adb.deviceSerial) {
    out.push("-s", config.adb.deviceSerial);
  }
  return out.concat(args);
}

export async function listDevices(config: AppConfig): Promise<DeviceInfo[]> {
  let stdout: string;
  let code: number | null;
  try {
    ({ stdout, code } = await runAdb(
      { ...config, adb: { ...config.adb, deviceSerial: "" } },
      ["devices", "-l"],
    ));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `无法运行 adb（${config.adb.path}）：${msg}。请在 config/app.defaults.json 的 adb.path 填写 adb.exe 完整路径，或把 platform-tools 加入系统 PATH。`,
    );
  }
  if (code !== 0) return [];
  const lines = stdout.split(/\r?\n/).slice(1);
  const devices: DeviceInfo[] = [];
  for (const line of lines) {
    const m = line.match(/^(\S+)\s+(device|offline|unauthorized)/);
    if (!m) continue;
    const model = line.match(/model:(\S+)/)?.[1];
    devices.push({ serial: m[1], state: m[2], model });
  }
  return devices;
}

export async function adbShell(
  config: AppConfig,
  cmd: string,
  timeoutMs = 8000,
): Promise<string> {
  const { stdout, stderr, code } = await runAdb(
    config,
    ["shell", cmd],
    timeoutMs,
  );
  if (code !== 0 && !stdout) {
    throw new Error(stderr || `adb shell 失败: ${cmd}`);
  }
  return stdout || stderr;
}

export async function settingsGet(
  config: AppConfig,
  namespace: string,
  key: string,
): Promise<string> {
  const out = await adbShell(
    config,
    `settings get ${namespace} ${key}`,
  );
  return out.trim();
}

export async function settingsPut(
  config: AppConfig,
  namespace: string,
  key: string,
  value: string,
): Promise<void> {
  await adbShell(
    config,
    `settings put ${namespace} ${key} ${value}`,
    8000,
  );
}
