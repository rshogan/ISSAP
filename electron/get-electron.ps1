<#
.SYNOPSIS
  Downloads a prebuilt Electron runtime into electron/runtime/ so the desktop
  app can be launched without Node.js or npm installed.

.DESCRIPTION
  This is the no-toolchain path: it fetches the official prebuilt zip from the
  electron/electron GitHub releases, verifies it against that release's
  SHASUMS256.txt, and extracts it next to this script. If you do have Node
  installed, `npm install` in this folder does the same job and you can skip
  this entirely.

.PARAMETER Version
  Electron version to fetch, e.g. "32.1.2". Defaults to the latest release.

.PARAMETER Force
  Re-download and replace an existing runtime/ folder.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File electron\get-electron.ps1
#>
[CmdletBinding()]
param(
  [string]$Version,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$runtimeDir = Join-Path $PSScriptRoot "runtime"
$exePath = Join-Path $runtimeDir "electron.exe"

if ((Test-Path $exePath) -and -not $Force) {
  Write-Host "Electron runtime already present: $exePath"
  Write-Host "Re-run with -Force to replace it."
  exit 0
}

# Windows on ARM ships an arm64 build; everything else here is x64.
$arch = switch ($env:PROCESSOR_ARCHITECTURE) {
  "ARM64" { "arm64" }
  default { "x64" }
}

if (-not $Version) {
  Write-Host "Looking up the latest Electron release..."
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/electron/electron/releases/latest" `
    -Headers @{ "User-Agent" = "issap-cyber-redemption" } -UseBasicParsing
  $Version = $release.tag_name.TrimStart("v")
}

$tag = "v$Version"
$zipName = "electron-$tag-win32-$arch.zip"
$base = "https://github.com/electron/electron/releases/download/$tag"
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "issap-electron"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$zipPath = Join-Path $tempDir $zipName
$sumsPath = Join-Path $tempDir "SHASUMS256-$Version.txt"

Write-Host "Downloading Electron $Version ($arch) -- this is roughly 110 MB."
Invoke-WebRequest -Uri "$base/$zipName" -OutFile $zipPath -UseBasicParsing
Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -OutFile $sumsPath -UseBasicParsing

# The release publishes hashes for every asset; check ours before unpacking it.
$expected = (Select-String -Path $sumsPath -Pattern ([regex]::Escape($zipName)) |
  Select-Object -First 1).Line -split '\s+' | Select-Object -First 1
$actual = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash
if (-not $expected) { throw "No SHA256 published for $zipName in $tag." }
if ($actual -ne $expected.ToUpper()) {
  throw "Checksum mismatch for $zipName. Expected $expected, got $actual."
}
Write-Host "Checksum verified."

if (Test-Path $runtimeDir) { Remove-Item -Recurse -Force $runtimeDir }
Write-Host "Extracting to $runtimeDir ..."
Expand-Archive -Path $zipPath -DestinationPath $runtimeDir -Force
Remove-Item -Force $zipPath, $sumsPath

if (-not (Test-Path $exePath)) { throw "Extraction finished but $exePath is missing." }
Write-Host ""
Write-Host "Electron $Version is ready. Launch the app with run-desktop.bat."
