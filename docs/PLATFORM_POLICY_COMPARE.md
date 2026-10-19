# OEM 对比 · 平台强制判定

实况面板在 Security 等页将部分探针标为 **平台强制**（不参与 JSON「不符」统计）。误判会导致未接 MDM 的设备仍显示「工作政策」。

## 原则

1. **不得仅凭单个 Settings 值**（如 `package_verifier_user_consent=-1`）判定 MDM 强制。
2. **平台强制**须同时满足：**策略键存在**（如需要）+ **企业 MDM 托管**（见下）。
3. **Guest restrictions** 等模板列表 **不参与** 当前用户 Effective restrictions 解析。

## 企业 MDM 托管（`isEnterpriseMdmManaged`）

满足其一即可：

- `dumpsys device_policy` 含 **SOTI / MobiControl** 组件；或
- `dumpsys user` 中 **`Device managed: true`** 且 **Enabled Device Admins** 非空。

未托管设备（如 DT610：`Device managed: false`、无 Device Admin）**永不**标平台强制。

## 各探针

| 探针 | 平台强制条件 | 读数备注 |
|------|----------------|----------|
| `sec.google_play_protect` | 企业 MDM + SOTI 标签 + `consent=-1` | 未托管时 `-1` = 用户关闭，显示「扫描未开启」，正常参与 JSON 对比 |
| `sec.verify_apps_usb` | 企业 MDM + `ensure_verify_apps` 在 Effective/Global restrictions | |
| `sec.unknown_source` | 不标平台强制；企业 MDM + `no_install_unknown_sources` 生效时读数强制为 `0` | 仍参与 JSON 对比 |
| `sec.camera_access` | 不标平台强制 | USDK 与 `no_camera` 不一致时仅 support 提示 |
| `sec.usb` | 不标平台强制 | 按 `sys.usb.config` 修正 USDK，与 MDM 无关 |

## 自测

```bash
npm run verify:mdm
```

含 DT610 样例 dumpsys 与 Play Protect consent=-1 的回归断言。
