#!/usr/bin/env bash
# Flaha Agri Tech
# Precision Agriculture Division
# Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
#
# Title: Serial ingestion pipeline (small host)
# Introduction: Runs each worker family once, in order, so Chromium/Python never overlap.
#
# Created by: Rafat Al Khashan
# Created date: 2026-08-19
# Last modified: 2026-08-19

set -euo pipefail
cd /opt/flahaintel/current/apps/api
export NODE_ENV="${NODE_ENV:-production}"
families=(acquisition extraction normalization submission-advance stale-recovery)
for family in "${families[@]}"; do
  echo "[pipeline] start ${family} $(date -u +%FT%TZ)"
  /usr/bin/node --import tsx src/production/workers/cli.ts "${family}" || echo "[pipeline] ${family} exited $?"
  echo "[pipeline] end ${family} $(date -u +%FT%TZ)"
done
