# 内置设备组件（USDK 桥接 APK）

`device-usdk-bridge.apk` 会随 LivePanel 分发；连接设备后 **自动 adb install**，使用者无需手动安装。

维护者更新桥接时：

1. 在 `device-usdk-bridge/app/libs/` 放置 `com.ubx.usdk.jar`（或设置 `UROVO_USDK_JAR`）
2. Android Studio / Gradle：`assembleDebug`
3. 运行 `npm run copy:bridge`
4. 再 `npm run electron:build` 打 portable
