import type { CompareRow } from "../expectCompare";
import type { ProbeMeta, ProbeResult } from "../types";
import { DockingStationFormCard } from "./DockingStationFormCard";
import { OemModuleFormCard } from "./OemModuleFormCard";
import { ProbeCard } from "./ProbeCard";
import { ScanModuleFormCard } from "./ScanModuleFormCard";
import { WifiAdvancedSettingsCard } from "./WifiAdvancedSettingsCard";
import { WifiNetworkCard } from "./WifiNetworkCard";
import { WifiPreferenceSettingsCard } from "./WifiPreferenceSettingsCard";
import { WifiWhitelistSettingsCard } from "./WifiWhitelistSettingsCard";

type Props = {
  meta?: ProbeMeta;
  probeIds: string[];
  results: ProbeResult[];
  deviceSerial?: string;
  onWriteProbe?: (probeId: string, mode: "on" | "off") => void;
  onWriteProbeValue?: (probeId: string, value: string) => void;
  writingProbeId?: string | null;
  readOnly?: boolean;
  compareRow?: CompareRow;
  probeMeta?: Map<string, ProbeMeta>;
  allValues?: Map<string, ProbeResult>;
  compareByProbeId?: Map<string, CompareRow>;
};

export function ProbeWidgetBody({
  meta,
  probeIds,
  results,
  deviceSerial,
  onWriteProbe,
  onWriteProbeValue,
  writingProbeId,
  readOnly,
  compareRow,
  probeMeta,
  allValues,
  compareByProbeId,
}: Props) {
  const writeHandler = readOnly ? undefined : onWriteProbe;
  const writeValueHandler = readOnly ? undefined : onWriteProbeValue;
  if (
    meta?.displayType === "docking_station_form" &&
    meta.memberIds?.length &&
    probeMeta &&
    allValues
  ) {
    return (
      <DockingStationFormCard
        meta={meta}
        memberIds={meta.memberIds}
        probeMeta={probeMeta}
        values={allValues}
        compareByProbeId={compareByProbeId}
        deviceSerial={deviceSerial}
        readOnly={readOnly}
      />
    );
  }
  if (
    meta?.displayType === "oem_module_form" &&
    meta.memberIds?.length &&
    probeMeta &&
    allValues
  ) {
    return (
      <OemModuleFormCard
        meta={meta}
        memberIds={meta.memberIds}
        probeMeta={probeMeta}
        values={allValues}
        compareByProbeId={compareByProbeId}
        deviceSerial={deviceSerial}
        readOnly={readOnly}
        onWriteProbe={writeHandler}
        onWriteProbeValue={writeValueHandler}
      />
    );
  }
  if (
    meta?.displayType === "scan_module_form" &&
    meta.memberIds?.length &&
    probeMeta &&
    allValues
  ) {
    return (
      <ScanModuleFormCard
        meta={meta}
        memberIds={meta.memberIds}
        probeMeta={probeMeta}
        values={allValues}
        compareByProbeId={compareByProbeId}
        onWriteProbe={writeHandler}
        onWriteProbeValue={writeValueHandler}
        writingProbeId={writingProbeId}
        readOnly={readOnly}
      />
    );
  }
  if (meta?.displayType === "wifi_advanced_settings_form") {
    return (
      <WifiAdvancedSettingsCard
        verifyPath={meta.verifyPath}
        embedded
        deviceSerial={deviceSerial}
        readOnly={readOnly}
      />
    );
  }
  if (meta?.displayType === "wifi_preference_settings_form") {
    return (
      <WifiPreferenceSettingsCard
        verifyPath={meta.verifyPath}
        embedded
        deviceSerial={deviceSerial}
        readOnly={readOnly}
      />
    );
  }
  if (meta?.displayType === "wifi_whitelist_settings_form") {
    return (
      <WifiWhitelistSettingsCard
        verifyPath={meta.verifyPath}
        embedded
        deviceSerial={deviceSerial}
        readOnly={readOnly}
      />
    );
  }
  if (
    meta?.displayType === "wifi_network_form" ||
    meta?.displayType === "wifi_general_settings_form"
  ) {
    return (
      <WifiNetworkCard
        verifyPath={meta.verifyPath}
        embedded
        deviceSerial={deviceSerial}
        readOnly={readOnly}
      />
    );
  }
  return (
    <ProbeCard
      meta={meta}
      results={results}
      onWrite={writeHandler}
      onWriteValue={writeValueHandler}
      writing={writingProbeId === probeIds[0]}
      embedded
      compareRow={compareRow}
    />
  );
}
