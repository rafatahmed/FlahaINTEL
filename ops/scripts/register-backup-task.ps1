# Flaha Agri Tech — register Windows Task Scheduler job for nightly backup
# Run elevated once per host. Does not store secrets in the task XML.

param(
  [string]$TaskName = "FlahaINTEL-NightlyBackup",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$Time = "02:30",
  # Highest requires elevated shell; Limited works for current-user interactive tasks.
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

$backupScript = Join-Path $RepoRoot "ops\scripts\backup.ps1"
if (-not (Test-Path $backupScript)) { throw "Missing $backupScript" }

# Wrapper loads runtime-paths.env + .env for DATABASE_URL without printing secrets
$wrapper = Join-Path $RepoRoot "ops\scripts\run-scheduled-backup.ps1"
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
  npm run ops:register-backup-task
Or: powershell -File ops\scripts\register-backup-task.ps1 -RunLevel Highest
$($_.Exception.Message)
"@
  exit 1
}
Write-Host "Registered scheduled task: $TaskName daily at $Time (RunLevel=$RunLevel)"
Write-Host "Wrapper: $wrapper"
Write-Host "Ensure ARTIFACT_STORE_ROOT, FLAHA_BACKUP_ROOT, and DATABASE_URL are available via .env / runtime-paths.env"
Write-Host "After first night, confirm FLAHA_STATE_DIR\last-backup.json and off-host copy."
