# 项目目录结构

```text
实况面板（仓库目录 oem-device-dashboard/）
├── README.md
├── docs/
│   ├── PROJECT_STRUCTURE.md      # 本文件
│   ├── BRANDING.md               # 实况面板 产品标识
│   ├── NAMING.md                 # 工具命名
│   └── ARCHITECTURE.md           # 数据流（可选补充）
│
├── schemas/
│   └── layout.schema.json        # 看板 layout 校验
│
├── registry/
│   ├── probes.yaml               # 探针定义（核心，可热更新）
│   ├── enums/                    # 从 OEM APK 导出的枚举（可选）
│   │   └── .gitkeep
│   └── README.md                 # probe 字段说明
│
├── layouts/                      # 用户/项目保存的看板布局
│   ├── example-default.json
│   ├── example-network-only.json
│   └── .gitkeep
│
├── policies/                     # 导入的 SOTI 策略 JSON（可选，本地）
│   └── .gitkeep
│
├── config/
│   └── app.defaults.json         # ADB 路径、刷新间隔、窗口尺寸默认值
│
├── src-tauri/                    # Tauri 壳（后续初始化）
│   └── .gitkeep
│
├── src/                          # React 前端（后续初始化）
│   └── .gitkeep
│
└── tools/                        # 离线脚本：APK → enums、校验 layout
    ├── validate_layout.py
    └── .gitkeep
```

## 运行时数据目录（安装后，不在仓库内）

```text
%APPDATA%/Urovo/LivePanel/        # Windows 示例
├── config.app.json               # 用户覆盖配置
├── layouts/                      # 用户自定义布局
└── cache/                        # 最近一次 probe 结果（可选）
```

## 扩展方式

1. **新增配置项**：在 `registry/probes.yaml` 增加一条 → 实现对应 `probe.runner` → UI 自动多一个可选组件。
2. **新 OEM 版本**：更新 `registry/enums/` 或重跑生成脚本，**不必改布局**。
3. **新验收场景**：复制 `layouts/*.json` 改 widget 列表与坐标。
