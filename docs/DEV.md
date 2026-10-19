# 本地开发

## 环境

- Node.js 18+（已测 v24）
- 系统 PATH 中有 **adb**，设备已开 USB 调试
- 桌面壳：**Electron**（本机未装 Rust 时先用此方案；后续可迁 Tauri 2）

## 命令

**快捷启动（推荐）**

- 双击 **`start-livepanel.bat`** 或 **`启动实况面板.bat`**（同入口）
- 或桌面 / 知识库根目录 **`LivePanel.lnk`**（生成：`powershell -ExecutionPolicy Bypass -File scripts\create-shortcuts.ps1`）

```powershell
cd "C:\Users\urovo\Desktop\测试知识库\10_工具开发\实况面板"
npm install
npm run electron:dev
```

### 报错：`Electron failed to install correctly`

多为 **electron 二进制没下完**（并行 `npm install`、网络中断、目录被占用）。先关掉所有 `npm run electron:dev` / `npm install` 窗口，再执行：

```powershell
.\scripts\fix-electron.ps1
```

或手动：`Remove-Item -Recurse -Force node_modules\electron` 后 `npm install electron@33.4.11 --save-dev`。  
项目根目录 `.npmrc` 已配置国内 electron 镜像，重装时会走镜像。

- 前端：Vite `http://127.0.0.1:5173`
- 主进程：`electron/` 编译到 `dist-electron/`

## 打包便携版（Windows）

```powershell
npm run electron:build
```

产出：`release/LivePanel-0.1.0-portable.exe`

## 配置

- 默认：`config/app.defaults.json`（ADB 路径、窗口尺寸、刷新间隔）
- 选中的设备序列号会写回 `config/app.defaults.json` 的 `adb.deviceSerial`

## 扩展探针

1. 编辑 `registry/probes.yaml`
2. 在 `layouts/*.json` 的 widget 里绑定 `probeIds`
3. 重启应用或点「立即刷新」
