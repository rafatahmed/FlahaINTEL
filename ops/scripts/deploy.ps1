# Flaha Agri Tech — Phase 3M explicit deploy (requires operator approval flag)

param(
  [Parameter(Mandatory = $true)][string]$ReleaseId,
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$DeployRoot = $(if ($env:FLAHA_DEPLOY_ROOT) { $env:FLAHA_DEPLOY_ROOT } else { "C:\flahaintel" }),
  [switch]$Approved,
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
if (-not $Approved) {
  Write-Host "Deployment requires explicit approval. Re-run with -Approved after change control."
  exit 3
}

$releaseDir = Join-Path $DeployRoot "releases\$ReleaseId"
$currentLink = Join-Path $DeployRoot "current"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

Write-Host "Building release $ReleaseId..."
Push-Location $RepoRoot
try {
  npm ci
  if (-not $SkipTests) {
    npm test --workspace=@flaha-intel/api
  }
  npm run build
} finally {
  Pop-Location
}

Write-Host "Packaging immutable release tree..."
robocopy $RepoRoot $releaseDir /MIR /E /XD node_modules .git .flaha-artifacts .artifacts .flaha-backups benchmarks\ingestion\results /NFL /NDL /NJH /NJS | Out-Null
Push-Location $releaseDir
try {
  npm ci --omit=dev
  npm run build
} finally {
  Pop-Location
}

if (Test-Path $currentLink) { Remove-Item $currentLink -Force -Recurse -ErrorAction SilentlyContinue }
New-Item -ItemType Junction -Path $currentLink -Target $releaseDir | Out-Null

Write-Host "Release staged at $releaseDir"
Write-Host "Restart services (API + workers) and run smoke tests per runbook."
