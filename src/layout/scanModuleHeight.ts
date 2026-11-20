import {
  estimateScannerBlockRows,
  scannerBlockHeight,
  scanFormColumns,
} from "./scannerPanelLayout";

/** @deprecated 使用 estimateScannerBlockRows / scannerBlockHeight */
export function estimateScanModuleGridRows(
  memberCount: number,
  gridCols = 12,
  blockW = gridCols,
): number {
  return estimateScannerBlockRows(memberCount, blockW, gridCols);
}

export { scannerBlockHeight, scanFormColumns, estimateScannerBlockRows };
