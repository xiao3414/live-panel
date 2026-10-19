# 编译 device-usdk-bridge 并复制到 resources/（无需手工 adb install）
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$candidates = @(
  "D:\java\jdk-17", "D:\java\jdk-21",
  "C:\Program Files\Java\jdk-17"
)
$resolved = $null
foreach ($jdk in $candidates) {
  if (Test-Path (Join-Path $jdk "bin\java.exe")) {
    $resolved = $jdk
    break
  }
}
if (-not $resolved) {
  $javaCmd = Get-Command java -ErrorAction SilentlyContinue
  if ($javaCmd -and $javaCmd.Source -match '^(.*)\\bin\\java\.exe$') {
    $resolved = $Matches[1]
  }
}
if ($resolved) {
  $env:JAVA_HOME = $resolved
  $pathSansJava = ($env:Path -split ';' | Where-Object { $_ -and $_ -notmatch '\\java\\' }) -join ';'
  $env:Path = "$resolved\bin;$pathSansJava"
  Write-Host "[build-device-bridge] JAVA_HOME=$resolved"
} else {
  Write-Error "未找到 JDK 17/21，请安装 JDK 17 或设置 JAVA_HOME"
}
$bridge = Join-Path $root "device-usdk-bridge"
$gradlew = Join-Path $bridge "gradlew.bat"
$autotestGradlew = Join-Path $root "..\..\USDK\newest_usdk_auto\newest_usdk_auto\gradlew.bat"

if (-not (Test-Path $gradlew)) {
  if (Test-Path $autotestGradlew) {
    Copy-Item (Join-Path (Split-Path $autotestGradlew) "gradlew.bat") $gradlew
    Copy-Item (Join-Path (Split-Path $autotestGradlew) "gradlew") (Join-Path $bridge "gradlew") -ErrorAction SilentlyContinue
    Copy-Item (Join-Path (Split-Path $autotestGradlew) "gradle") (Join-Path $bridge "gradle") -Recurse -Force
    Write-Host "[build-device-bridge] copied Gradle wrapper from SDKAuto"
  } else {
    Write-Error "未找到 gradlew，请用 Android Studio 打开 device-usdk-bridge 并 Sync，或从 SDKAuto 工程复制 wrapper"
  }
}

& (Join-Path $PSScriptRoot "ensure-android-local-properties.ps1") -BridgeDir $bridge
& (Join-Path $PSScriptRoot "compile-usdk-stubs.ps1") -BridgeDir $bridge

$usdkSrc = Join-Path $root "..\..\USDK\newest_usdk_auto\newest_usdk_auto\app\libs\DeviceManagerNew_v16.3.11_260917.jar"
$usdkDst = Join-Path $bridge "app\libs\DeviceManagerNew.jar"
if (Test-Path $usdkSrc) {
  Copy-Item $usdkSrc $usdkDst -Force
  Write-Host "[build-device-bridge] USDK jar -> $usdkDst"
} elseif (-not (Test-Path $usdkDst)) {
  Write-Error "缺少 DeviceManagerNew.jar：请从 SDKAuto app/libs 复制到 device-usdk-bridge/app/libs/"
}

$ksDst = Join-Path $bridge "app\urovo.keystore"
if (-not (Test-Path $ksDst)) {
  $ksCandidates = @(
    "D:\su_workspace\keystore\urovo.keystore",
    (Join-Path $root "..\..\USDK\newest_usdk_auto\newest_usdk_auto\app\urovo.keystore")
  )
  foreach ($ks in $ksCandidates) {
    if (Test-Path $ks) {
      Copy-Item $ks $ksDst -Force
      Write-Host "[build-device-bridge] urovo.keystore -> $ksDst (same sign as SDKAuto)"
      break
    }
  }
}
if (-not (Test-Path $ksDst)) {
  Write-Host "[build-device-bridge] no urovo.keystore: copy to app/urovo.keystore for USDK write"
}

Push-Location $bridge
try {
  cmd /c "`"$gradlew`" --stop >nul 2>&1"
  & $gradlew clean assembleDebug --no-parallel
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

node (Join-Path $PSScriptRoot "copy-bridge-apk.cjs")
