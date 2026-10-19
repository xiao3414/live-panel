import type { ProbeResult } from "./types";

export function supportBanner(result: ProbeResult | undefined): string | null {
  if (!result) return null;
  if (result.supportMessage) return result.supportMessage;
  if (!result.ok && result.error) return result.error;
  return null;
}

export function isWriteBlocked(result: ProbeResult | undefined): boolean {
  if (!result?.supportStatus) return false;
  return (
    result.supportStatus === "unsupported" ||
    result.supportStatus === "not_allowed" ||
    result.supportStatus === "panel_readonly"
  );
}
