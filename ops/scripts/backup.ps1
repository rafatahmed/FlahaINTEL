# Flaha Agri Tech — Phase 3M coordinated backup
# RPO target: 24h. Creates PostgreSQL dump + ArtifactStore archive + config snapshot.

param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$ArtifactRoot = $(if ($env:ARTIFACT_STORE_ROOT) { $env:ARTIFACT_STORE_ROOT } else { $env:FLAHA_ARTIFACT_ROOT }),
  [string]$BackupRoot = $(if ($env:FLAHA_BACKUP_ROOT) { $env:FLAHA_BACKUP_ROOT } else { ".\.flaha-backups" }),
  [string]$StateDir = $(if ($env:FLAHA_STATE_DIR) { $env:FLAHA_STATE_DIR } else { ".\.flaha-state" }),
  [string]$ConfigPath = $env:FLAHA_ENV_FILE
)

$ErrorActionPreference = "Stop"
if (-not $DatabaseUrl) { throw "DATABASE_URL is required" }
if (-not $ArtifactRoot) { throw "ARTIFACT_STORE_ROOT is required" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $BackupRoot $stamp
New-Item -ItemType Directory -Force -Path $dest | Out-Null
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

Write-Host "Backing up PostgreSQL..."
# Prefer FLAHA_PG_BIN when multiple PostgreSQL major versions are installed (client must match server).
$pgBin = if ($env:FLAHA_PG_BIN) { $env:FLAHA_PG_BIN } else { "" }
$pgDump = if ($pgBin) { Join-Path $pgBin "pg_dump.exe" } else { (Get-Command pg_dump -ErrorAction SilentlyContinue)?.Source }
if (-not $pgDump -or -not (Test-Path $pgDump)) { throw "pg_dump not found (set FLAHA_PG_BIN to the server-matching bin directory)" }
& $pgDump --dbname="$DatabaseUrl" --format=custom --file=(Join-Path $dest "postgres.dump")
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (check client/server major version match)" }

Write-Host "Backing up ArtifactStore..."
$artifactArchive = Join-Path $dest "artifacts.zip"
if (Test-Path $ArtifactRoot) {
  Compress-Archive -Path (Join-Path $ArtifactRoot "*") -DestinationPath $artifactArchive -Force
} else {
  throw "Artifact root missing: $ArtifactRoot"
}

if ($ConfigPath -and (Test-Path $ConfigPath)) {
  Copy-Item $ConfigPath (Join-Path $dest "production.env.redacted")
  # Strip secrets from copy for on-host audit copy (full encrypted secret backup is operator-managed)
  (Get-Content (Join-Path $dest "production.env.redacted")) `
    -replace '(?i)(SECRET|PASSWORD|DATABASE_URL)=.*', '$1=[REDACTED]' |
    Set-Content (Join-Path $dest "production.env.redacted")
}

$marker = @{
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  destination = (Resolve-Path $dest).Path
  rpoHours = 24
  rtoHours = 4
  components = @("postgres", "artifacts", "config-marker")
} | ConvertTo-Json
$marker | Set-Content (Join-Path $dest "manifest.json")
$marker | Set-Content (Join-Path $StateDir "last-backup.json")

Write-Host "Backup complete: $dest"
Write-Host "Copy $dest off-host before relying on RPO."
