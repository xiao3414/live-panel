@echo off
chcp 65001 >nul
title 实况面板 — 开发模式
cd /d "%~dp0"

if defined ANDROID_HOME set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"
if defined ANDROID_SDK_ROOT set "PATH=%ANDROID_SDK_ROOT%\platform-tools;%PATH%"
if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" set "PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools;%PATH%"

where npm >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 npm，请先安装 Node.js 并加入 PATH。
  pause
  exit /b 1
)

if not exist "node_modules\electron\path.txt" (
  echo [提示] Electron 未安装完整，正在修复…
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\fix-electron.ps1"
  if errorlevel 1 (
    echo [错误] Electron 修复失败。
    pause
    exit /b 1
  )
)

if not exist "dist-electron\main.js" (
  echo [提示] 首次编译主进程…
  call ".\node_modules\.bin\tsc" -p tsconfig.electron.json
)
if not exist "resources\device-usdk-bridge.apk" (
  if not exist "device-usdk-bridge\app\build\outputs\apk\debug\app-debug.apk" (
    echo [提示] 正在编译设备 USDK 组件 APK（仅首次，需 JDK+Android SDK）…
    call npm run build:bridge
  ) else (
    call npm run copy:bridge
  )
)
call npm run copy:preload

echo [启动] 实况面板（关闭本窗口即退出）
call npm run electron:dev
if errorlevel 1 (
  echo.
  echo [退出] 异常结束，见上方日志。
  pause
)
