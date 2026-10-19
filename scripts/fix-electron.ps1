# 修复「Electron failed to install correctly」（path.txt 缺失 / 安装被中断）
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "关闭可能占用 node_modules 的 node 进程（如有）..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$electronDir = Join-Path (Get-Location) "node_modules\electron"
if (Test-Path $electronDir) {
  Write-Host "删除 $electronDir ..."
  Remove-Item -Recurse -Force $electronDir
}

Write-Host "重新安装 electron（使用 .npmrc 镜像）..."
npm install electron@33.4.11 --save-dev --no-fund --no-audit

$pathTxt = Join-Path $electronDir "path.txt"
if (-not (Test-Path $pathTxt)) {
  Write-Error "electron 仍未安装完整，请关闭杀毒/同步盘对 node_modules 的占用后重试，或删除整个 node_modules 再 npm install"
}
Write-Host "OK: electron 已就绪。运行: npm run electron:dev"
