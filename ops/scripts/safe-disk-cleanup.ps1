# Flaha Agri Tech — safe disk cleanup (Wave E)
# Regenerable caches/benchmark envs only. Does NOT delete ArtifactStore promoted content.
# Usage:
#   powershell -File ops/scripts/safe-disk-cleanup.ps1 -DryRun
#   powershell -File ops/scripts/safe-disk-cleanup.ps1 -Confirm

param(
  [switch]$DryRun,
  [switch]$Confirm,
  [switch]$IncludeBenchmarkEnvs,
  [switch]$IncludePlaywrightBrowsers
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

function Get-DirSizeGB([string]$path) {
  if (-not (Test-Path $path)) { return 0 }
  $sum = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  if (-not $sum) { return 0 }
  return [math]::Round($sum / 1GB, 3)
}

$targets = @(
  @{ Path = "apps\web\dist"; Label = "web dist" },
  @{ Path = "apps\api\dist"; Label = "api dist" },
  @{ Path = "apps\web\tsconfig.app.tsbuildinfo"; Label = "web tsbuildinfo" },
  @{ Path = "apps\api\tsconfig.tsbuildinfo"; Label = "api tsbuildinfo" }
)

if ($IncludeBenchmarkEnvs) {
  $targets += @{ Path = ".benchmark-envs"; Label = "benchmark envs (regenerable)" }
  $targets += @{ Path = ".benchmark-models"; Label = "benchmark models (regenerable)" }
}

Write-Host "Repo root: $root"
Write-Host "DryRun=$DryRun Confirm=$Confirm IncludeBenchmarkEnvs=$IncludeBenchmarkEnvs IncludePlaywrightBrowsers=$IncludePlaywrightBrowsers"
Write-Host ""

$freed = 0.0
foreach ($t in $targets) {
  $p = Join-Path $root $t.Path
  if (-not (Test-Path $p)) { continue }
  $gb = Get-DirSizeGB $p
  Write-Host ("  {0,8:N3} GB  {1}  ({2})" -f $gb, $t.Label, $t.Path)
  if (-not $DryRun -and $Confirm) {
    if (Test-Path $p -PathType Container) {
      Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
    } else {
      Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue
    }
    $freed += $gb
  }
}

# Optional: Playwright browser cache (regenerable via provision; ~0.5–1.5GB typical)
if ($IncludePlaywrightBrowsers) {
  $pw = Join-Path $env:LOCALAPPDATA "ms-playwright"
  if (Test-Path $pw) {
    $gb = Get-DirSizeGB $pw
    Write-Host ("  {0,8:N3} GB  ms-playwright browsers  ({1})" -f $gb, $pw)
    if (-not $DryRun -and $Confirm) {
      Remove-Item -LiteralPath $pw -Recurse -Force -ErrorAction SilentlyContinue
      $freed += $gb
    }
  }
}

# npm cache clean
if (-not $DryRun -and $Confirm) {
  Write-Host "  npm cache clean --force"
  npm cache clean --force 2>$null | Out-Null
}

# Temp flaha-*
$temp = [System.IO.Path]::GetTempPath()
Get-ChildItem $temp -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^(flaha|tsx-|vitest)' } |
  ForEach-Object {
    $gb = Get-DirSizeGB $_.FullName
    Write-Host ("  {0,8:N3} GB  temp {1}" -f $gb, $_.Name)
    if (-not $DryRun -and $Confirm) {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
      $freed += $gb
    }
  }

Write-Host ""
if ($DryRun -or -not $Confirm) {
  Write-Host "No deletes applied. Re-run with -Confirm [-IncludeBenchmarkEnvs] [-IncludePlaywrightBrowsers]."
  Write-Host "ArtifactStore and promoted evidence are NEVER deleted by this script."
  Write-Host "Note: C: free space target 15% usually requires moving ARTIFACT_STORE_ROOT / backups / user data off OS volume. See ops/runbooks/disk-and-volume-layout.md"
} else {
  Write-Host ("Approximate reclaimed (tracked): {0:N2} GB" -f $freed)
}

# Free space after
& (Join-Path $PSScriptRoot "check-free-space.ps1")
exit $LASTEXITCODE
