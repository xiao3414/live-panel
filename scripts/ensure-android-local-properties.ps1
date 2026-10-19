param([string]$BridgeDir)
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) {
  $def = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $def) { $sdk = $def }
}
if (-not $sdk -or -not (Test-Path $sdk)) {
  throw "Android SDK not found. Set ANDROID_HOME or install Android Studio."
}
$escaped = $sdk -replace '\\', '/'
$props = Join-Path $BridgeDir "local.properties"
[System.IO.File]::WriteAllText($props, "sdk.dir=$escaped`n")
Write-Host "[ensure-android-local-properties] sdk.dir=$escaped"
