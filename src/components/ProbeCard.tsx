import { useEffect, useState } from "react";
import type { ProbeMeta, ProbeResult } from "../types";
import {
  isProbeLocalSignError,
  shortProbeHint,
} from "../formatProbeError";
import { isWriteBlocked, supportBanner } from "../probeSupport";
import type { CompareRow } from "../expectCompare";
import { OemBlockCompare } from "./OemBlockCompare";

type Props = {
  title?: string;
  meta?: ProbeMeta;
  compareRow?: CompareRow;
  results: ProbeResult[];
  onWrite?: (probeId: string, mode: "on" | "off") => void;
  onWriteValue?: (probeId: string, value: string) => void;
  writing?: boolean;
  embedded?: boolean;
};

function isOnRaw(raw: string | null): boolean | null {
  if (raw == null || raw === "") return null;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  if (raw.includes("ON")) return true;
  if (raw.includes("OFF")) return false;
  return null;
}

function showSupportBanner(
  primary: ProbeResult | undefined,
  err: ProbeResult | undefined,
): string | null {
  const banner = supportBanner(primary) ?? (err ? supportBanner(err) : null);
  if (!banner) return null;
  if (
    primary?.supportStatus === "unsupported" &&
    !primary?.supportMessage &&
    err &&
    !err.supportMessage
  ) {
    return null;
  }
  return banner;
}

function showBlockCompare(row: CompareRow | undefined): row is CompareRow {
  return Boolean(row && row.status === "mismatch");
}

function ValueArea({
  compareRow,
  policyNote,
  valueText,
  results,
  err,
  banner,
  compact,
}: {
  compareRow?: CompareRow;
  policyNote?: string;
  valueText: string;
  results: ProbeResult[];
  err: ProbeResult | undefined;
  banner: string | null;
  compact: boolean;
}) {
  if (showBlockCompare(compareRow)) {
    return <OemBlockCompare row={compareRow} policyNote={policyNote} />;
  }
  return (
    <div
      className={`probe-card__value ${err && !banner ? "err" : ""} ${compact ? "probe-card__value--clamp" : ""}`}
      title={compact && valueText.length > 60 ? valueText : undefined}
    >
      {results.length === 1 ? (
        valueText
      ) : (
        results.map((r) => (
          <div key={r.probeId}>
            {r.probeId}: {r.ok ? r.display : r.error}
          </div>
        ))
      )}
    </div>
  );
}

