import type { AppConfig, ProbeResult, ProbeSpec } from "./types.js";
import { executeProbe } from "./probeRunner.js";

const DEFAULT_CONCURRENCY = 8;

export async function runProbesParallel(
  config: AppConfig,
  probeIds: string[],
  byId: Map<string, ProbeSpec>,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = new Array(probeIds.length);
  let index = 0;

  async function worker() {
    while (index < probeIds.length) {
      const i = index++;
      const id = probeIds[i];
      const spec = byId.get(id);
      if (!spec) {
        results[i] = {
          probeId: id,
          ok: false,
          raw: null,
          display: "未注册",
          error: `未知 probe: ${id}`,
          at: Date.now(),
        };
        continue;
      }
      results[i] = await executeProbe(config, spec, byId);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, probeIds.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
