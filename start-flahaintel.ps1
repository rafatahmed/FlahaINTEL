# Flaha Agri Tech
# Precision Agriculture Division
# Copyright (c) 2026-2027 Flaha Agri Tech. All rights reserved.
#
# Title: Start FlahaINTEL (repo-root wrapper)
# Introduction: Forwards to ops/scripts/start-flahaintel.ps1 for convenience.
#
# Created by: Rafat Al Khashan
# Created date: 2026-07-31
# Last modified: 2026-08-20

param(
  [ValidateSet("Dev", "Prod")]
  [string]$Mode = "Dev",
  [switch]$ApiOnly,
  [switch]$WebOnly,
  [switch]$Stop,
  [switch]$NoBrowser,
  [switch]$SkipHealthWait,
  [switch]$NoPipeline,
  [int]$HealthTimeoutSec = 45
)

$ErrorActionPreference = "Stop"
$target = Join-Path $PSScriptRoot "ops\scripts\start-flahaintel.ps1"
if (-not (Test-Path -LiteralPath $target)) {
  throw "Missing $target"
}

& $target @PSBoundParameters
exit $LASTEXITCODE
