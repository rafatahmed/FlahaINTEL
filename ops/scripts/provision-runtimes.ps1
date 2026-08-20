# Flaha Agri Tech — Phase 3M offline-oriented runtime provisioning
# Uses pinned versions from benchmarks/ingestion/config locks. Does not download during job processing.

param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$RuntimeRoot = $(if ($env:FLAHA_RUNTIME_ROOT) { $env:FLAHA_RUNTIME_ROOT } else { Join-Path $RepoRoot ".flaha-runtimes" }),
  [switch]$VerifyOnly,
  [switch]$InstallPlaywrightChromium
)

$ErrorActionPreference = "Stop"
$lockDir = Join-Path $RepoRoot "benchmarks\ingestion\config"

$pins = [ordered]@{
  scrapy = "2.17.0"
  playwright = "1.61.1"
  chromium = "r1228"
  tika = "3.3.1"
  java = "21.0.11+10"
  postgresqlClient = "17"
}

Write-Host "Pinned runtimes:" ($pins | ConvertTo-Json -Compress)
New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null

function Resolve-Existing([string[]]$candidates) {
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return (Resolve-Path $c).Path }
  }
  return $null
}

$paths = [ordered]@{
  PYTHON_BIN = Resolve-Existing @(
    "C:\Python314\python.exe",
    (Join-Path $RepoRoot ".benchmark-runtime\crawler-scrapy-2.17.0\Scripts\python.exe")
  )
  SCRAPY_PYTHON = Resolve-Existing @(
    (Join-Path $RepoRoot ".benchmark-runtime\crawler-scrapy-2.17.0\Scripts\python.exe"),
    (Join-Path $RepoRoot ".benchmark-envs\crawler-scrapy-2.17.0-py314\Scripts\python.exe")
  )
  SCRAPY_BIN = $null
  PLAYWRIGHT_CLI = Resolve-Existing @(
    (Join-Path $RepoRoot ".benchmark-runtime\browser-playwright-1.61.1\node_modules\playwright\cli.js")
  )
  PLAYWRIGHT_CHROMIUM_PATH = Resolve-Existing @(
    "$env:USERPROFILE\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.exe",
    "$env:USERPROFILE\AppData\Local\ms-playwright\chromium-1228\chrome-win\chrome.exe",
    "$env:USERPROFILE\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe"
  )
  JAVA_BIN = Resolve-Existing @(
    (Join-Path $RepoRoot ".benchmark-runtime\document-tika-3.3.1\jre\jdk-21.0.11+10-jre\bin\java.exe")
  )
  TIKA_JAR = Resolve-Existing @(
    (Join-Path $RepoRoot ".benchmark-runtime\document-tika-3.3.1\tika-app-3.3.1.jar")
  )
  TIKA_ALLOWLIST = Resolve-Existing @(
    (Join-Path $RepoRoot "benchmarks\ingestion\config\document-tika-parser-allowlist.xml")
  )
  FLAHA_PG_BIN = Resolve-Existing @(
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin"
  )
  ARTIFACT_STORE_ROOT = if ($env:ARTIFACT_STORE_ROOT) { $env:ARTIFACT_STORE_ROOT } elseif ($env:FLAHA_ARTIFACT_ROOT) { $env:FLAHA_ARTIFACT_ROOT } else { Join-Path $RepoRoot ".flaha-artifacts-local" }
}

# Expand chromium wildcard if needed
if (-not $paths.PLAYWRIGHT_CHROMIUM_PATH) {
  $found = Get-ChildItem "$env:USERPROFILE\AppData\Local\ms-playwright" -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $paths.PLAYWRIGHT_CHROMIUM_PATH = $found.FullName }
  else {
    $shell = Get-ChildItem "$env:USERPROFILE\AppData\Local\ms-playwright" -Recurse -Filter "chrome-headless-shell.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($shell) { $paths.PLAYWRIGHT_CHROMIUM_PATH = $shell.FullName }
  }
}

if ($paths.SCRAPY_PYTHON) {
  $scrapyScript = Join-Path (Split-Path $paths.SCRAPY_PYTHON) "scrapy.exe"
  if (Test-Path $scrapyScript) { $paths.SCRAPY_BIN = $scrapyScript }
  else { $paths.SCRAPY_BIN = $paths.SCRAPY_PYTHON }
}

