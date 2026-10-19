/** 配置块标题（中文主标题，与 registry probe id 对齐） */
export const PROBE_TITLE_ZH: Record<string, string> = {
  "sec.allow_factory_reset": "允许恢复出厂",
  "sec.google_play_protect": "Google Play 保护",
  "sec.screen_lock": "屏幕锁定",
  "sec.screen_lock_set": "锁屏方式",
  "sec.screen_lock_password": "锁屏密码",
  "sec.screen_lock_timeout": "锁屏超时",
  "sec.unknown_source": "未知来源应用",
  "sec.verify_apps_usb": "USB 安装验证",
  "sec.scan_key_pass": "扫描键码传递",
  "sec.disallow_screenshot": "禁止截屏",
  "sec.screen_pinning": "屏幕固定",
  "sec.volume_key": "音量键",
  "sec.camera_access": "相机访问",
  "sec.microphone_access": "麦克风访问",
  "sec.clipboard_access": "允许复制粘贴",
  "sec.show_passwords": "显示密码",
  "sec.location_access": "位置访问",
  "sec.external_sd": "外置 SD 卡",
  "sec.usb": "USB 开关",
  "sec.usb_mode": "USB 模式",
  "sec.adb": "USB 调试 (ADB)",
};

export function probeBlockTitle(
  probeId: string,
  fallbackItem?: string,
  layoutTitle?: string,
): { main: string; sub?: string } {
  const zh = PROBE_TITLE_ZH[probeId];
  const en = layoutTitle ?? fallbackItem;
  if (zh) {
    const sub =
      en && en !== zh && !/^sec\./.test(en) ? en : undefined;
    return { main: zh, sub };
  }
  return { main: fallbackItem ?? layoutTitle ?? probeId };
}
