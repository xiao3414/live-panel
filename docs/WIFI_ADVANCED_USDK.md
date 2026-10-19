# WiFi Advanced Option — USDK / INI 映射

> 对齐 OEM 2.0 `WiFi Advanced Option` + USDK `NetworkManagerEx.putIni/getIni`（见知识库 `USDK-JAR-Docs` 3.3.3）

## DT630（MTK / mt6878）INI 键

| 框架配置项 | USDK getIni/putIni |
|------------|-------------------|
| Power Save Mode | `gParamPowerMode`（0 关 / 2 开） |
| Roaming Threshold | `RoamingRCPIGoodValue` |
| Roaming Difference | `RoamingRCPIDelta0` |
| Wifi Band Selection | `Combined_WifiBand` |
| 2.4G Channel（合并项） | `MTK_WifiChannel` |
| WiFi Country Code | `getWifiCountryCode` / `setWifiCountryCode` |
| WiFi Scanning | `settings global wifi_scan_always_enabled`（非 INI） |

高通平台见 `QCOM_PowerSave`、`gNeighborLookupThreshold`、`RoamRssiDiff`、`gRoamPrefer5GHz`、`wifiBandValue24/5`。

## LivePanel USDK 桥接 APK

PC 端无法直接加载 `com.ubx.usdk.jar`，需设备安装 **`device-usdk-bridge`**：

```bash
cd 10_工具开发/实况面板/device-usdk-bridge
# 将设备上的 com.ubx.usdk.jar 拷到 libs/ 或在构建机设置 UROVO_USDK_JAR
gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

广播（由 Electron 自动调用）：

- `com.urovo.livepanel.USDK_INI` + `op=getIni|putIni|getWifiCountryCode|setWifiCountryCode`
- 结果文件：`/data/local/tmp/livepanel_usdk_ini.txt`

未安装桥接时：表单仍可读 **WiFi Scanning**、部分 **getprop**；INI 字段为空并提示安装桥接。

## OEM 注意

- WiFi Advanced 需 SOTI 中 **WiFi Advanced Action = Configure** 后整段才生效（OEM2-0026）。
