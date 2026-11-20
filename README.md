# 实况面板（Live Panel）

**当前版本：0.2.0**

独立桌面看板：可视化查看已连接设备的 OEM 配置生效态；探针与布局可扩展。通过 ADB + `device-usdk-bridge` 直读设备，并支持与 OEM JSON 对账。

> 产品标识见 [`docs/BRANDING.md`](docs/BRANDING.md)

## 下载（成品）

| 资源 | 链接 |
|------|------|
| **GitHub Release** | https://github.com/xiao3414/live-panel/releases/tag/v0.2.0 |
| **Windows 便携包** | [LivePanel-0.2.0-portable.exe](https://github.com/xiao3414/live-panel/releases/download/v0.2.0/LivePanel-0.2.0-portable.exe) |

免安装；首次连设备时按应用内提示安装 USDK 桥接 APK。

## 本版能力（0.2.0）

- **System**：含 Power Management 等直读；省电模式在充电场景可标为 `platform_locked`
- **Network 集合 4–9**：Private DNS / NFC / Ethernet / GPS / BT / Airplane（USDK 桥接 + JSON expect）
- **Scan / Docking**：扫描与座充相关探针与专用布局
- **Security / MDM**：平台策略、写回核对等校验脚本（见下方命令）

## 仓库与文档

| 项 | 说明 |
|----|------|
| **仓库** | https://github.com/xiao3414/live-panel |
| **分支** | `main` |
| **目录说明** | [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) |
| **本地开发** | [`docs/DEV.md`](docs/DEV.md) |
| **命名** | [`docs/NAMING.md`](docs/NAMING.md) |
| **知识库原件** | `C:\Users\urovo\Desktop\测试知识库\10_工具开发\实况面板\` |
| **项目说明** | `01_项目说明/实况面板_项目知识.md` |

## 配置与探针

| 路径 | 作用 |
|------|------|
| `registry/probes.yaml` | 早期样例探针（约 25 条） |
| `registry/modules/*.yaml` | OEM 2.0 模块探针（System / Network / Scan / Security 等） |
| `registry/system/*_probe_map.json` | System / Network 4–9 探针映射 |
| `layouts/oem20-*.json` | OEM 2.0 看板布局（含 Network 4–9、Power Management 等） |
| `schemas/layout.schema.json` | 看板布局 JSON Schema |
| `resources/device-usdk-bridge.apk` | 设备端 USDK 桥接包（打包时打入 extraResources） |
| `config/app.defaults.json` | ADB 路径、窗口、刷新间隔等默认配置 |

探针字段说明见 [`registry/README.md`](registry/README.md)。

## 本地运行（开发）

前置：Node.js 18+、PATH 中有 **adb**、设备已开 USB 调试。

```powershell
cd "C:\Users\urovo\Desktop\测试知识库\10_工具开发\实况面板"
npm install
npm run electron:dev
```

也可双击 `start-livepanel.bat` / `启动实况面板.bat`。

## 打包

```powershell
npm run electron:build
```

产出：`release/LivePanel-0.2.0-portable.exe`  
（Windows 若无签名证书，`package.json` 中已设 `signAndEditExecutable: false`，避免 winCodeSign 符号链接权限问题。）

推送与 Release 挂载见 [`docs/GITHUB_SETUP.md`](docs/GITHUB_SETUP.md)；当前成品已挂在 **v0.2.0** Release。

## 常用校验脚本

```powershell
npm run verify:security   # bridge / write / reconcile / clipboard / usb-mode / mdm
npm run verify:scanner
npm run compare:oem
```

## 后续

- 策略 JSON Diff、布局另存为（产品化）
- 可选：安装 Rust 后迁 Tauri 2 减体积