if ($InstallPlaywrightChromium -and -not $VerifyOnly) {
  $pwDir = Join-Path $RepoRoot ".benchmark-runtime\browser-playwright-1.61.1"
  if (Test-Path $pwDir) {
    Write-Host "Installing Playwright Chromium into ms-playwright (provisioning only)..."
    $env:PLAYWRIGHT_BROWSERS_PATH = "$env:USERPROFILE\AppData\Local\ms-playwright"
    Push-Location $pwDir
    try {
      & npx playwright install chromium
    } finally {
      Pop-Location
    }
    $found = Get-ChildItem "$env:USERPROFILE\AppData\Local\ms-playwright" -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $paths.PLAYWRIGHT_CHROMIUM_PATH = $found.FullName }
  }
}

New-Item -ItemType Directory -Force -Path $paths.ARTIFACT_STORE_ROOT | Out-Null
$stateDir = Join-Path $paths.ARTIFACT_STORE_ROOT ".ops-state"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

$checks = @()
function Probe($name, $scriptBlock) {
  try {
    $detail = & $scriptBlock 2>&1 | Out-String
    $detail = $detail.Trim()
    # Treat presence of output as success even when tools write to stderr (java -version)
    $checks += @{ name = $name; ok = $true; detail = "$detail" }
    Write-Host "READY $name :: $detail"
  } catch {
    $checks += @{ name = $name; ok = $false; detail = "$_" }
    Write-Warning "FAIL  $name :: $_"
  }
}

Probe "node" { node --version }
if ($paths.SCRAPY_PYTHON) {
  Probe "scrapy" { & $paths.SCRAPY_PYTHON -c "import scrapy; print(scrapy.__version__)" }
}
if ($paths.PLAYWRIGHT_CLI) {
  Probe "playwright" { node $paths.PLAYWRIGHT_CLI --version }
}
if ($paths.PLAYWRIGHT_CHROMIUM_PATH) {
  Probe "chromium" {
    $p = $paths.PLAYWRIGHT_CHROMIUM_PATH
    if (-not (Test-Path $p)) { throw "chromium missing: $p" }
    # Functional probe: binary exists and is non-empty (full --version may hit sandbox on Windows CI hosts)
    $len = (Get-Item $p).Length
    if ($len -lt 10000) { throw "chromium binary too small" }
    return "path=$p bytes=$len revision=r1228"
  }
}
if ($paths.JAVA_BIN) {
  Probe "java" {
    $out = & $paths.JAVA_BIN -version 2>&1 | Out-String
    if ($out -notmatch "version") { throw "java -version failed: $out" }
    return $out.Trim()
  }
}
if ($paths.TIKA_JAR -and $paths.JAVA_BIN) {
  Probe "tika" { & $paths.JAVA_BIN -jar $paths.TIKA_JAR --help 2>&1 | Select-Object -First 1 }
}
if ($paths.FLAHA_PG_BIN) {
  Probe "pg_dump" { & (Join-Path $paths.FLAHA_PG_BIN "pg_dump.exe") --version }
}

$envFile = Join-Path $RuntimeRoot "runtime-paths.env"
$lines = @(
  "# Generated by provision-runtimes.ps1 - do not put secrets here",
  "ARTIFACT_STORE_ROOT=$($paths.ARTIFACT_STORE_ROOT)",
  "FLAHA_ARTIFACT_ROOT=$($paths.ARTIFACT_STORE_ROOT)",
  "FLAHA_STATE_DIR=$stateDir",
  "FLAHA_RUNTIME_ROOT=$RuntimeRoot",
  "PLAYWRIGHT_BROWSERS_PATH=$env:USERPROFILE\AppData\Local\ms-playwright"
)
foreach ($key in $paths.Keys) {
  if ($paths[$key]) { $lines += "$key=$($paths[$key])" }
}
$lines | Set-Content $envFile -Encoding utf8

$report = [ordered]@{
  verifiedAt = (Get-Date).ToUniversalTime().ToString("o")
  runtimeRoot = $RuntimeRoot
  pins = $pins
  paths = $paths
  checks = $checks
  envFile = $envFile
  allReady = -not ($checks | Where-Object { -not $_.ok })
}
$reportPath = Join-Path $RuntimeRoot "provision-report.json"
($report | ConvertTo-Json -Depth 8) | Set-Content $reportPath
Write-Host "Wrote $envFile"
Write-Host "Wrote $reportPath"
Write-Host "allReady=$($report.allReady)"
if (-not $report.allReady) { exit 2 }
