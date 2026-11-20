import { useEffect, useMemo, useState } from "react";
import type { CompareRow } from "../expectCompare";
import { messageFromError } from "../utils/formMessage";
import type { ProbeMeta, ProbeResult } from "../types";
import { probeBlockTitle } from "../probeTitles";

type Props = {
  meta: ProbeMeta;
  memberIds: string[];
  probeMeta: Map<string, ProbeMeta>;
  values: Map<string, ProbeResult>;
  compareByProbeId?: Map<string, CompareRow>;
  deviceSerial?: string;
  readOnly?: boolean;
  onWriteProbe?: (
    probeId: string,
    mode: "on" | "off",
  ) => void | Promise<unknown>;
  onWriteProbeValue?: (
    probeId: string,
    value: string,
  ) => void | Promise<unknown>;
};

const NO_CHANGE = "no_change";

function rawOf(values: Map<string, ProbeResult>, id: string): string {
  return values.get(id)?.raw?.trim() ?? "";
}

/** 下拉选项：优先 OEM 语义键，去掉 0/1、纯数字档位/毫秒等设备 raw */
function selectOptions(fieldMeta: ProbeMeta): string[] {
  const labels = fieldMeta.valueLabels;
  if (!labels) {
    return fieldMeta.displayType === "toggle" ? ["Enable", "Disable"] : [];
  }
  const keys = Object.keys(labels).map(String);
  const semantic = keys.filter(
    (k) =>
      k !== "1" &&
      k !== "0" &&
      !/^-?\d+(\.\d+)?$/.test(k),
  );
  if (semantic.length) return semantic;
  if (fieldMeta.displayType === "toggle") return ["Enable", "Disable"];
  return keys;
}

/** 把期望/设备 raw 映射到某个 option；对不上则 No change，避免非法 controlled select */
function coerceSelectValue(
  raw: string,
  options: string[],
  fieldMeta: ProbeMeta,
): string {
  if (!raw || raw === NO_CHANGE) return NO_CHANGE;
  if (options.includes(raw)) return raw;
  const mapped = fieldMeta.valueLabels?.[raw];
  if (mapped != null && options.includes(String(mapped))) {
    return String(mapped);
  }
  // 1/0 ↔ Enable/Disable / Auto/Manual
  if (raw === "1" || /^enable$/i.test(raw) || /^auto$/i.test(raw)) {
    const hit = options.find((o) => /^(enable|auto)$/i.test(o));
    if (hit) return hit;
  }
  if (raw === "0" || /^disable$/i.test(raw) || /^manual$/i.test(raw)) {
    const hit = options.find((o) => /^(disable|manual)$/i.test(o));
    if (hit) return hit;
  }
  return NO_CHANGE;
}

function FieldLabel({
  mid,
  fieldMeta,
  compare,
}: {
  mid: string;
  fieldMeta: ProbeMeta;
  compare?: CompareRow;
}) {
  const title = probeBlockTitle(
    mid,
    fieldMeta.item,
    undefined,
    fieldMeta.itemZh,
  );
  return (
    <span className="docking-form__label-wrap">
      <span className="scan-module-form__label-main">{title.main}</span>
      {title.sub ? (
        <span className="scan-module-form__label-sub">{title.sub}</span>
      ) : null}
      {compare?.status === "mismatch" ? (
        <span className="docking-form__mismatch">
          JSON {String(compare.expectedDisplay)} ≠ 设备{" "}
          {String(compare.actualDisplay)}
          {compare.platformNote ? ` · ${compare.platformNote}` : ""}
        </span>
      ) : null}
      {compare?.status === "platform_locked" ? (
        <span className="docking-form__exempt">
          {compare.platformNote ||
            `设备 ${String(compare.actualDisplay ?? "—")}（平台/机型豁免）`}
        </span>
      ) : null}
      {compare?.status === "unread" ? (
        <span className="docking-form__exempt">设备未读到（可填后写回）</span>
      ) : null}
    </span>
  );
}

type FormSection = { key: string; legend: string; ids: string[] };

