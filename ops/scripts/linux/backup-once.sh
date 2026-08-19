#!/usr/bin/env bash
# Flaha Agri Tech
# Precision Agriculture Division
# Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
#
# Title: Coordinated backup (Linux small host)
# Introduction: pg_dump + ArtifactStore tar + redacted env snapshot; writes last-backup.json.
#
# Created by: Rafat Al Khashan
# Created date: 2026-08-19
# Last modified: 2026-08-19

set -euo pipefail
set -a
# shellcheck disable=SC1091
source /etc/flahaintel/production.env
# shellcheck disable=SC1091
source /etc/flahaintel/migrator.env
set +a

BACKUP_ROOT="${FLAHA_BACKUP_ROOT:-/var/lib/flahaintel/backups}"
STATE_DIR="${FLAHA_STATE_DIR:-/var/lib/flahaintel/state}"
ARTIFACT_ROOT="${ARTIFACT_STORE_ROOT:-/var/lib/flahaintel/artifacts}"
DUMP_URL="${MIGRATOR_DATABASE_URL:-${DATABASE_URL}}"
DUMP_URL="${DUMP_URL%%\?*}"
stamp="$(date -u +%Y%m%d-%H%M%S)"
dest="${BACKUP_ROOT}/${stamp}"
mkdir -p "${dest}" "${STATE_DIR}"

pg_dump --dbname="${DUMP_URL}" --format=custom --file="${dest}/postgres.dump"
if [[ -d "${ARTIFACT_ROOT}" ]]; then
  tar -C "${ARTIFACT_ROOT}" -czf "${dest}/artifacts.tgz" .
else
  echo "artifact root missing: ${ARTIFACT_ROOT}" >&2
  exit 1
fi
if [[ -f /etc/flahaintel/production.env ]]; then
  sed -E 's/(SECRET|PASSWORD|DATABASE_URL)=.*/\1=[REDACTED]/I' /etc/flahaintel/production.env > "${dest}/production.env.redacted"
fi

created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "${dest}/manifest.json" <<EOF
{"createdAt":"${created_at}","destination":"${dest}","rpoHours":24,"rtoHours":4,"components":["postgres","artifacts","config-marker"]}
EOF
cp "${dest}/manifest.json" "${STATE_DIR}/last-backup.json"
chown -R flahaintel:flahaintel "${BACKUP_ROOT}" "${STATE_DIR}/last-backup.json"
echo "Backup complete: ${dest}"
echo "Copy ${dest} off-host before relying on RPO."
