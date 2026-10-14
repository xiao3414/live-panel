# 实况面板 — 产品标识

| 项 | 值 |
|----|-----|
| **产品中文名** | 实况面板 |
| **产品英文名** | Live Panel |
| **应用标题（窗口）** | 实况面板 |
| **包名 / App ID** | `com.urovo.livepanel` |
| **可执行文件名（建议）** | `LivePanel.exe` |
| **用户数据目录** | `%APPDATA%\Urovo\LivePanel\` |
| **仓库目录名** | `oem-device-dashboard`（可保持不变） |

## 托盘与关于

- 托盘提示：`实况面板 — 设备配置实况`
- 关于对话框：`实况面板 v{version}` + OEMConfig APK 版本（可选）

## 与 OEMConfig 区分

- **OEMConfig**：MDM 托管应用，负责接收策略  
- **实况面板**：测试/验收用 **独立桌面工具**，只读展示设备生效态，**不是** OEMConfig 安装包
