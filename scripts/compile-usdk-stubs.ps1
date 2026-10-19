param(
  [string]$BridgeDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "device-usdk-bridge")
)
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) {
  $def = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $def) { $sdk = $def }
}
$androidJar = Join-Path $sdk "platforms\android-34\android.jar"
if (-not (Test-Path $androidJar)) {
  throw "android.jar not found at $androidJar"
}
$srcRoot = Join-Path $BridgeDir "usdk-stubs\src\main\java"
$outDir = Join-Path $BridgeDir "build\usdk-stubs-classes"
$jarPath = Join-Path $BridgeDir "app\libs\usdk-compile-stubs.jar"
New-Item -ItemType Directory -Force -Path (Split-Path $jarPath) | Out-Null
Remove-Item -Recurse -Force $outDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$sources = Get-ChildItem -Path $srcRoot -Filter "*.java" -Recurse | ForEach-Object { $_.FullName }
& javac -encoding UTF-8 -classpath $androidJar -d $outDir @sources
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Push-Location $outDir
try {
  & jar cf $jarPath android
} finally {
  Pop-Location
}
Write-Host "[compile-usdk-stubs] $jarPath"
