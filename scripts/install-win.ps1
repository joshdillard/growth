# Install the AI UtilityBelt panel into Premiere Pro (Windows).
# Run from the repo root in PowerShell:  .\scripts\install-win.ps1
$ErrorActionPreference = "Stop"

$extId = "com.aiutilitybelt.panel"
$src = Join-Path (Split-Path $PSScriptRoot -Parent) $extId
$dest = Join-Path $env:APPDATA "Adobe\CEP\extensions\$extId"

if (-not (Test-Path $src)) {
    Write-Error "Could not find $src - run this script from inside the repo."
}

New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
Copy-Item -Recurse $src $dest
Write-Host "Copied panel to: $dest"

# Allow unsigned (development) extensions for every recent CEP runtime.
foreach ($v in 9..12) {
    $regPath = "HKCU:\Software\Adobe\CSXS.$v"
    if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
    Set-ItemProperty -Path $regPath -Name "PlayerDebugMode" -Value "1" -Type String
}
Write-Host "Enabled PlayerDebugMode (unsigned extensions allowed)."

Write-Host ""
Write-Host "Done. Restart Premiere Pro, then open:"
Write-Host "  Window > Extensions > AI UtilityBelt - YouTube Editor"
