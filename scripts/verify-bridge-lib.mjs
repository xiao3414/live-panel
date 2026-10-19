/** verify 脚本共用：读桥接 reqId 结果（tmp 常因 SELinux 不可写，优先 run-as） */
export function logcatExpectPrefixes(op) {
  if (op === "ping") return ["OK", "ERR:"];
  if (op === "securityGetBatch") return ["BATCH:"];
  if (op === "securityGet" || op === "securitySet") {
    return ["BOOL:", "VAL:", "ERR:", "OK"];
  }
  return undefined;
}

export function pickLogcatResult(logcatOut, expectPrefixes) {
  let lastAny = "";
  let lastMatch = "";
  for (const line of logcatOut.split(/\r?\n/)) {
    const idx = line.indexOf("RESULT:");
    if (idx < 0) continue;
    const payload = line.slice(idx + 7).trim();
    if (!payload) continue;
    lastAny = payload;
    if (
      !expectPrefixes?.length ||
      expectPrefixes.some((p) => payload.startsWith(p))
    ) {
      lastMatch = payload;
    }
  }
  if (expectPrefixes?.length) return lastMatch;
  return lastAny;
}

export function makeBridgeReader(runAdb, BRIDGE) {
  return async function readBridgeResult(id, op) {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const expect = logcatExpectPrefixes(op);
    for (let i = 0; i < 14; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 350 : 280));
      const tmp = await runAdb([
        "shell",
        "cat",
        `/data/local/tmp/livepanel_req_${safe}.txt`,
      ]);
      if (tmp.out) return tmp.out;
      const app = await runAdb([
        "shell",
        "run-as",
        BRIDGE,
        "cat",
        `files/livepanel_req_${safe}.txt`,
      ]);
      if (app.out) return app.out;
      if (expect?.length) {
        const log = await runAdb([
          "shell",
          "logcat",
          "-d",
          "-s",
          "LivePanelBridge:I",
          "-t",
          "64",
        ]);
        const picked = pickLogcatResult(log.out, expect);
        if (picked) return picked;
      }
    }
    return "";
  };
}
