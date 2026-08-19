#!/usr/bin/env bash
# Flaha Agri Tech
# Precision Agriculture Division
# Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
#
# Title: Small-host update / migrate
# Introduction: Pulls main, rebuilds, applies Prisma migrations, restarts API.
# Never overwrites /etc/flahaintel/production.env or /opt/flahaintel/runtimes.
#
# Created by: Rafat Al Khashan
# Created date: 2026-08-19
# Last modified: 2026-08-19
#
# Usage (root): bash /opt/flahaintel/current/ops/scripts/linux/update-small-host.sh
# Optional: --runtimes  also re-run provision-runtimes.sh
# Optional: --skip-backup

set -euo pipefail
CURRENT="${INSTALL_ROOT:-/opt/flahaintel/current}"
GIT_REF="${GIT_REF:-main}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"
DO_RUNTIMES=0
SKIP_BACKUP=0
for arg in "$@"; do
  case "$arg" in
    --runtimes) DO_RUNTIMES=1 ;;
    --skip-backup) SKIP_BACKUP=1 ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then echo "Run as root."; exit 1; fi
if [[ ! -d "${CURRENT}/.git" ]]; then echo "Missing ${CURRENT}"; exit 1; fi

echo "==== backup ===="
if [[ "${SKIP_BACKUP}" -eq 0 && -x "${CURRENT}/ops/scripts/linux/backup-once.sh" ]]; then
  bash "${CURRENT}/ops/scripts/linux/backup-once.sh"
else
  echo "skip backup"
fi

echo "==== git pull ${GIT_REF} ===="
git config --global --add safe.directory "${CURRENT}" || true
git -C "${CURRENT}" fetch origin
git -C "${CURRENT}" checkout "${GIT_REF}"
git -C "${CURRENT}" pull --ff-only origin "${GIT_REF}"
find "${CURRENT}/ops/scripts/linux" -name '*.sh' -exec sed -i 's/\r$//' {} \;
chmod +x "${CURRENT}/ops/scripts/linux/"*.sh
ln -sfn /etc/flahaintel/production.env "${CURRENT}/.env"
if [[ -f "${CURRENT}/ops/config/crawl-policy.json" ]]; then
  cp "${CURRENT}/ops/config/crawl-policy.json" /etc/flahaintel/crawl-policy.json
  chmod 644 /etc/flahaintel/crawl-policy.json
fi

echo "==== build ===="
cd "${CURRENT}"
npm ci
npm i @rolldown/binding-linux-x64-gnu --no-fund --no-audit || true
npx prisma generate --schema=apps/api/prisma/schema.prisma
npm run build --workspace=@flaha-intel/artifact-store
npm run build --workspace=@flaha-intel/worker-supervisor
npm run build --workspace=@flaha-intel/ingestion-provider-core
npm run build --workspace=@flaha-intel/api || true
(cd apps/web && npx vite build)
rsync -a --delete "${CURRENT}/apps/web/dist/" /var/lib/flahaintel/web/
chown -R flahaintel:flahaintel "${CURRENT}" /var/lib/flahaintel/web

echo "==== migrate ===="
set -a
# shellcheck disable=SC1091
source /etc/flahaintel/migrator.env
set +a
DATABASE_URL="${MIGRATOR_DATABASE_URL}" npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

if [[ "${DO_RUNTIMES}" -eq 1 ]]; then
  echo "==== runtimes ===="
  bash "${CURRENT}/ops/scripts/linux/provision-runtimes.sh"
fi

echo "==== systemd ===="
cp "${CURRENT}/ops/systemd/small-host/"*.service /etc/systemd/system/ || true
cp "${CURRENT}/ops/systemd/small-host/"*.timer /etc/systemd/system/ || true
systemctl daemon-reload
systemctl restart flahaintel-api
systemctl start flahaintel-pipeline.service || true
sleep 3
curl -fsS --max-time 10 http://127.0.0.1:3003/health
echo
curl -fsS --max-time 10 http://127.0.0.1:3003/ready || true
echo
echo "UPDATE COMPLETE $(git -C "${CURRENT}" log -1 --oneline)"
echo "production.env and /opt/flahaintel/runtimes were not overwritten."
