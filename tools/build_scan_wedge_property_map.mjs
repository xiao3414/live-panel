/**
 * 从 OEM oemPath → ScanWedge XML property name 生成 registry/scan/scan_wedge_property_map.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "registry/scan/oem20_scan_manifest.json");

/** @type {Record<string, string | null>} */
const EXPLICIT = {
  scanSwitch: "SCANNER_ENABLE",
  scanFloatingButton: "SUSPENSION_BUTTON",
  "scannerSelectionStep.internalSelection": "SCANNER_INTERNAL_CAMERA_ID",
  "scannerSelectionStep.scanEngineStep.scanEngineViewFinderTarget":
    "VIEW_FINDER_TARGET",
  "scannerSelectionStep.rearCameraStep.rearCameraTorchControl":
    "REAR_CAMERA_TORCH_CONTROL",
  "scannerSelectionStep.rearCameraStep.rearCameraViewFinderWindow":
    "VIEW_FINDER_SIZE",
  "scannerSelectionStep.rearCameraStep.rearCameraViewFinderTarget":
    "VIEW_FINDER_TARGET",
  scanTriggerMode: "TRIGGERING_MODES",
  "continuousScanningSet.continuousScanningMode": "DEC_Multiple_Decode_MODE",
  "continuousScanningSet.continuousScanningTimeout":
    "DEC_Multiple_Decode_TIMEOUT",
  "continuousScanningSet.continuousScanningTimeInterval":
    "DEC_Multiple_Decode_INTERVAL",
  "continuousScanningSet.decodeMultipleTimes": "DEC_MaxMultiRead_COUNT",
  "continuousScanningSet.decodeFixedNumber": "DEC_Multiple_Decode_MODE",
  "multipleBarcodeParameters.basicMultibarcode": "MULTI_DECODE_MODE",
  "multipleBarcodeParameters.numberOfBarcodesScannedPerTime": "BAR_CODES_TO_READ",
  "multipleBarcodeParameters.fullReadMode": "FULL_READ_MODE",
  "multipleBarcodeParameters.barcodeSeparator": "MULTI_DECODE_GS_CHAR",
  "multipleBarcodeParameters.barcodeCentroidSort": "MULTI_DECODE_COORD_SORT",
  "outputMode.outputModeSelect": "WEDGE_INTENT_ENABLE",
  "outputMode.keyBoardOutputMode.keyboardType": "WEDGE_KEYBOARD_TYPE",
  "outputMode.keyBoardOutputMode.sound": "GOOD_READ_BEEP_ENABLE",
  "outputMode.keyBoardOutputMode.vibrate": "GOOD_READ_VIBRATE_ENABLE",
  "outputMode.keyBoardOutputMode.operationKeyCharacters": "LABEL_APPEND_ENTER",
  "outputMode.keyBoardOutputMode.specifyControlCharacter":
    "LABEL_FORMAT_SEPARATOR_CHAR",
  "outputMode.broadcastOutputMode.broadcastAction": "WEDGE_INTENT_ACTION_NAME",
  "outputMode.broadcastOutputMode.broadcastStringDataLabel":
    "INTENT_DATA_STRING_TAG",
  "outputMode.broadcastOutputMode.broadcastByteDataLabel": "INTENT_DECODE_DATA_TAG",
  "outputMode.broadcastOutputMode.broadcastSound": "SEND_GOOD_READ_BEEP_ENABLE",
  "outputMode.broadcastOutputMode.broadcastVibrate":
    "SEND_GOOD_READ_VIBRATE_ENABLE",
  "outputMode.broadcastOutputMode.pasteBoard": "OUT_CLIPBOARD_ENABLE",
  "outputMode.broadcastOutputMode.inputTextBoxMode": "OUT_EDITORTEXT_MODE",
  "outputMode.broadcastOutputMode.parseUrlAndOpen": "CACHE_DATA_ENABLE",
  "outputMode.tcpOutputMode.tcpNetworkOutput": "IP_OUTPUT_WEDGE",
  "readerParameters.chineseEncodingType": "CODING_FORMAT",
  "readerParameters.customEncodingType": "CODING_FORMAT_NAME",
  "readerParameters.minimumLengthOfOneDimensionalCode": "VARIABLE_1D_MIN_LENGTH",
  "readerParameters.minimumLengthOfOneDimensionalCodeValue": "VARIABLE_1D_MIN_LENGTH",
  "readerParameters.beamTimer": "LASER_ON_TIME",
  "readerParameters.multipleVerification": "DEC_Multiple_Decode_MODE",
  "readerParameters.oneDimensionalCodeCharacteristics.fuzzy1dProcessing":
    "FUZZY_1D_PROCESSING",
  "readerParameters.oneDimensionalCodeCharacteristics.oneDimensionalInverseDecod":
    "IMAGE_ONE_D_INVERSE",
  "readerParameters.oneDimensionalCodeCharacteristics.oneDimensionalCodeBorderCheck":
    "LINEAR_CODE_TYPE_SECURITY_LEVEL",
  "readerParameters.oneDimensionalCodeCharacteristics.decodingSingleImageTime":
    "DEC_EachImageAttempt_TIME",
  "readerParameters.otherSettingsStep.lowPowerMode": "LOW_POWER_SLEEP_MODE",
  "readerParameters.otherSettingsStep.lowContrastMode": "DEC_2D_LIGHTS_MODE",
  "readerParameters.otherSettingsStep.imageContrastLevel": "DEC_ES_IMAGE_GAMMA",
  "readerParameters.otherSettingsStep.lowContrastImprovedAlgorithm":
    "DEC_USE_MLD",
  "readerParameters.rgbSensorDecodingStep.imageSingleChannelRecognition":
    "DEC_2D_CENTERING_ENABLE",
  "readerParameters.rgbSensorDecodingStep.imageEnhanceMode": "DEC_2D_LIGHTS_MODE",
  "udiDataFormat.udiDataFormatSwitch": "LABEL_SEPARATOR_ENABLE",
  "udiDataFormat.tokenFormat": "LABEL_MATCHER_PATTERN",
  "udiDataFormat.tokenSeparator": "LABEL_FORMAT_SEPARATOR_CHAR",
  "udiDataFormat.udiDate": "LABEL_MATCHER_TARGETREGEX",
  "udiDataFormat.allowAllUdiIds": "LABEL_MATCHER_REPLACEMENT",
  "basicDataFormat.barcodeIdentifier": "TRANSMIT_CODE_ID",
  "basicDataFormat.applicationIdentifier": "SPECIFIC_CODE_GS",
  "basicDataFormat.applicationIDSeparator": "LABEL_FORMAT_SEPARATOR_CHAR",
  "basicDataFormat.specialCharactersGsCodeSet": "SPECIFIC_CODE_GS",
  "basicDataFormat.additionalFormatting": "SEND_LABEL_PREFIX_SUFFIX",
  "basicDataFormat.prefix.prefixCustomCharacters": "LABEL_PREFIX",
  "basicDataFormat.suffix.suffixCustomCharacters": "LABEL_SUFFIX",
  "basicDataFormat.prefix.prefixSpecialCharacters": "LABEL_PREFIX",
  "basicDataFormat.suffix.suffixSpecialCharacters": "LABEL_SUFFIX",
  "basicDataFormat.format": "LABEL_MATCHER_PATTERN",
  "basicDataFormat.replace.originalChar": "LABEL_MATCHER_TARGETREGEX",
  "basicDataFormat.replace.replaceChar": "LABEL_MATCHER_REPLACEMENT",
  "basicDataFormat.removeNonPrintingControlCharacter": "REMOVE_NONPRINT_CHAR",
  "basicDataFormat.convertCharacterCase": "CONVERT_CHARACTER_CASE",
  "basicDataFormat.sendAsHex": "OUTPUT_HEX_STRING_DATA",
  "basicDataFormat.sendControlCharactersAsEvents": "LABEL_APPEND_ENTER",
  "barcodeSettings.code128": "CODE128_ENABLE",
  "barcodeSettings.code39": "CODE39_ENABLE",
  "barcodeSettings.EAN-13": "EAN13_ENABLE",
  "barcodeSettings.EAN-8": "EAN8_ENABLE",
  "barcodeSettings.interleaved2of5Step.interleaved2of5": "I25_ENABLE",
  "barcodeSettings.interleaved2of5Step.interleaved2of5Length1": "I25_LENGTH1",
  "barcodeSettings.interleaved2of5Step.interleaved2of5Length2": "I25_LENGTH2",
  "barcodeSettings.interleaved2of5Step.interleaved2of5CheckDigit":
    "I25_ENABLE_CHECK",
  "barcodeSettings.interleaved2of5Step.interleaved2of5SendCheckDigit":
    "I25_SEND_CHECK",
  "barcodeSettings.interleaved2of5Step.interleaved2of5ReducedQuietZone":
    "I25_TO_EAN13",
  "barcodeSettings.interleaved2of5Step.interleaved2of5SecurityLevel":
    "LINEAR_CODE_TYPE_SECURITY_LEVEL",
  "barcodeSettings.interleaved2of5Step.interleaved2of5BoundaryCheck":
    "LINEAR_CODE_TYPE_SECURITY_LEVEL",
  "barcodeSettings.interleaved2of5Step.interleaved2of5ConvertToEan13":
    "I25_TO_EAN13",
  "barcodeSettings.gs1DataBarFamilyStep.GS1DataBarFamily": "GS1_14_ENABLE",
  "barcodeSettings.gs1DataBarFamilyStep.gs1DataBarLimit": "GS1_LIMIT_ENABLE",
  "barcodeSettings.gs1DataBarFamilyStep.gs1DataBarExpanded": "GS1_EXP_ENABLE",
  "barcodeSettings.gs1DataBarFamilyStep.gs1ExpandedLength1": "GS1_EXP_LENGTH1",
  "barcodeSettings.gs1DataBarFamilyStep.gs1ExpandedLength2": "GS1_EXP_LENGTH2",
  "barcodeSettings.UPC-A": "UPCA_ENABLE",
  "barcodeSettings.UPC-E": "UPCE_ENABLE",
  "barcodeSettings.UPC-E1": "UPCE1_ENABLE",
  "barcodeSettings.UPC/EANExtensions": "EAN_EXT_ENABLE_2_5_DIGIT",
  "barcodeSettings.codabar": "CODABAR_ENABLE",
  "barcodeSettings.code11": "CODE11_ENABLE",
  "barcodeSettings.code93": "CODE93_ENABLE",
  "barcodeSettings.chinese25": "C25_ENABLE",
  "barcodeSettings.discrete2of5": "D25_ENABLE",
  "barcodeSettings.iata2of5": "IATA25_ENABLE",
  "barcodeSettings.matrix2of5": "M25_ENABLE",
  "barcodeSettings.msi": "MSI_ENABLE",
  "barcodeSettings.telepen": "TELEPEN_ENABLE",
  "barcodeSettings.stackedLinearSymbologiesStep.composite":
    "COMPOSITE_CC_AB_ENABLE",
  "barcodeSettings.stackedLinearSymbologiesStep.PDF417": "PDF417_ENABLE",
  "barcodeSettings.stackedLinearSymbologiesStep.microPDF417":
    "MICROPDF417_ENABLE",
  "barcodeSettings.matrix2dSymbologiesStep.datamatrix.datamatrixEnable":
    "DATAMATRIX_ENABLE",
  "barcodeSettings.matrix2dSymbologiesStep.datamatrix.datamatrixInverse":
    "DATAMATRIX_INVERSE",
  "barcodeSettings.matrix2dSymbologiesStep.datamatrix.datamatrixSS":
    "DATAMATRIX_SYMBOL_SIZE",
  "barcodeSettings.matrix2dSymbologiesStep.QRCode.qrcodeEnable":
    "QRCODE_ENABLE",
  "barcodeSettings.matrix2dSymbologiesStep.QRCode.qrcodeInverse":
    "QRCODE_INVERSE",
  "barcodeSettings.matrix2dSymbologiesStep.QRCode.qrcodeSS":
    "QRCODE_SYMBOL_SIZE",
  "barcodeSettings.matrix2dSymbologiesStep.QRCode.qrcodeModules":
    "QR_NON_SQUARE_MODULES",
  "barcodeSettings.matrix2dSymbologiesStep.QRCode.qrcodeZones":
    "QR_WITHOUT_QZ",
  "barcodeSettings.matrix2dSymbologiesStep.microQRCode": "QRCODE_ENABLE",
  "barcodeSettings.matrix2dSymbologiesStep.aztec": "AZTEC_ENABLE",
  "barcodeSettings.matrix2dSymbologiesStep.dotCode": "DOTCODE_ENABLE",
  "barcodeSettings.matrix2dSymbologiesStep.gridMatrix": "HANXIN_ENABLE",
  "barcodeSettings.matrix2dSymbologiesStep.hanXin": "HANXIN_ENABLE",
  "barcodeSettings.matrix2dSymbologiesStep.maxiCode": "MAXICODE_ENABLE",
  "barcodeSettings.othersSymbologyStep.postalCodes": "TRIOPTIC_ENABLE",
  "barcodeSettings.othersSymbologyStep.DPMDecoding": "DEC_2D_CENTERING_ENABLE",
  "ocrScan.ocrDecodeMode": "DEC_OCR_MODE",
  "ocrScan.ocrTemplate": "DEC_OCR_TEMPLATE",
  // Foundation 子项（字体/字符/长度）由 OEM 编进 DEC_OCR_USER_TEMPLATE，无独立可读属性
  "ocrScan.ocrCustomTemplate": "DEC_OCR_USER_TEMPLATE",
  "featureSet.interCharacterDelay": "CHARACTER_DATA_DELAY",
  "featureSet.enterKeyDelay": "APPEND_ENTER_DELAY",
};

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const out = {};
for (const { oemPath } of manifest.items) {
  const prop = EXPLICIT[oemPath] ?? null;
  if (prop) out[oemPath] = prop;
}
fs.writeFileSync(
  path.join(ROOT, "registry/scan/scan_wedge_property_map.json"),
  `${JSON.stringify(out, null, 2)}\n`,
  "utf8",
);
console.log(
  "[build_scan_wedge_property_map]",
  Object.keys(out).length,
  "mapped /",
  manifest.items.length,
);
