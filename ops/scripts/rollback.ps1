# Flaha Agri Tech — Phase 3M rollback to a previous immutable release

param(
  [Parameter(Mandatory = $true)][string]$ReleaseId,
  [string]$DeployRoot = $(if ($env:FLAHA_DEPLOY_ROOT) { $env:FLAHA_DEPLOY_ROOT } else { "C:\flahaintel" }),
  [switch]$Approved
)

$ErrorActionPreference = "Stop"
if (-not $Approved) {
  Write-Host "Rollback requires explicit approval. Re-run with -Approved."
  exit 3
}

$releaseDir = Join-Path $DeployRoot "releases\$ReleaseId"
$currentLink = Join-Path $DeployRoot "current"
if (-not (Test-Path $releaseDir)) { throw "Release not found: $releaseDir" }

if (Test-Path $currentLink) { Remove-Item $currentLink -Force -Recurse -ErrorAction SilentlyContinue }
New-Item -ItemType Junction -Path $currentLink -Target $releaseDir | Out-Null
Write-Host "Rolled back current -> $releaseDir"
Write-Host "Restart API and workers; do not auto-run forward migrations on rollback."
