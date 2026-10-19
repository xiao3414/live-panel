# 实况面板 — 开发流程（按阶段执行）

> 流程状态同步写在：`00_管理/实况面板_开发流程记录.md`  
> 规范细节：`docs/MODULE_DEVELOPMENT_SPEC.md`

## 总览

```mermaid
flowchart LR
  A[0 框架对齐] --> B[1 Manifest]
  B --> C[2 Registry 探针]
  C --> D[3 Layout 看板]
  D --> E[4 真机验收]
  E --> F[5 文档与发布]
  F --> G[下一 L1 模块]
```

---

## 阶段 0 — 框架对齐

**输入**：`Urovo OEMConfig 2.0框架.xlsx`（桌面原件）或 KB `03_…/OEMConfig_2.0_产品框架/*.md`

**输出**：

- 确认 L1 范围与条数（Network = 111）
- KB md 与 xlsx 不一致时，以 **xlsx + 产品变更说明** 为准，更新 md 脚本见 `D:\index\extract_oem20_framework.py`

**完成标准**：manifest 中 `frameworkSource` 已填写。

---

## 阶段 1 — Manifest（覆盖清单）

**动作**：

1. 新建/更新 `registry/manifest/<l1>.yaml`
2. 按 L2 分桶列出 `probeIds` 与 `status: partial|planned|done`

**当前模块**：Network → `registry/manifest/network.yaml`（14/111 live）

---

## 阶段 2 — Registry 探针

**动作**（每条配置项）：

1. 查对齐表 / 真机路径定 `probe` 读法
2. 写入 `registry/modules/<l1>.yaml`
3. 需写回时补 `write` + `readAfterWrite`
4. `risk: warn|block` 在 manifest 注明

**工具**：

- 从旧表拆分：`python tools/split_registry_modules.py`
- 校验布局：`python tools/validate_layout.py`

---

## 阶段 3 — Layout 看板

**动作**：

1. `layouts/oem20-<l1-slug>.json`
2. 设置 `oemModule` 与默认刷新策略
3. UI 布局下拉可选

**当前**：`oem20-network-configuration.json`

---

## 阶段 4 — 真机验收

**动作**：

1. DT630 USB 调试
2. 读：与 `verifyPath` 人工核对
3. 写：开关项点开/关后核对设置
4. 问题写入 manifest `notes` 或 Bug 经验库

---

## 阶段 5 — 文档与发布

**动作**：

1. 更新 `01_项目说明/实况面板_项目知识.md`
2. 更新 `00_管理/版本变更记录.md`
3. 成品后再 push GitHub（见 `docs/GITHUB_SETUP.md`）

---

## 当前迭代计划（Network Configuration）

| 批次 | 内容 | 状态 |
|------|------|------|
| N-0 | 模块化 registry + manifest + 专用布局 | **进行中** |
| N-1 | WiFi 余项（Hidden SSID、Proxy 等） | 待开始 |
| N-2 | SIM1/SIM2 核心开关 | 待开始 |
| N-3 | Hotspot / Ethernet 实读 | 待开始 |

**下一 L1**：System Configuration（待 Network N-1 评审后开阶段 0）。
