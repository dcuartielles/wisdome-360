# One-time setup on Windows: desktop icon + OBS profile and scene for the dome.
$setup = $PSScriptRoot
$live = Split-Path $setup -Parent

# the icon runs node.exe directly (minimised window = the server; close it to stop)
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Host "Node.js not found. Install the LTS version from nodejs.org, then run this again." -ForegroundColor Red; exit 1 }
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'Dome Slides.lnk'
$sh = New-Object -ComObject WScript.Shell
$s = $sh.CreateShortcut($lnk)
$s.TargetPath = $node
$s.Arguments = "`"$live\server\server.mjs`" --launch"
$s.WorkingDirectory = $live
$s.IconLocation = "$setup\dome.ico,0"
$s.WindowStyle = 7
$s.Description = 'Wisdome live dome slides'
$s.Save()
Write-Host "Desktop icon created: $lnk"
Write-Host "  -> $node `"$live\server\server.mjs`" --launch"

# OBS: a 2048 x 2048 / 30 fps profile and a scene with the dome page as a Browser Source.
# Only written if they don't exist yet, so your own changes in OBS are never overwritten.
$obsCfg = Join-Path $env:APPDATA 'obs-studio\basic'
if (Test-Path (Split-Path $obsCfg)) {
  $prof = Join-Path $obsCfg 'profiles\Dome_slides'
  if (-not (Test-Path $prof)) {
    New-Item -ItemType Directory -Force -Path $prof | Out-Null
    @"
[General]
Name=Dome slides

[Video]
BaseCX=2048
BaseCY=2048
OutputCX=2048
OutputCY=2048
FPSType=0
FPSCommon=30
"@ | Set-Content -Encoding UTF8 (Join-Path $prof 'basic.ini')
    Write-Host "OBS profile 'Dome slides' created (2048 x 2048, 30 fps)."
  }
  $scenes = Join-Path $obsCfg 'scenes'
  New-Item -ItemType Directory -Force -Path $scenes | Out-Null
  $coll = Join-Path $scenes 'Dome_slides.json'
  if (-not (Test-Path $coll)) {
    Copy-Item (Join-Path $setup 'obs-scene-collection.json') $coll
    Write-Host "OBS scene collection 'Dome slides' created."
  }
  Write-Host ""
  Write-Host "Once in OBS: Tools > DistroAV NDI Settings > tick 'Main Output', name it DOME-SLIDES."
} else {
  Write-Host "OBS not found (no settings folder yet). Install OBS + DistroAV, open it once, then run this again."
}
Write-Host ""
Write-Host "Done. Double-click 'Dome Slides' on your desktop."
