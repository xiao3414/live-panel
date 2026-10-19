# 实况面板 — 模块化开发规范（OEM 2.0 对齐）

> OEM JSON 对比与 **平台强制** 判定见 [PLATFORM_POLICY_COMPARE.md](./PLATFORM_POLICY_COMPARE.md)。

> **目标**：按 OEMConfig **2.0 八大 L1** 分模块交付；同一套工程可服务 OEM 大项目，也可单独定制「面板包」给同事/客户。

## 1. 三层对齐（强制）

| 层 | OEM 来源 | 实况面板产物 |
|----|----------|--------------|
| **L1** | `Urovo OEMConfig 2.0框架.xlsx` / Overview | `registry/modules/<l1-slug>.yaml` + `layouts/oem20-<slug>.json` |
| **L2/L3** | 各域 md（如 Network Configuration.md） | `registry/manifest/<l1>.yaml` 覆盖清单 |
| **配置项** | 框架表「配置项」列 | `probes[].item` + `module` 列（与 master_2.0 一致） |

命名与 slash 路径见：`01_项目说明/OEMConfig_2.0_模块层级与命名规范.md`。

## 2. 目录约定（可扩展）

```text
registry/
  index.yaml              # 入口，includes 各 L1 模块
  modules/
    network.yaml          # L1 探针实现
    _other_l1.yaml        # 过渡：未拆完的探针
  manifest/
    network.yaml          # 框架 111 条 vs 已实现 probe 对照
layouts/
  oem20-network-configuration.json
docs/
  DEVELOPMENT_PROCESS.md  # 阶段流程
  MODULE_DEVELOPMENT_SPEC.md  # 本文件
```

**新增 L1 模块（同事复用）**

1. 复制 `modules/network.yaml` 结构 → `modules/system.yaml`
2. 增加 `manifest/system.yaml`（条数见对应 md）
3. `index.yaml` 的 `includes` 增加一行
4. 新增布局 `layouts/oem20-system-configuration.json`
5. 在《开发流程记录》登记阶段与 Owner

## 3. 探针（probe）规范

| 字段 | 说明 |
|------|------|
| `id` | 全局唯一，`域.项`，如 `wifi.state` |
| `l1` | 固定八大域英文名，如 `Network Configuration` |
| `module` | 与 master_2.0 **模块**列一致 |
| `item` | 与框架 **配置项** 名一致 |
| `display.type` | toggle / text / enum / static / group |
| `probe` | 读：adb.settings / adb.shell / usdk+fallback |
| `write` | 写：可选；OEM 机型需验证（如 WiFi 用 `cmd wifi` 而非 `wifi_on`） |
| `readAfterWrite` | 写后快读，避免 dumpsys |
| `risk` | safe / warn / block |
| `enabled: false` | 未验收前勿出现在布局 |

**读准优先**：若 `settings get` 与设置 UI 不一致，以 **cmd / dumpsys** 为准并写入 manifest 备注。

## 4. 布局（layout）规范

- 每 L1 至少一个**正式开发**默认布局：`oem20-<domain>-configuration.json`（只放当前子模块/表单，不放演示组合块）
- **子布局**按 L2 拆分：如 `oem20-network-wireless-general.json`（飞行模式 / 蓝牙 / NFC / GPS）
- **框架目录**布局：`oem20-network-framework.json`（111 项占位，不含可写实况块）
- 可选字段 `oemModule`：与 L1 同名，便于 UI 筛选
- Widget 只绑定 **已 enabled** 的 probe；未进默认布局的探针仍可在「模块库」手动添加
- 演示用 `group.*` 探针验收后应 `enabled: false`，避免与新布局重复

**Network Configuration 当前约定**

| 布局 ID | 用途 |
|---------|------|
| `oem20-network-configuration` | 分区条 WLAN + 四表单 + DNS/Ethernet |
| `oem20-network-wlan` | 仅 WLAN 中间层四表单 |
| `oem20-network-wireless-general` | Wireless General（四开关） |
| `oem20-network-framework` | 框架 111 项对照 |
| `oem20-overview` | 八大 L1 概览（catalog） |

用户曾保存过的排布在 `%APPDATA%/layout-overrides/`；要看新出厂 JSON 需点 **恢复出厂布局** 或 **还原默认排布**。

## 5. OEM 三级导航（与托管配置一致）

| 级 | UI | 配置 |
|----|-----|------|
| L1 | 顶栏 **OEM 模块** 下拉 | `src/navigation/oemNavTree.ts` → `OEM_L1_MODULES`（八大域） |
| L2 | 模块内列表（带 ›） | 各 L1 的 `children[]` |
| L3 | 实况网格 | `children[].layoutId` → `layouts/*.json` |

面包屑 **OEM 2.0 › L1 › L2 › L4** 可点击上级返回；布局下拉不再暴露全部 JSON 文件名。

**可组合 L2**（如 WLAN）：`panelLayoutId` 默认空面板；L4 目录点行进入 **单项页**，点「+ 面板」或 **预设** 合并到同一网格；**模块库** 可跨模块追加。固定 L2（framework）仍用 `layoutId` 写死 catalog。

## 5. 交付物检查清单（每模块）

- [ ] manifest 中 `frameworkItems` 与 kb md 条数一致
- [ ] 已实现 probe 在 DT630（或项目机）读过真机
- [ ] 可写 toggle 在 manifest 标注 `writeVerified: true`
- [ ] 布局加载无 orphan probeId
- [ ] 《开发流程记录》更新阶段状态

## 6. 与 OEM 项目 / 独立面板的关系

| 场景 | 做法 |
|------|------|
| 跟 OEM 2.0 测试 | manifest 对齐框架 + master_2.0 |
| 只交付面板 | 导出 `registry/modules/*.yaml` + layouts + 品牌 config |
| 多客户 | `config/app.<customer>.json` + 可选精简 includes |
