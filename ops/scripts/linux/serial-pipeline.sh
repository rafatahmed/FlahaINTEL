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
# Last modified: 2026-08-20
# Pipeline order: each family then submission-advance so one tick can finish a chain.
# tsx workers use --conditions=development so workspace packages load TypeScript
# source (Tika-only catalogue/selection). API remains node dist/server.js (package dist).

set -euo pipefail
cd /opt/flahaintel/current/apps/api
export NODE_ENV="${NODE_ENV:-production}"
STATE_DIR="${FLAHA_STATE_DIR:-/var/lib/flahaintel/state}"
mkdir -p "${STATE_DIR}"
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node_tsx() {
  /usr/bin/node --conditions=development --import tsx "$@"
}
# Advance after each family so one timer tick can finish acquire → extract → normalize → governance.
families=(acquisition extraction normalization)
for family in "${families[@]}"; do
  echo "[pipeline] start ${family} ${started}"
  node_tsx src/production/workers/cli.ts "${family}" || echo "[pipeline] ${family} exited $?"
  echo "[pipeline] end ${family} $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "[pipeline] start submission-advance after ${family} $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  node_tsx src/production/workers/cli.ts submission-advance || echo "[pipeline] submission-advance exited $?"
done
echo "[pipeline] start stale-recovery ${started}"
node_tsx src/production/workers/cli.ts stale-recovery || echo "[pipeline] stale-recovery exited $?"
echo "[pipeline] end stale-recovery $(date -u +%Y-%m-%dT%H:%M:%SZ)"
finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
umask 022
cat > "${STATE_DIR}/pipeline-heartbeat.json" <<EOF
{"startedAt":"${started}","finishedAt":"${finished}","mode":"serial"}
EOF
chown flahaintel:flahaintel "${STATE_DIR}/pipeline-heartbeat.json" 2>/dev/null || true
