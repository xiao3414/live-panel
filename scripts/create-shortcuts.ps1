# Create Live Panel shortcuts on Desktop and KB root (ASCII-only script)
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$launcher = Join-Path $projectRoot "start-livepanel.bat"
$icon = Join-Path $projectRoot "node_modules\electron\dist\electron.exe"

if (-not (Test-Path $launcher)) {
  Write-Error "Launcher not found: $launcher"
}

$shell = New-Object -ComObject WScript.Shell

function New-Shortcut($linkPath, $displayName) {
  $dir = Split-Path $linkPath -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $sc = $shell.CreateShortcut($linkPath)
  $sc.TargetPath = $launcher
  $sc.WorkingDirectory = $projectRoot
  $sc.WindowStyle = 1
  $sc.Description = "Live Panel / OEM device dashboard"
  if (Test-Path $icon) { $sc.IconLocation = "$icon,0" }
  $sc.Save()
  Write-Host "Created: $displayName -> $linkPath"
}

$desktop = [Environment]::GetFolderPath("Desktop")
New-Shortcut (Join-Path $desktop "LivePanel.lnk") "Desktop"

$kbRoot = (Resolve-Path (Join-Path $projectRoot "..\..")).Path
if (Test-Path -LiteralPath $kbRoot) {
  New-Shortcut (Join-Path $kbRoot "LivePanel.lnk") "Knowledge base root"
}

Write-Host "Done. Double-click LivePanel.lnk to start."
