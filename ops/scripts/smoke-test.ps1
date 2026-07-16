# Flaha Agri Tech — post-deploy smoke checks

param(
  [string]$BaseUrl = "http://127.0.0.1:3003"
)

$ErrorActionPreference = "Stop"
$health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method GET
if ($health.status -ne "ok") { throw "health failed" }
$ready = Invoke-WebRequest -Uri "$BaseUrl/ready" -Method GET
if ($ready.StatusCode -ne 200) { throw "ready failed: $($ready.StatusCode)" }
Write-Host "Smoke OK: health + ready on $BaseUrl"
