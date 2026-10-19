# Network · WLAN 与 OEM 2.0 对齐说明

> 框架来源：`03_接口与配置映射/OEMConfig_2.0_产品框架/Network Configuration.md`  
> 接口摘要：`03_接口与配置映射/功能与接口对齐_索引摘要.md`  
> OEM DEX：`tools/oem20_apk_inspect/OEM_261009_解读.md`

## Network L2（与 SOTI / OEM 托管菜单一致）

| OEM L2 | 实况面板入口 | 说明 |
|--------|--------------|------|
| WLAN | `navigation` → WLAN 组合面板 | 四表单 + WiFi State |
| SIM Configuration | `oem20-network-sim-configuration` | SIM 直读 + SIM1/2/eSIM catalog |
| Hotspot & Tethering | `oem20-network-hotspot-tethering` | 热点 / USB 共享 ADB |
| Private DNS | `oem20-network-private-dns` | mode + hostname |
| NFC | `oem20-network-nfc` | NFC Adapter |
| Ethernet | `oem20-network-ethernet` | 链路与代理 |

## WLAN 子模块（与 OEM 导航一致）

| OEM L2 | 实况面板块 | 配置项覆盖 |
|--------|------------|------------|
| WiFi Networks | `wifi.general_settings` | WLAN Action、WiFi State、SSID、Security、Hidden、IP/Proxy、Random MAC 等 |
| WiFi Advanced Option | `wifi.advanced_settings` | Power Save、Roaming、Scanning、Country、5G、Band、Channel |
| WiFi Preference | `wifi.preference_settings` | Captive Portal；Network Available Notification；Network Monitored Notification |
| WiFi Whitelist | `wifi.whitelist_settings` | Configuration Action；SSID1～SSID5 |
| WiFi State（独立） | `wifi.state` | 模块库单开关，General 表单内亦有 WiFi State |
| Private DNS | `network.private_dns` | 同 L1 其他 DNS 项 |

## WiFi Preference 字段映射

| OEM 配置项 | USDK / ADB | 实况面板 |
|------------|------------|----------|
| Captive Portal | `DeviceManagerEx.get/setCaptivePortalMode("0"\|"1"\|"2")` | 下拉 No change + 三档 |
| Network Available Notification | `setWifiNotificationEnabled` / `global wifi_networks_available_notification_on` | 下拉 Enable/Disable |
| Network Monitored Notification | `NetworkManagerEx.setWifiWakeupEnabled` / `global wifi_wakeup_enabled` | 下拉 Enable/Disable |

Captive Portal 含义（与 SDKAuto 一致）：`0` 正常连接；`1` 感叹号提示；`2` 不自动连接。

## WiFi Whitelist 字段映射

| OEM 配置项 | USDK | 实况面板 |
|------------|------|----------|
| Clear Whitelist | `setWifiWhiteList(null, 0, 0)` | Configuration Action = Clear |
| Insert WiFi White List | `setWifiWhiteList(ssid, 0, 1)` 逐条 | SSID1～5 + Insert |
| 读列表 | `DeviceManager.getWifiWhiteList()` | 「设备当前白名单」列表 |

## USDK 桥接（随 LivePanel 自动安装）

Captive Portal 与 Whitelist **无可靠 ADB 只读路径**，依赖设备包：

`com.urovo.livepanel.usdkbridge`（内置 APK，连接 USB 后 LivePanel **自动 adb install**，使用者无需手工安装）。

维护者打包：见 `resources/README.md`（`device-usdk-bridge` + `com.ubx.usdk.jar` → `npm run copy:bridge` → portable）。

Preference 两项通知在**未装桥接**时仍可通过 `settings get/put` 读写（与单探针 `wifi.notification` / `wifi.wakeup` 一致）。

## DT630 快速核对（ADB）

```powershell
adb -s <serial> shell settings get global wifi_networks_available_notification_on
adb -s <serial> shell settings get global wifi_wakeup_enabled
adb -s <serial> shell pm path com.urovo.livepanel.usdkbridge
```

## 建议验收步骤

1. **恢复出厂布局** → 布局 `OEM2.0 · Network Configuration`  
2. **General**：读 SSID / WiFi State，与设置 UI 对照  
3. **Advanced**：Scanning 开关（无 INI 桥接时仍可 ADB settings）  
4. **Preference**：改 Available Notification → 设置 → 网络偏好设置  
5. **Preference**：装桥接后改 Captive Portal → 连门户 WiFi 看 0/1/2 行为  
6. **Whitelist**：Insert 测试 SSID → OEM / WiFi 白名单 UI 与 `getWifiWhiteList` 一致  
