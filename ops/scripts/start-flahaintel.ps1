# Flaha Agri Tech
# Precision Agriculture Division
# Copyright (c) 2026-2027 Flaha Agri Tech. All rights reserved.
#
# Title: Start FlahaINTEL (Windows)
# Introduction:
# Starts local FlahaINTEL API and/or web UI in separate console windows.
# Default is development (tsx watch API + Vite). Use -Mode Prod for built dist.
#
# Created by: Rafat Al Khashan
# Created date: 2026-07-31
# Last modified: 2026-07-31

param(
  [ValidateSet("Dev", "Prod")]
  [string]$Mode = "Dev",

  [switch]$ApiOnly,
  [switch]$WebOnly,
  [switch]$Stop,
  [switch]$NoBrowser,
  [switch]$SkipHealthWait,

  [int]$HealthTimeoutSec = 45
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $RepoRoot

function Import-EnvFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $i = $_.IndexOf('=')
    if ($i -lt 1) { return }
    $k = $_.Substring(0, $i).Trim()
    $v = $_.Substring($i + 1).Trim().Trim('"').Trim("'")
    if ($k) { Set-Item -Path "Env:$k" -Value $v }
  }
}

function Get-ListeningPids {
  param([int]$Port)
  $found = New-Object System.Collections.Generic.List[int]
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      if ($c.OwningProcess -and $c.OwningProcess -gt 0) {
        $found.Add([int]$c.OwningProcess) | Out-Null
      }
    }
  } catch {
    $lines = netstat -ano | Select-String ":$Port\s+.*LISTENING"
    foreach ($line in $lines) {
      $parts = ($line.ToString() -split '\s+') | Where-Object { $_ }
      if ($parts.Count -ge 5) {
        $processId = 0
        if ([int]::TryParse($parts[-1], [ref]$processId) -and $processId -gt 0) {
          $found.Add($processId) | Out-Null
        }
      }
    }
  }
  return @($found | Select-Object -Unique)
}

function Stop-PortListeners {
  param(
    [int]$Port,
    [string]$Label
  )
  $processIds = Get-ListeningPids -Port $Port
  if (-not $processIds -or $processIds.Count -eq 0) {
    Write-Host "[stop] $Label port $Port - nothing listening"
    return
  }
  foreach ($processId in $processIds) {
    try {
      $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
      $name = if ($proc) { $proc.ProcessName } else { "?" }
      Write-Host "[stop] $Label port $Port - stopping PID $processId ($name)"
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
      Write-Warning "Could not stop PID ${processId}: $($_.Exception.Message)"
    }
  }
}

