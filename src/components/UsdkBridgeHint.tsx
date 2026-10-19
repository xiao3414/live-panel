type Props = {
  compact?: boolean;
  context?: string;
};

/** 未装 USDK 桥接时的单行提示（避免大块红条占满卡片） */
export function UsdkBridgeHint({ compact, context }: Props) {
  const msg = context
    ? `${context}：INI/USDK 项需安装 device-usdk-bridge`
    : "部分字段需 USDK 桥接 APK（Scanning 等仍可用 ADB）";
  return (
    <p
      className={`probe-card__support probe-card__support--info ${compact ? "probe-card__support--inline" : ""}`}
      title="见 docs/WIFI_ADVANCED_USDK.md、docs/NETWORK_WLAN_OEM_ALIGNMENT.md"
    >
      {msg}
    </p>
  );
}
