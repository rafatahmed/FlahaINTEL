# Flaha Agri Tech — non-interactive backup entry for Task Scheduler
# Loads path env and DATABASE_URL then invokes backup.ps1. Logs to FLAHA_STATE_DIR.

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
$log = Join-Path $env:FLAHA_STATE_DIR "scheduled-backup.log"
$stamp = Get-Date -Format "o"

try {
  & (Join-Path $RepoRoot "ops\scripts\check-free-space.ps1") -MinFreePercent 10
  if ($LASTEXITCODE -ne 0) { throw "Free space check failed before backup" }

  & (Join-Path $RepoRoot "ops\scripts\backup.ps1")
  if ($LASTEXITCODE -ne 0) { throw "backup.ps1 failed" }

  Add-Content -Path $log -Value "$stamp OK backup"
  # Off-host: operator configures robocopy/rsync separately; marker already in last-backup.json
  exit 0
} catch {
  Add-Content -Path $log -Value "$stamp FAIL $($_.Exception.Message)"
  throw
}
