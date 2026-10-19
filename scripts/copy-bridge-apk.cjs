/**
 * 将 device-usdk-bridge 编译产物复制到 resources/，供 Electron 打包与自动 adb install。
 * 需先在 device-usdk-bridge 中 assembleDebug（且 app/libs 有 com.ubx.usdk.jar）。
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = path.join(
  root,
  "device-usdk-bridge",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);
const destDir = path.join(root, "resources");
const dest = path.join(destDir, "device-usdk-bridge.apk");

if (!fs.existsSync(src)) {
  console.warn(
    "[copy-bridge-apk] 未找到 debug APK，跳过：",
    src,
    "\n  → 在 device-usdk-bridge 用 Android Studio / gradlew assembleDebug 后再运行本脚本。",
  );
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("[copy-bridge-apk] copied ->", dest);