function Wait-ApiHealth {
  param(
    [string]$BaseUrl,
    [int]$TimeoutSec
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $url = "$BaseUrl/health"
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-RestMethod -Uri $url -Method GET -TimeoutSec 3
      if ($r.status -eq "ok") {
        Write-Host "[ok] API health: $url"
        return $true
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  Write-Warning "API health not ready within ${TimeoutSec}s ($url). Check the API console window."
  return $false
}

function Start-AppWindow {
  param(
    [string]$Title,
    [string]$WorkingDirectory,
    [string]$NpmArgs
  )
  # Escape single quotes for the nested script
  $safeTitle = $Title.Replace("'", "''")
  $safeDir = $WorkingDirectory.Replace("'", "''")
  $safeArgs = $NpmArgs.Replace("'", "''")

  $inner = @"
`$Host.UI.RawUI.WindowTitle = '$safeTitle'
Set-Location -LiteralPath '$safeDir'
Write-Host '=== $safeTitle ===' -ForegroundColor Cyan
Write-Host 'Repo: $safeDir'
Write-Host 'Command: npm $safeArgs'
Write-Host 'Close this window to stop this process.' -ForegroundColor DarkGray
Write-Host ''
npm $safeArgs
Write-Host ''
Write-Host 'Process exited. Press Enter to close.' -ForegroundColor Yellow
Read-Host | Out-Null
"@
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($inner))
  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-EncodedCommand", $encoded
  ) | Out-Null
}

# Load env for ports / paths
Import-EnvFile -Path (Join-Path $RepoRoot ".flaha-runtimes\runtime-paths.env")
Import-EnvFile -Path (Join-Path $RepoRoot ".env")

$apiPort = 3003
if ($env:API_PORT -and $env:API_PORT -match '^\d+$') { $apiPort = [int]$env:API_PORT }
elseif ($env:PORT -and $env:PORT -match '^\d+$') { $apiPort = [int]$env:PORT }

$webPort = 5174
if ($env:WEB_PORT -and $env:WEB_PORT -match '^\d+$') { $webPort = [int]$env:WEB_PORT }

$apiBase = "http://127.0.0.1:$apiPort"
if ($env:WEB_ORIGIN) {
  $webUrl = $env:WEB_ORIGIN.Trim('"').Trim("'")
} else {
  $webUrl = "http://localhost:$webPort"
}

$runApi = -not $WebOnly.IsPresent
$runWeb = -not $ApiOnly.IsPresent
if ($ApiOnly -and $WebOnly) {
  throw "Use only one of -ApiOnly or -WebOnly."
}

# Stop mode
if ($Stop) {
  Write-Host "Stopping FlahaINTEL listeners..."
  if ($runApi) { Stop-PortListeners -Port $apiPort -Label "API" }
  if ($runWeb) { Stop-PortListeners -Port $webPort -Label "Web" }
  Write-Host "Done."
  exit 0
}

# Preflight
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot "package.json"))) {
  throw "Not a FlahaINTEL repo root: $RepoRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".env"))) {
  Write-Warning ".env missing at repo root. Copy .env.example to .env and set DATABASE_URL before API will work."
}
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $nodeCmd -or -not $npmCmd) {
  throw "Node.js and npm are required on PATH (Node >= 20)."
}

if ($Mode -eq "Prod") {
  $apiDist = Join-Path $RepoRoot "apps\api\dist\server.js"
  $webDist = Join-Path $RepoRoot "apps\web\dist\index.html"
  if ($runApi -and -not (Test-Path -LiteralPath $apiDist)) {
    throw "API dist missing ($apiDist). Run: npm run build --workspace=@flaha-intel/api"
  }
  if ($runWeb -and -not (Test-Path -LiteralPath $webDist)) {
    throw "Web dist missing ($webDist). Run: npm run build --workspace=@flaha-intel/web"
  }
}

# Free ports if something already bound (dev restart convenience)
if ($runApi) {
  $existing = @(Get-ListeningPids -Port $apiPort)
  if ($existing.Count -gt 0) {
    Write-Host "[info] Port $apiPort already in use - stopping previous listener(s)..."
    Stop-PortListeners -Port $apiPort -Label "API"
    Start-Sleep -Milliseconds 500
  }
}
if ($runWeb) {
  $existing = @(Get-ListeningPids -Port $webPort)
  if ($existing.Count -gt 0) {
    Write-Host "[info] Port $webPort already in use - stopping previous listener(s)..."
    Stop-PortListeners -Port $webPort -Label "Web"
    Start-Sleep -Milliseconds 500
  }
}

Write-Host ""
Write-Host "FlahaINTEL start ($Mode)" -ForegroundColor Green
Write-Host "  Repo : $RepoRoot"
Write-Host "  API  : $apiBase  (port $apiPort)"
Write-Host "  Web  : $webUrl  (port $webPort)"
Write-Host ""

if ($runApi) {
  if ($Mode -eq "Dev") {
    Start-AppWindow -Title "FlahaINTEL API (dev)" -WorkingDirectory $RepoRoot -NpmArgs "run dev --workspace=@flaha-intel/api"
  } else {
    Start-AppWindow -Title "FlahaINTEL API (prod)" -WorkingDirectory $RepoRoot -NpmArgs "run start --workspace=@flaha-intel/api"
  }
  Write-Host "[start] API window launched"
}

if ($runWeb) {
  if ($Mode -eq "Dev") {
    Start-AppWindow -Title "FlahaINTEL Web (dev)" -WorkingDirectory $RepoRoot -NpmArgs "run dev --workspace=@flaha-intel/web"
  } else {
    Start-AppWindow -Title "FlahaINTEL Web (preview)" -WorkingDirectory $RepoRoot -NpmArgs "run preview --workspace=@flaha-intel/web"
  }
  Write-Host "[start] Web window launched"
}

if ($runApi -and -not $SkipHealthWait) {
  Write-Host "[wait] API /health (up to ${HealthTimeoutSec}s)..."
  [void](Wait-ApiHealth -BaseUrl $apiBase -TimeoutSec $HealthTimeoutSec)
}

if ($runWeb -and -not $NoBrowser) {
  try {
    Start-Process $webUrl | Out-Null
  } catch {
    Write-Host "[info] Open browser manually: $webUrl"
  }
}

Write-Host ""
Write-Host "Login (local bootstrap default): admin@flaha.local" -ForegroundColor DarkGray
Write-Host "Stop later:  powershell -NoProfile -File ops\scripts\start-flahaintel.ps1 -Stop"
Write-Host "Or close the API/Web console windows."
Write-Host ""
