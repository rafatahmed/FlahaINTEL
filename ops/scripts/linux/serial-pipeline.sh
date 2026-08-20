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
family_exits=""
record_exit() {
  local name="$1" code="$2"
  if [[ -n "${family_exits}" ]]; then family_exits+=","; fi
  family_exits+="\"${name}\":${code}"
}
run_step() {
  local name="$1"; shift
  echo "[pipeline] start ${name} ${started}"
  if node_tsx "$@"; then
    record_exit "${name}" 0
  else
    local code=$?
    record_exit "${name}" "${code}"
    echo "[pipeline] ${name} exited ${code}"
  fi
  echo "[pipeline] end ${name} $(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
# Advance after each family so one timer tick can finish acquire → extract → normalize → governance.
families=(acquisition extraction normalization)
for family in "${families[@]}"; do
  run_step "${family}" src/production/workers/cli.ts "${family}"
  run_step "submission-advance-after-${family}" src/production/workers/cli.ts submission-advance
done
run_step stale-recovery src/production/workers/cli.ts stale-recovery
finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
umask 022
cat > "${STATE_DIR}/pipeline-heartbeat.json" <<EOF
{"startedAt":"${started}","finishedAt":"${finished}","mode":"serial","familyExits":{${family_exits}}}
EOF
chown flahaintel:flahaintel "${STATE_DIR}/pipeline-heartbeat.json" 2>/dev/null || true
