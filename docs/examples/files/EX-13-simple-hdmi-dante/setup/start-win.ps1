# Dome slides: start on Windows.  Right-click -> Run with PowerShell (or: powershell -ExecutionPolicy Bypass -File setup\start-win.ps1)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$live = Split-Path -Parent $here
Start-Process -FilePath "node" -ArgumentList "`"$live\server\server.mjs`"" -WorkingDirectory $live
Start-Sleep -Seconds 1
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LocalAppData\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) {
  Start-Process $chrome "--new-window --autoplay-policy=no-user-gesture-required http://localhost:8360/audio/"
  Start-Process $chrome "--new-window http://localhost:8360/launch/"
} else { Start-Process "http://localhost:8360/launch/" }
Write-Host "OBS: add a Browser Source  http://localhost:8360/video/  width 2048, height 2048, FPS 30 (custom)."
