# Flaha Agri Tech — free-space probe (post-3N ops)
# Exit 0 if all checked volumes meet MinFreePercent; exit 2 if any fail.

param(
  [double]$MinFreePercent = 15,
  [string[]]$Paths = @()
)

$ErrorActionPreference = "Stop"

if ($Paths.Count -eq 0) {
  $Paths = @(
    (Get-Location).Path,
    $(if ($env:ARTIFACT_STORE_ROOT) { $env:ARTIFACT_STORE_ROOT } else { Join-Path (Get-Location) ".flaha-artifacts-prod" }),
    $(if ($env:FLAHA_BACKUP_ROOT) { $env:FLAHA_BACKUP_ROOT } else { Join-Path (Get-Location) ".flaha-backups" })
  )
}

$failed = $false
$seen = @{}

foreach ($p in $Paths) {
  if (-not $p) { continue }
  $root = $null
  try {
    if (Test-Path $p) {
      $root = (Resolve-Path $p).Path.Substring(0, 1) + ":"
    } elseif ($p -match '^[A-Za-z]:') {
      $root = $p.Substring(0, 1).ToUpper() + ":"
    } else {
      $root = (Get-Location).Path.Substring(0, 1) + ":"
    }
  } catch {
    $root = "C:"
  }

  if ($seen.ContainsKey($root)) { continue }
  $seen[$root] = $true

  $drive = Get-PSDrive -Name $root.TrimEnd(':') -ErrorAction SilentlyContinue
  if (-not $drive) {
    Write-Warning "Drive not found for path $p ($root)"
    $failed = $true
    continue
  }

  $free = [double]$drive.Free
  $used = [double]$drive.Used
  $total = $free + $used
  if ($total -le 0) {
    Write-Warning "Cannot measure $root"
    $failed = $true
    continue
  }
  $pct = [math]::Round(100.0 * $free / $total, 2)
  $freeGb = [math]::Round($free / 1GB, 2)
  $status = if ($pct -ge $MinFreePercent) { "OK" } else { "LOW" }
  Write-Host ("{0}  free={1}% ({2} GB)  path-context={3}  [{4}]" -f $root, $pct, $freeGb, $p, $status)
  if ($status -eq "LOW") { $failed = $true }
}

if ($failed) {
  Write-Host "FAIL: one or more volumes below $MinFreePercent% free. See ops/runbooks/disk-and-volume-layout.md"
  exit 2
}
Write-Host "PASS: free space within threshold ($MinFreePercent%)"
exit 0
