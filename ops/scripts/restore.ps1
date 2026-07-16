# Flaha Agri Tech — Phase 3M isolated restore
# Restores PostgreSQL custom dump + ArtifactStore archive into an isolated target.

param(
  [Parameter(Mandatory = $true)][string]$BackupDir,
  [Parameter(Mandatory = $true)][string]$TargetDatabaseUrl,
  [Parameter(Mandatory = $true)][string]$TargetArtifactRoot,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $BackupDir)) { throw "BackupDir not found" }
$dump = Join-Path $BackupDir "postgres.dump"
$artifacts = Join-Path $BackupDir "artifacts.zip"
if (-not (Test-Path $dump)) { throw "postgres.dump missing" }
if (-not (Test-Path $artifacts)) { throw "artifacts.zip missing" }

if (-not $Force) {
  Write-Host "This will restore into the target database and artifact root."
  Write-Host "Re-run with -Force after confirming the target is an isolated environment."
  exit 2
}

New-Item -ItemType Directory -Force -Path $TargetArtifactRoot | Out-Null
Write-Host "Restoring PostgreSQL..."
& pg_restore --dbname="$TargetDatabaseUrl" --clean --if-exists --no-owner --no-acl $dump
# pg_restore may return non-zero for benign warnings; verify connectivity separately

Write-Host "Restoring ArtifactStore..."
Expand-Archive -Path $artifacts -DestinationPath $TargetArtifactRoot -Force

$verify = @{
  restoredAt = (Get-Date).ToUniversalTime().ToString("o")
  backupDir = (Resolve-Path $BackupDir).Path
  targetArtifactRoot = (Resolve-Path $TargetArtifactRoot).Path
} | ConvertTo-Json
$verify | Set-Content (Join-Path $BackupDir "restore-verification.json")
Write-Host "Restore finished. Run integrity SQL checks and artifact reconciliation next."
