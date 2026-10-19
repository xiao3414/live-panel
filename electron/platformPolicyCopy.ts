/** 块内说明文案，对齐设备设置 / 工作政策提示用语 */

export function usbVerifyPlatformMessage(mdmLabel: string): string {
  return `「通过 USB 验证应用」已被工作政策启用（${mdmLabel}），无法在设备端关闭。与 OEM 配置文件推送无关。`;
}

export function playProtectPlatformMessage(mdmLabel: string): string {
  return `Play 保护机制由工作政策管控。设置内提示：工作政策要求启用应用扫描，请联系 IT 管理员（${mdmLabel}）。`;
}

export function unknownSourcesPerAppDetail(allowedCount: number): string {
  return `设置 › 安装未知应用：${allowedCount} 个应用为「已允许」。`;
}