/** 对齐 OEM Config：主 Display / Screen Saver / External Display */
function splitOemFormSections(
  memberIds: string[],
  defaultLegend: string,
): FormSection[] {
  const main: string[] = [];
  const saver: string[] = [];
  const external: string[] = [];
  for (const id of memberIds) {
    if (id.includes("screenSaverStep")) saver.push(id);
    else if (id.includes("displayExternalStep")) external.push(id);
    else main.push(id);
  }
  const out: FormSection[] = [];
  if (main.length) out.push({ key: "main", legend: defaultLegend, ids: main });
  if (saver.length)
    out.push({ key: "saver", legend: "Screen Saver", ids: saver });
  if (external.length)
    out.push({ key: "external", legend: "External Display", ids: external });
  if (!out.length)
    out.push({ key: "main", legend: defaultLegend, ids: memberIds });
  return out;
}

export function OemModuleFormCard({
  meta,
  memberIds,
  probeMeta,
  values,
  compareByProbeId,
  deviceSerial,
  readOnly,
  onWriteProbe,
  onWriteProbeValue,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const sections = useMemo(
    () => splitOemFormSections(memberIds, meta.itemZh ?? meta.item),
    [memberIds, meta.item, meta.itemZh],
  );

  const readStamp = useMemo(
    () =>
      memberIds
        .map((id) => {
          const r = values.get(id);
          return `${id}:${r?.raw ?? ""}:${r?.at ?? 0}`;
        })
        .join("|"),
    [memberIds, values],
  );

  useEffect(() => {
    if (busy) return;
    const next: Record<string, string> = {};
    for (const id of memberIds) {
      const m = probeMeta.get(id);
      const cmp = compareByProbeId?.get(id);
      if (m?.displayType === "toggle" || m?.displayType === "enum") {
        const options = selectOptions(m);
        // 以 OEM JSON 为主：有期望就显示 Enable/Disable，不再默认堆 No change
        if (cmp?.expectedRaw) {
          next[id] = coerceSelectValue(
            String(cmp.expectedRaw),
            options,
            m,
          );
        } else {
          next[id] = NO_CHANGE;
        }
      } else if (cmp?.status === "mismatch" || cmp?.status === "platform_locked") {
        // 不符/豁免：输入框显示设备实况，避免把 JSON 期望误当成机上当前值
        const device = rawOf(values, id);
        next[id] =
          device ||
          String(cmp.actualRaw ?? cmp.actualDisplay ?? "").trim() ||
          String(cmp.expectedRaw).replace(/%/g, "").trim();
      } else if (cmp?.expectedRaw) {
        // 文本项（音量/亮度等）有 OEM 期望时优先显示 JSON
        next[id] = String(cmp.expectedRaw).replace(/%/g, "").trim();
      } else {
        next[id] = rawOf(values, id);
      }
    }
    setDrafts(next);
    setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceSerial, readStamp, compareByProbeId]);

  const setDraft = (id: string, v: string) =>
    setDrafts((prev) => ({ ...prev, [id]: v }));

  const onApply = async () => {
    if (!onWriteProbe && !onWriteProbeValue) {
      setMsgOk(false);
      setMsg("写回接口未就绪");
      return;
    }
    setBusy(true);
    setMsg(null);
    let wrote = 0;
    const failed: string[] = [];
    try {
      for (const id of memberIds) {
        const m = probeMeta.get(id);
        if (!m?.writable) continue;
        const draft = (drafts[id] ?? "").trim();
        if (!draft || draft === NO_CHANGE) continue;
        const cur = rawOf(values, id);
        // 语义值写回：优先用 labels 的数字键（1/0），避免 Enable:Enable 原样下发
        let writeVal = draft;
        if (m.valueLabels) {
          let digitKey: string | undefined;
          let anyKey: string | undefined;
          for (const [k, label] of Object.entries(m.valueLabels)) {
            const text = String(label ?? "");
            if (
              k === draft ||
              text === draft ||
              text.toLowerCase() === draft.toLowerCase()
            ) {
              if (/^\d+$/.test(k)) {
                digitKey = k;
                break;
              }
              if (!anyKey) anyKey = k;
            }
          }
          if (digitKey) writeVal = digitKey;
          else if (anyKey && /^\d+$/.test(anyKey)) writeVal = anyKey;
        }
        if (
          m.displayType === "toggle" &&
          ((/^(1|enable|enabled|on|auto|true)$/i.test(draft) &&
            /^(1|enable|enabled|on|auto|true)$/i.test(cur)) ||
            (/^(0|disable|disabled|off|manual|false)$/i.test(draft) &&
              /^(0|disable|disabled|off|manual|false)$/i.test(cur)))
        ) {
          continue;
        } else if (draft === cur) {
          continue;
        }
        try {
          if (
            m.displayType === "toggle" &&
            (writeVal === "1" ||
              writeVal === "0" ||
              /^(enable|enabled|on|auto|true)$/i.test(draft) ||
              /^(disable|disabled|off|manual|false)$/i.test(draft))
          ) {
            const on =
              writeVal === "1" ||
              /^(enable|enabled|on|auto|true)$/i.test(draft);
            if (onWriteProbe) {
              await Promise.resolve(onWriteProbe(id, on ? "on" : "off"));
              wrote++;
              continue;
            }
          }
          if (onWriteProbeValue) {
            await Promise.resolve(onWriteProbeValue(id, writeVal));
            wrote++;
          }
        } catch (e) {
          failed.push(`${m.itemZh ?? m.item}:${messageFromError(e)}`);
        }
      }
      if (failed.length) {
        setMsgOk(false);
        setMsg(
          `写回 ${wrote} 项；失败：${failed.slice(0, 3).join("；")}${failed.length > 3 ? "…" : ""}`,
        );
      } else if (wrote === 0) {
        setMsgOk(false);
        setMsg("没有需要写回的项（均为 No change / 未改）");
      } else {
        setMsgOk(true);
        setMsg(`已下发 ${wrote} 项；请点「立即刷新」核对`);
      }
    } finally {
      setBusy(false);
    }
  };

  const renderField = (mid: string) => {
    const fieldMeta = probeMeta.get(mid);
    if (!fieldMeta) return null;
    const isSelect =
      fieldMeta.displayType === "toggle" || fieldMeta.displayType === "enum";
    const options = isSelect ? selectOptions(fieldMeta) : [];
    const draft = isSelect
      ? coerceSelectValue(drafts[mid] ?? NO_CHANGE, options, fieldMeta)
      : (drafts[mid] ?? "");
    return (
      <label key={mid} className="wifi-form-field">
        <FieldLabel
          mid={mid}
          fieldMeta={fieldMeta}
          compare={compareByProbeId?.get(mid)}
        />
        {isSelect ? (
          <select
            value={draft}
            onChange={(e) => setDraft(mid, e.target.value)}
          >
            <option value={NO_CHANGE}>No change</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {String(fieldMeta.valueLabels?.[opt] ?? opt)}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={draft === NO_CHANGE ? "" : draft}
            placeholder={rawOf(values, mid) || "填写后写回"}
            onChange={(e) => setDraft(mid, e.target.value)}
          />
        )}
      </label>
    );
  };

  return (
    <div className="probe-card wifi-form-card docking-station-form oem-module-form">
      {sections.map((sec) => (
        <fieldset
          key={sec.key}
          className="wifi-form-section"
          disabled={busy || readOnly}
        >
          <legend>{sec.legend}</legend>
          <div className="wifi-form-grid oem-module-form__grid">
            {sec.ids.map((mid) => renderField(mid))}
          </div>
        </fieldset>
      ))}

      <div className="wifi-form-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            const next: Record<string, string> = {};
            for (const id of memberIds) {
              const m = probeMeta.get(id);
              if (m?.displayType === "toggle" || m?.displayType === "enum") {
                next[id] = NO_CHANGE;
              } else {
                next[id] = rawOf(values, id);
              }
            }
            setDrafts(next);
            setMsg(null);
          }}
        >
          重置为 No change
        </button>
        {!readOnly ? (
          <button type="button" disabled={busy} onClick={() => void onApply()}>
            写回设备
          </button>
        ) : null}
      </div>
      {msg ? (
        <p
          className={`wifi-form-msg${msgOk ? "" : " wifi-form-msg--err"}`}
          role={msgOk ? "status" : "alert"}
        >
          {msg}
        </p>
      ) : null}
      {meta.verifyPath ? (
        <p className="wifi-form-hint">{meta.verifyPath}</p>
      ) : null}
    </div>
  );
}