export function ProbeCard({
  title,
  meta,
  compareRow,
  results,
  onWrite,
  onWriteValue,
  writing,
  embedded,
}: Props) {
  const primary = results[0];
  const [draftValue, setDraftValue] = useState("");
  useEffect(() => {
    if (primary?.raw != null) setDraftValue(primary.raw);
  }, [primary?.raw, primary?.at]);
  const err = results.find((r) => !r.ok);
  const signBlock =
    isProbeLocalSignError(primary ?? {}) ||
    (err != null && isProbeLocalSignError(err));
  const bannerRaw = showSupportBanner(primary, err);
  const policyOrPlatformHint = Boolean(
    primary?.platformCompareExempt?.message ||
      (primary?.supportStatus === "not_allowed" && primary?.supportMessage),
  );
  const banner = policyOrPlatformHint
    ? bannerRaw
    : shortProbeHint(primary ?? err ?? {}) ??
      (bannerRaw && bannerRaw.length > 56
        ? `${bannerRaw.slice(0, 54)}…`
        : bannerRaw);
  const blocked = isWriteBlocked(primary) || isWriteBlocked(err);
  const writeLocked = blocked || signBlock;
  const policyNote =
    compareRow?.status === "platform_locked"
      ? compareRow.platformNote
      : primary?.supportStatus === "not_allowed" && primary.supportMessage
        ? primary.supportMessage
        : undefined;
  const suppressBanner = Boolean(
    policyNote && compareRow?.status === "mismatch",
  );
  const hasToggleRaw = primary?.raw != null && primary.raw !== "";
  const writable =
    meta?.writable &&
    results.length === 1 &&
    primary?.ok &&
    onWrite &&
    !writeLocked;
  const compactErr = (text: string | undefined) => {
    if (!text) return text;
    if (text.includes("桥接无响应")) return "桥接无响应";
    if (text.includes("securityGetBatch") || text.includes("Security 批量读")) {
      return "读失败";
    }
    if (text.length > 48) return `${text.slice(0, 48)}…`;
    return text;
  };
  const valueTextEarly = compactErr(
    err && !primary?.supportMessage
      ? err.error ?? err.display
      : primary?.display ?? "…",
  );
  let onState = isOnRaw(primary?.raw ?? null);
  if (onState == null && meta?.labelOn && valueTextEarly === meta.labelOn) {
    onState = true;
  }
  if (onState == null && meta?.labelOff && valueTextEarly === meta.labelOff) {
    onState = false;
  }
  const supportClass =
    primary?.supportStatus === "not_allowed"
      ? "warn"
      : primary?.supportStatus === "unsupported"
        ? "muted"
        : "";
  const supportBannerClass = [
    "probe-card__support",
    compareRow?.status === "platform_locked"
      ? "probe-card__support--policy"
      : supportClass,
    banner && banner.includes("安装未知应用")
      ? "probe-card__support--info"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const isToggle = meta?.displayType === "toggle";
  const compact = embedded && (isToggle || meta?.displayType === "text");

  const hasEnumRaw =
    primary?.raw != null && primary.raw !== "" && primary.raw !== "null";
  const valueWritable =
    meta?.writable &&
    results.length === 1 &&
    (primary?.ok || hasEnumRaw) &&
    onWriteValue &&
    !blocked &&
    (meta.displayType === "enum" || meta.displayType === "text");

  if (valueWritable && meta && meta.displayType === "enum" && meta.valueLabels) {
    const options = Object.entries(meta.valueLabels);
    const current = primary?.raw ?? "";
    return (
      <div className={`probe-card probe-card--compact ${embedded ? "probe-card--embedded" : ""}`}>
        {banner && !suppressBanner ? (
          <div className={supportBannerClass} title={banner ?? undefined}>
            {banner}
          </div>
        ) : null}
        <ValueArea
          compareRow={compareRow}
          policyNote={suppressBanner ? policyNote : undefined}
          valueText={primary?.display ?? "—"}
          results={results}
          err={err}
          banner={banner}
          compact
        />
        <div className="probe-card__actions">
          <select
            value={draftValue || current}
            disabled={writing}
            onChange={(e) => setDraftValue(e.target.value)}
          >
            {options.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="toggle"
            disabled={writing}
            onClick={() => onWriteValue(meta.id, draftValue || current)}
          >
            写回
          </button>
          {writing ? <span className="probe-card__write-hint">写入中…</span> : null}
        </div>
      </div>
    );
  }

  if (valueWritable && meta && meta.displayType === "text") {
    return (
      <div className={`probe-card probe-card--compact ${embedded ? "probe-card--embedded" : ""}`}>
        {banner && !suppressBanner ? (
          <div className={supportBannerClass} title={banner ?? undefined}>
            {banner}
          </div>
        ) : null}
        <ValueArea
          compareRow={compareRow}
          policyNote={suppressBanner ? policyNote : undefined}
          valueText={primary?.display ?? "—"}
          results={results}
          err={err}
          banner={banner}
          compact
        />
        <div className="probe-card__actions">
          <input
            type="text"
            value={draftValue}
            disabled={writing}
            placeholder="输入后写回"
            onChange={(e) => setDraftValue(e.target.value)}
          />
          <button
            type="button"
            className="toggle"
            disabled={writing || !draftValue.trim()}
            onClick={() => onWriteValue(meta.id, draftValue.trim())}
          >
            写回
          </button>
          {writing ? <span className="probe-card__write-hint">写入中…</span> : null}
        </div>
      </div>
    );
  }

  if (meta?.displayType === "catalog") {
    return (
      <div className={`probe-card probe-card--catalog ${embedded ? "probe-card--embedded" : ""}`}>
        {!embedded && title ? (
          <div className="probe-card__title">{title}</div>
        ) : null}
        <pre className="probe-card__catalog">{primary?.display ?? "…"}</pre>
      </div>
    );
  }

  if (compact && isToggle && meta && onWrite && (primary?.ok || hasToggleRaw)) {
    const lockTitle = signBlock
      ? "写回需 Urovo 签名桥接（device-usdk-bridge/app/urovo.keystore）"
      : undefined;
    return (
      <div className={`probe-card probe-card--compact ${embedded ? "probe-card--embedded" : ""}`}>
        {banner && !suppressBanner ? (
          <div
            className={`probe-card__support probe-card__support--compact ${supportClass}`}
            title={bannerRaw ?? banner}
          >
            {banner}
          </div>
        ) : null}
        {showBlockCompare(compareRow) ? (
          <OemBlockCompare
            row={compareRow}
            policyNote={suppressBanner ? policyNote : undefined}
          />
        ) : policyNote ? (
          <div className="probe-card__support warn" title={policyNote}>
            {policyNote}
          </div>
        ) : null}
        <div className="probe-card__actions probe-card__actions--solo">
          <button
            type="button"
            className={onState === false ? "toggle active" : "toggle"}
            disabled={writing || writeLocked}
            title={lockTitle}
            onClick={() => onWrite(meta.id, "off")}
          >
            关
          </button>
          <button
            type="button"
            className={onState === true ? "toggle active" : "toggle"}
            disabled={writing || writeLocked}
            title={lockTitle}
            onClick={() => onWrite(meta.id, "on")}
          >
            开
          </button>
          {writing ? <span className="probe-card__write-hint">写入中…</span> : null}
        </div>
      </div>
    );
  }

  const valueText = valueTextEarly;
  const hideDupValue =
    Boolean(banner) &&
    Boolean(valueText) &&
    valueText !== "…" &&
    (banner === valueText ||
      (valueText.length >= 8 && banner.includes(valueText)));

  return (
    <div className={`probe-card ${embedded ? "probe-card--embedded" : ""} ${compact ? "probe-card--compact" : ""}`}>
      {!embedded && title ? (
        <div className="probe-card__title">{title}</div>
      ) : null}
      {banner && !suppressBanner ? (
        <div className={supportBannerClass} title={banner ?? undefined}>
          {banner}
        </div>
      ) : null}
      {!(compact && isToggle && writable) && !hideDupValue ? (
        <ValueArea
          compareRow={compareRow}
          policyNote={suppressBanner ? policyNote : undefined}
          valueText={valueText}
          results={results}
          err={err}
          banner={banner}
          compact={compact}
        />
      ) : null}
      {writable && meta && !(compact && isToggle) ? (
        <div className="probe-card__actions">
          <button
            type="button"
            className={onState === false ? "toggle active" : "toggle"}
            disabled={writing}
            onClick={() => onWrite(meta.id, "off")}
          >
            关
          </button>
          <button
            type="button"
            className={onState === true ? "toggle active" : "toggle"}
            disabled={writing}
            onClick={() => onWrite(meta.id, "on")}
          >
            开
          </button>
          {writing ? (
            <span className="probe-card__write-hint">写入中…</span>
          ) : embedded ? null : (
            <span className="probe-card__write-hint">点击即写</span>
          )}
        </div>
      ) : null}
      {meta?.verifyPath && !embedded ? (
        <div className="probe-card__hint">核对：{meta.verifyPath}</div>
      ) : null}
    </div>
  );
}
