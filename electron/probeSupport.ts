export type SupportStatus =
  | "ok"
  | "unsupported"
  | "not_allowed"
  | "panel_readonly";

export function classifyDeviceError(message: string): {
  status: SupportStatus;
  userMessage: string;
} {
  if (/need_urovo_sign/i.test(message)) {
    return {
      status: "not_allowed",
      userMessage:
        "写回需 Urovo 签名桥接（device-usdk-bridge/app/urovo.keystore → npm run build:bridge）",
    };
  }
  if (/write_no_effect|写回未生效/i.test(message)) {
    return {
      status: "not_allowed",
      userMessage:
        "写回未生效：请确认设备策略未锁定；USDK 项需 Urovo 签名桥接 APK",
    };
  }
  if (/clipboard_unreadable/i.test(message)) {
    return {
      status: "unsupported",
      userMessage: "本机剪贴板策略不可读（需 Urovo 签名 USDK 桥接）",
    };
  }
  if (/不支持从实况面板写入/i.test(message)) {
    return {
      status: "panel_readonly",
      userMessage: "本项暂不支持从面板修改（仅展示或需 OEMConfig）",
    };
  }
  if (/bridge_no_response|桥接无响应/i.test(message)) {
    return {
      status: "unsupported",
      userMessage:
        "USDK 桥接无响应：请点「刷新设备」安装/升级组件后重试",
    };
  }
  if (
    /SecurityException|permission denied|PERMISSION_DENIED|not allowed|Cannot change|User restriction|disabled by admin|Operation not allowed|WRITE_SETTINGS|has no permission/i.test(
      message,
    )
  ) {
    return {
      status: "not_allowed",
      userMessage: "本设备不允许修改（可能被系统/OEM 策略禁用）",
    };
  }
  if (
    /Unknown command|unknown setting|No such setting|Bad arguments|Invalid subcommand|not found|Can't find service|Error type 3/i.test(
      message,
    )
  ) {
    return {
      status: "unsupported",
      userMessage: "本机型/本固件可能不支持此项",
    };
  }
  return { status: "ok", userMessage: message };
}

/** 读成功但无有效值时的软提示（仍 ok=true） */
export function softReadSupportHint(
  display: string,
  raw: string | null,
): { status: SupportStatus; userMessage: string } | null {
  if (raw != null && raw !== "" && raw !== "null") return null;
  if (display && display !== "—" && display !== "错误") return null;
  return {
    status: "unsupported",
    userMessage: "未读到有效值（可能本机无此功能或入口被禁用）",
  };
}
