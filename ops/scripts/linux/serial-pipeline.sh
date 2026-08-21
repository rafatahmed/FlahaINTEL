#!/usr/bin/env bash
# Flaha Agri Tech
# Precision Agriculture Division
# Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
#
# Title: Serial ingestion pipeline (small host)
# Introduction: One heavy runtime at a time; drain by claim priority so extract is not held behind unrelated fetches.
#
# Created by: Rafat Al Khashan
# Created date: 2026-08-19
# Last modified: 2026-08-21
# Drain: pick the highest-priority claimable job's family, run one claim, advance that
# item's next stage. Do not finish every fetch before any extract — wait only for this
# item's previous stage (or host memory: one heavy runtime at a time).
# tsx workers use --conditions=development so workspace packages load TypeScript
# source (Tika-only catalogue/selection). API remains node dist/server.js (package dist).

set -euo pipefail
cd /opt/flahaintel/current/apps/api
export NODE_ENV="${NODE_ENV:-production}"
# Oneshot: one claim then leave so submission-advance can start the next stage of the same item.
export WORKER_EXIT_ON_IDLE="${WORKER_EXIT_ON_IDLE:-1}"
export WORKER_MAX_JOBS="${WORKER_MAX_JOBS_PER_CLAIM:-1}"
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
next_family_json() {
  node_tsx src/production/workers/cli.ts next-family
}
family_of() {
  /usr/bin/node -e 'let j={}; try { j=JSON.parse(process.argv[1]); } catch (e) {} process.stdout.write(String(j.family||"idle"));' "$1"
}
job_of() {
  /usr/bin/node -e 'let j={}; try { j=JSON.parse(process.argv[1]); } catch (e) {} process.stdout.write(String(j.jobId||""));' "$1"
}

export PIPELINE_SKIP_JOB_IDS="${PIPELINE_SKIP_JOB_IDS:-}"
while true; do
  next_json="$(next_family_json || true)"
  family="$(family_of "${next_json}")"
  job_id="$(job_of "${next_json}")"
  if [[ "${family}" == "idle" || -z "${family}" ]]; then
    run_step "submission-advance" src/production/workers/cli.ts submission-advance
    next_json="$(next_family_json || true)"
    family="$(family_of "${next_json}")"
    if [[ "${family}" == "idle" || -z "${family}" ]]; then
      break
    fi
    continue
  fi
  run_step "${family}" src/production/workers/cli.ts "${family}"
  if [[ -n "${job_id}" ]]; then
    if [[ -n "${PIPELINE_SKIP_JOB_IDS}" ]]; then
      PIPELINE_SKIP_JOB_IDS+=","
    fi
    PIPELINE_SKIP_JOB_IDS+="${job_id}"
    export PIPELINE_SKIP_JOB_IDS
  fi
  run_step "submission-advance-after-${family}" src/production/workers/cli.ts submission-advance
done
run_step stale-recovery src/production/workers/cli.ts stale-recovery
finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
umask 022
cat > "${STATE_DIR}/pipeline-heartbeat.json" <<EOF
{"startedAt":"${started}","finishedAt":"${finished}","mode":"serial","familyExits":{${family_exits}}}
EOF
chown flahaintel:flahaintel "${STATE_DIR}/pipeline-heartbeat.json" 2>/dev/null || true
