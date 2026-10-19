# 实况面板（Live Panel）

独立桌面看板：可视化查看已连接设备的 OEM 配置生效态；探针与布局可扩展。

> 产品标识见 `docs/BRANDING.md`

## 目录说明

见 `docs/PROJECT_STRUCTURE.md`。

## 配置文件

| 文件 | 作用 |
|------|------|
| `registry/probes.yaml` | 探针注册表（25 条样例，可增删） |
| `schemas/layout.schema.json` | 看板布局 JSON Schema |
| `layouts/example-default.json` | 示例布局 |

## 工具名参考

见 `docs/NAMING.md`。

## 知识库位置

`C:\Users\urovo\Desktop\测试知识库\10_工具开发\实况面板\`（本目录为**原件**）

说明文档：`01_项目说明/实况面板_项目知识.md`

## GitHub

**仓库**：https://github.com/xiao3414/live-panel

本地已绑定 `origin` 且分支为 `main`，在工程目录执行：

```powershell
cd "C:\Users\urovo\Desktop\测试知识库\10_工具开发\实况面板"
git push -u origin main
```

（勿重复 `git remote add`；若需改地址：`git remote set-url origin https://github.com/xiao3414/live-panel.git`）

## 本地运行（开发中）

```powershell
npm install
npm run electron:dev
```

详见 `docs/DEV.md`。成品阶段再打包 `npm run electron:build` 并同步 GitHub。

## 后续

- 策略 JSON Diff、布局另存为
- USDK 探针、Local OTA 专用 runner
- 可选：安装 Rust 后迁 Tauri 2 减体积
