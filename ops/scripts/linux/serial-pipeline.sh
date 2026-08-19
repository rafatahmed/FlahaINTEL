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
STATE_DIR="${FLAHA_STATE_DIR:-/var/lib/flahaintel/state}"
mkdir -p "${STATE_DIR}"
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
families=(acquisition extraction normalization submission-advance stale-recovery)
for family in "${families[@]}"; do
  echo "[pipeline] start ${family} ${started}"
  /usr/bin/node --import tsx src/production/workers/cli.ts "${family}" || echo "[pipeline] ${family} exited $?"
  echo "[pipeline] end ${family} $(date -u +%Y-%m-%dT%H:%M:%SZ)"
done
finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
umask 022
cat > "${STATE_DIR}/pipeline-heartbeat.json" <<EOF
{"startedAt":"${started}","finishedAt":"${finished}","mode":"serial"}
EOF
chown flahaintel:flahaintel "${STATE_DIR}/pipeline-heartbeat.json" 2>/dev/null || true
