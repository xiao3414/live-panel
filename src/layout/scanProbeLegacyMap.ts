/** v0.1.1 早期 Scanner 探针 id → 现行 id（129 项 schema） */
export const LEGACY_SCAN_PROBE_ID_MAP: Record<string, string> = {
  "scan.switch": "scan.scanSwitch",
  "scan.floating_button": "scan.scanFloatingButton",
  "scan.internal_selection": "scan.scannerSelectionStep__internalSelection",
  "scan.trigger_mode": "scan.scanTriggerMode",
  "scan.continuous_mode":
    "scan.continuousScanningSet__continuousScanningMode",
  "scan.continuous_timeout":
    "scan.continuousScanningSet__continuousScanningTimeout",
  "scan.continuous_interval":
    "scan.continuousScanningSet__continuousScanningTimeInterval",
  "scan.decode_multiple_times":
    "scan.continuousScanningSet__decodeMultipleTimes",
  "scan.decode_fixed_number":
    "scan.continuousScanningSet__decodeFixedNumber",
  "scan.rear_torch":
    "scan.scannerSelectionStep__rearCameraStep__rearCameraTorchControl",
  "scan.rear_viewfinder_window":
    "scan.scannerSelectionStep__rearCameraStep__rearCameraViewFinderWindow",
  "scan.rear_viewfinder_target":
    "scan.scannerSelectionStep__rearCameraStep__rearCameraViewFinderTarget",
  "scan.engine_viewfinder_target":
    "scan.scannerSelectionStep__scanEngineStep__scanEngineViewFinderTarget",
};

export function migrateLegacyScanProbeId(probeId: string): string {
  return LEGACY_SCAN_PROBE_ID_MAP[probeId] ?? probeId;
}
