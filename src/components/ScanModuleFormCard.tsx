import type { CompareRow } from "../expectCompare";
import type { ProbeMeta, ProbeResult } from "../types";
import { probeBlockTitle } from "../probeTitles";
import { ProbeCard } from "./ProbeCard";

type Props = {
  meta: ProbeMeta;
  memberIds: string[];
  probeMeta: Map<string, ProbeMeta>;
  values: Map<string, ProbeResult>;
  compareByProbeId?: Map<string, CompareRow>;
  onWriteProbe?: (probeId: string, mode: "on" | "off") => void;
  onWriteProbeValue?: (probeId: string, value: string) => void;
  writingProbeId?: string | null;
  readOnly?: boolean;
};

export function ScanModuleFormCard({
  meta,
  memberIds,
  probeMeta,
  values,
  compareByProbeId,
  onWriteProbe,
  onWriteProbeValue,
  writingProbeId,
  readOnly,
}: Props) {
  const writeHandler = readOnly ? undefined : onWriteProbe;
  const writeValueHandler = readOnly ? undefined : onWriteProbeValue;

  const soloModule = memberIds.length === 1;

  return (
    <div
      className={`wifi-form-card scan-module-form${soloModule ? " scan-module-form--solo" : ""}`}
    >
      {memberIds.map((mid) => {
        const fieldMeta = probeMeta.get(mid);
        if (!fieldMeta) return null;
        const result =
          values.get(mid) ??
          ({
            probeId: mid,
            ok: true,
            raw: null,
            display: "…",
            at: 0,
          } satisfies ProbeResult);
        const titleParts = probeBlockTitle(
          mid,
          fieldMeta.item,
          undefined,
          fieldMeta.itemZh,
        );
        const soloField = memberIds.length === 1;
        return (
          <div
            key={mid}
            className={`wifi-form-field scan-module-form__field${soloField ? " scan-module-form__field--solo" : ""}`}
          >
            {!soloField ? (
              <label className="scan-module-form__label">
                <span className="scan-module-form__label-main">{titleParts.main}</span>
                {titleParts.sub ? (
                  <span className="scan-module-form__label-sub">{titleParts.sub}</span>
                ) : null}
              </label>
            ) : null}
            <div className="scan-module-form__control">
              <ProbeCard
                meta={fieldMeta}
                results={[result]}
                onWrite={writeHandler}
                onWriteValue={writeValueHandler}
                writing={writingProbeId === mid}
                embedded
                compareRow={compareByProbeId?.get(mid)}
              />
            </div>
          </div>
        );
      })}
      {meta.verifyPath && !soloModule ? (
        <p className="wifi-form-hint">{meta.verifyPath}</p>
      ) : null}
    </div>
  );
}
