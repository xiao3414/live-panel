# probes.yaml 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✓ | 全局唯一，建议 `域.项`，如 `wifi.state` |
| `module` | ✓ | 与 master_2.0 模块列一致 |
| `item` | ✓ | SOTI 显示名 |
| `display` | ✓ | UI 类型：`toggle` / `text` / `enum` / `diff` / `group` / `risk` |
| `labels` | | 枚举或开关文案 |
| `probe` | ✓ | `kind` + 参数（adb / usdk / shell） |
| `refreshMs` | | 单独刷新间隔，默认继承全局 |
| `sotiKey` | | 与 Managed Config key 对齐，供 Diff |
| `risk` | | `safe` / `warn` / `block`（NA、勿推） |
| `verifyPath` | | 设备上人工核对路径提示 |
| `enabled` | | 默认 `true`；false 则不在组件库展示 |

## probe.kind

| kind | 说明 |
|------|------|
| `adb.settings` | `settings get global/secure/system <key>` |
| `adb.shell` | 自定义 shell，用 `{cmd}` |
| `adb.dumpsys` | 解析 dumpsys 片段（runner 内实现） |
| `usdk` | 调用 USDK get API（二期） |
| `static` | 仅占位 / 说明卡 |
