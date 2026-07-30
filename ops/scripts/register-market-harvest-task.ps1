# Flaha Agri Tech — register Windows Task Scheduler for market harvest
# Daily 05:30 local: runner still skips channels not due (JO/MoCI daily, Mahaseel every 3d).

param(
  [string]$TaskName = "FlahaINTEL-MarketHarvest",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$Time = "05:30",
  [switch]$Unregister
)

$ErrorActionPreference = "Stop"

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Unregistered $TaskName"
  exit 0
}

$wrapper = Join-Path $RepoRoot "ops\scripts\run-scheduled-market-harvest.ps1"
if (-not (Test-Path $wrapper)) { throw "Missing $wrapper" }

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$wrapper`"" `
  -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Registered scheduled task: $TaskName daily at $Time"
Write-Host "Cadence inside harvest: JO+MoCI daily, Mahaseel every 3 days; product filter max 3 days."
Write-Host "Log: FLAHA_STATE_DIR\scheduled-market-harvest.log"
