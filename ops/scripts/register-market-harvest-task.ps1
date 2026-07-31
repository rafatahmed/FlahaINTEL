# Flaha Agri Tech — register Windows Task Scheduler for market harvest
# Daily 05:30 local: runner still skips channels not due (JO/MoCI daily, Mahaseel every 3d).

param(
  [string]$TaskName = "FlahaINTEL-MarketHarvest",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$Time = "05:30",
  [ValidateSet("Limited", "Highest")]
  [string]$RunLevel = "Limited",
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
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel $RunLevel

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
} catch {
  Write-Error @"
Access denied registering $TaskName (RunLevel=$RunLevel).
Open an elevated PowerShell (Run as administrator) and re-run:
  npm run ops:register-market-harvest-task
Or: powershell -File ops\scripts\register-market-harvest-task.ps1 -RunLevel Highest
$($_.Exception.Message)
"@
  exit 1
}
Write-Host "Registered scheduled task: $TaskName daily at $Time (RunLevel=$RunLevel)"
Write-Host "Cadence inside harvest: JO+MoCI daily, Mahaseel every 3 days; product filter max 3 days."
Write-Host "Log: FLAHA_STATE_DIR\scheduled-market-harvest.log"
