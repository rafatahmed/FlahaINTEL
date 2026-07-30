# Flaha Agri Tech — scheduled market harvest (Jordan daily + MoCI daily + Mahaseel every 3d via cadence)
# Loads .env and invokes npm markets:harvest (no --force: respects harvestIntervalDays).

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $RepoRoot

function Import-EnvFile([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $i = $_.IndexOf('=')
    $k = $_.Substring(0, $i).Trim()
    $v = $_.Substring($i + 1).Trim().Trim('"').Trim("'")
    if ($k) { Set-Item -Path "Env:$k" -Value $v }
  }
}

Import-EnvFile (Join-Path $RepoRoot ".flaha-runtimes\runtime-paths.env")
Import-EnvFile (Join-Path $RepoRoot ".env")

if (-not $env:FLAHA_STATE_DIR) {
  $env:FLAHA_STATE_DIR = Join-Path $RepoRoot ".flaha-state"
}
New-Item -ItemType Directory -Force -Path $env:FLAHA_STATE_DIR | Out-Null
$log = Join-Path $env:FLAHA_STATE_DIR "scheduled-market-harvest.log"
$stamp = Get-Date -Format "o"

try {
  & (Join-Path $RepoRoot "ops\scripts\check-free-space.ps1") -MinFreePercent 5
  # harvest without --force so Jordan/MoCI daily and Mahaseel 3-day cadence apply
  $out = & npm run markets:harvest --workspace=@flaha-intel/api 2>&1 | Out-String
  Add-Content -Path $log -Value "$stamp OK`n$out"
  Write-Host $out
  exit 0
} catch {
  Add-Content -Path $log -Value "$stamp FAIL $($_.Exception.Message)"
  throw
}
