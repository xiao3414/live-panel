import type { ProbeMeta, ProbeResult } from "../types";
import { ProbeWidgetBody } from "./ProbeWidgetBody";
import { WidgetShell } from "./WidgetShell";

type Props = {
  title: string;
  oemPath?: string;
  probeId: string;
  meta?: ProbeMeta;
  results: ProbeResult[];
  onWriteProbe?: (probeId: string, mode: "on" | "off") => void;
  onWriteProbeValue?: (probeId: string, value: string) => void;
  writingProbeId?: string | null;
  deviceSerial?: string;
  readOnly?: boolean;
};

export function OemFocusPanel({
  title,
  oemPath,
  probeId,
  meta,
  results,
  onWriteProbe,
  onWriteProbeValue,
  writingProbeId,
  deviceSerial,
  readOnly,
}: Props) {
  return (
    <div className="oem-focus-panel">
      <WidgetShell title={title} oemPath={oemPath} verifyPath={meta?.verifyPath}>
        <ProbeWidgetBody
          meta={meta}
          probeIds={[probeId]}
          results={results}
          deviceSerial={deviceSerial}
          onWriteProbe={onWriteProbe}
          onWriteProbeValue={onWriteProbeValue}
          writingProbeId={writingProbeId}
          readOnly={readOnly}
        />
      </WidgetShell>
    </div>
  );
}
