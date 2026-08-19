#!/usr/bin/env bash
# Flaha Agri Tech
# Precision Agriculture Division
# Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
#
# Title: Measured small-host full install (2 vCPU / 2 GB / 90 GB)
# Introduction: Idempotent Ubuntu 24.04 install of FlahaINTEL: swap, packages,
# Postgres, clone main, build, migrate, bootstrap, systemd, Caddy, smoke.
#
# Created by: Rafat Al Khashan
# Created date: 2026-08-19
# Last modified: 2026-08-19
#
# Usage (root):
#   export FLAHA_PUBLIC_HOST=intel.flaha.org
#   bash ops/scripts/linux/install-small-host.sh
# Or after clone:
#   GIT_REF=main bash /opt/flahaintel/current/ops/scripts/linux/install-small-host.sh

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/rafatahmed/FlahaINTEL.git}"
GIT_REF="${GIT_REF:-main}"
PUBLIC_HOST="${FLAHA_PUBLIC_HOST:-intel.flaha.org}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/flahaintel}"
CURRENT="${INSTALL_ROOT}/current"
MEASURE_LOG="${MEASURE_LOG:-/var/log/flahaintel/install-measure.log}"
SWAP_MB="${SWAP_MB:-2048}"

mkdir -p /var/log/flahaintel /etc/flahaintel /var/lib/flahaintel/{artifacts,state,web,backups}
touch "${MEASURE_LOG}"
chmod 755 /var/log/flahaintel

measure() {
  local step="$1"
  local start_ns
  start_ns=$(date +%s%N)
  echo "========== STEP ${step} start $(date -u +%FT%TZ) ==========" | tee -a "${MEASURE_LOG}"
  {
    echo "mem: $(free -h | awk '/Mem:/ {print $2,$3,$4,$7}')"
    echo "swap: $(free -h | awk '/Swap:/ {print $2,$3}')"
    echo "disk: $(df -h / | awk 'NR==2 {print $2,$3,$4,$5}')"
    echo "load: $(cat /proc/loadavg)"
  } | tee -a "${MEASURE_LOG}"
  STEP_START_NS="${start_ns}"
}

measure_end() {
  local step="$1"
  local rc="${2:-0}"
  local end_ns dur
  end_ns=$(date +%s%N)
  dur=$(awk -v s="${STEP_START_NS}" -v e="${end_ns}" 'BEGIN { printf "%.1f", (e-s)/1000000000 }')
  echo "========== STEP ${step} end rc=${rc} duration_s=${dur} $(date -u +%FT%TZ) ==========" | tee -a "${MEASURE_LOG}"
  {
    echo "mem: $(free -h | awk '/Mem:/ {print $2,$3,$4,$7}')"
    echo "swap: $(free -h | awk '/Swap:/ {print $2,$3}')"
    echo "disk: $(df -h / | awk 'NR==2 {print $2,$3,$4,$5}')"
  } | tee -a "${MEASURE_LOG}"
}

run_step() {
  local name="$1"
  shift
  measure "${name}"
  set +e
  "$@"
  local rc=$?
  set -e
  measure_end "${name}" "${rc}"
  if [[ "${rc}" -ne 0 ]]; then
    echo "FAILED step ${name} rc=${rc}" | tee -a "${MEASURE_LOG}"
    exit "${rc}"
  fi
}

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Run as root."
    exit 1
  fi
}

step_swap() {
  if swapon --show | grep -q .; then
    echo "swap already present"
    return 0
  fi
  if [[ ! -f /swapfile ]]; then
    fallocate -l "${SWAP_MB}M" /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=20
  grep -q '^vm.swappiness=' /etc/sysctl.d/99-flahaintel.conf 2>/dev/null || echo 'vm.swappiness=20' > /etc/sysctl.d/99-flahaintel.conf
}

step_packages() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg ufw fail2ban git build-essential python3 python3-venv python3-pip postgresql postgresql-contrib

  if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v20\.|^v22\.|^v24\.'; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
  fi

  if ! command -v caddy >/dev/null 2>&1; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    apt-get update -qq
    apt-get install -y -qq caddy
  fi

  node -v
  npm -v
  psql --version
  caddy version
}

step_user_dirs() {
  if ! id flahaintel >/dev/null 2>&1; then
    useradd --system --home /var/lib/flahaintel --shell /usr/sbin/nologin flahaintel
  fi
  mkdir -p "${INSTALL_ROOT}" /var/lib/flahaintel/{artifacts,state,web,backups} /var/log/flahaintel /etc/flahaintel
  chown -R flahaintel:flahaintel /var/lib/flahaintel /var/log/flahaintel
}

step_firewall() {
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  systemctl enable --now fail2ban
}

step_postgres() {
  local pg_conf_dir
  pg_conf_dir="$(ls -d /etc/postgresql/*/main/conf.d | tail -n1)"
  if [[ -f "${CURRENT}/ops/postgres/small-host.conf" ]]; then
    cp "${CURRENT}/ops/postgres/small-host.conf" "${pg_conf_dir}/flahaintel-small-host.conf"
  fi
  systemctl enable --now postgresql
  systemctl reload postgresql || systemctl restart postgresql

  local app_pw migrator_pw
  if [[ -f /etc/flahaintel/db-passwords.env ]]; then
    # shellcheck disable=SC1091
    source /etc/flahaintel/db-passwords.env
    app_pw="${FLAHA_APP_DB_PASSWORD}"
    migrator_pw="${FLAHA_MIGRATOR_DB_PASSWORD}"
  else
    app_pw="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
    migrator_pw="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
    umask 077
    cat > /etc/flahaintel/db-passwords.env <<EOF
FLAHA_APP_DB_PASSWORD=${app_pw}
FLAHA_MIGRATOR_DB_PASSWORD=${migrator_pw}
EOF
  fi

  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'flaha_migrator') THEN
    CREATE ROLE flaha_migrator LOGIN PASSWORD '${migrator_pw}';
  ELSE
    ALTER ROLE flaha_migrator WITH PASSWORD '${migrator_pw}';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'flaha_app') THEN
    CREATE ROLE flaha_app LOGIN PASSWORD '${app_pw}';
  ELSE
    ALTER ROLE flaha_app WITH PASSWORD '${app_pw}';
  END IF;
END\$\$;
SELECT 'CREATE DATABASE flaha_intel OWNER flaha_migrator'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'flaha_intel')\gexec
GRANT CONNECT ON DATABASE flaha_intel TO flaha_app;
SQL

  sudo -u postgres psql -d flaha_intel -v ON_ERROR_STOP=1 <<SQL
GRANT USAGE ON SCHEMA public TO flaha_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flaha_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO flaha_app;
ALTER DEFAULT PRIVILEGES FOR ROLE flaha_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO flaha_app;
ALTER DEFAULT PRIVILEGES FOR ROLE flaha_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO flaha_app;
ALTER ROLE flaha_app NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE flaha_migrator NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE flaha_app SET statement_timeout = '30s';
ALTER ROLE flaha_app SET lock_timeout = '10s';
ALTER ROLE flaha_app SET idle_in_transaction_session_timeout = '60s';
SQL
}

step_clone() {
  if [[ -d "${CURRENT}/.git" ]]; then
    git -C "${CURRENT}" fetch origin
    git -C "${CURRENT}" checkout "${GIT_REF}"
    git -C "${CURRENT}" pull --ff-only origin "${GIT_REF}"
  else
    mkdir -p "${INSTALL_ROOT}"
    git clone --branch "${GIT_REF}" --depth 1 "${REPO_URL}" "${CURRENT}"
  fi
  find "${CURRENT}/ops/scripts/linux" -name '*.sh' -exec sed -i 's/\r$//' {} \;
  chmod +x "${CURRENT}/ops/scripts/linux/"*.sh
  chown -R flahaintel:flahaintel "${INSTALL_ROOT}"
}

step_env() {
  # shellcheck disable=SC1091
  source /etc/flahaintel/db-passwords.env
  local secret
  if [[ -f /etc/flahaintel/production.env ]] && grep -q 'FLAHA_SESSION_SECRET=' /etc/flahaintel/production.env; then
    echo "keeping existing /etc/flahaintel/production.env"
  else
    secret="$(openssl rand -base64 48 | tr -d '\n')"
    umask 077
    cat > /etc/flahaintel/production.env <<EOF
NODE_ENV=production
AUTH_MODE=production
DATABASE_URL=postgresql://flaha_app:${FLAHA_APP_DB_PASSWORD}@127.0.0.1:5432/flaha_intel?schema=public
API_HOST=127.0.0.1
API_PORT=3003
FLAHA_PUBLIC_HOST=${PUBLIC_HOST}
WEB_ORIGIN=https://${PUBLIC_HOST}
CORS_ORIGINS=https://${PUBLIC_HOST}
VITE_API_URL=
FLAHA_SESSION_SECRET=${secret}
SESSION_TTL_SECONDS=43200
SESSION_IDLE_SECONDS=7200
CSRF_COOKIE_NAME=flaha_csrf
CSRF_HEADER_NAME=x-flaha-csrf
ARTIFACT_STORE_ROOT=/var/lib/flahaintel/artifacts
FLAHA_ARTIFACT_ROOT=/var/lib/flahaintel/artifacts
FLAHA_STATE_DIR=/var/lib/flahaintel/state
FLAHA_WEB_ROOT=/var/lib/flahaintel/web
FLAHA_BACKUP_ROOT=/var/lib/flahaintel/backups
FLAHA_WORKER_MODE=serial
FLAHA_BACKUP_RPO_HOURS=744
FLAHA_BACKUP_DEGRADED_HOURS=912
MAX_UPLOAD_BYTES=25000000
MAX_PREVIEW_BYTES=64000
QUARANTINE_RETENTION_DAYS=30
DISK_WARN_FREE_RATIO=0.10
DISK_BLOCK_FREE_RATIO=0.05
PYTHON_BIN=/usr/bin/python3
WORKER_CONCURRENCY=1
WORKER_POLL_MS=3000
WORKER_IDLE_BACKOFF_MS=8000
WORKER_MAX_JOBS=3
WORKER_MAX_RUNTIME_MS=180000
WORKER_SHUTDOWN_MS=20000
LOG_LEVEL=info
HEALTH_TIMEOUT_MS=3000
CRAWL_POLICY_PATH=/etc/flahaintel/crawl-policy.json
RATE_LIMIT_LOGIN_PER_MINUTE=10
RATE_LIMIT_SUBMISSIONS_PER_USER_HOUR=20
RATE_LIMIT_SUBMISSIONS_PER_TENANT_HOUR=80
MAX_PAGE_SIZE=100
COLLECTION_INTERVAL_MINUTES=15
SCHEDULER_ENABLED=true
RSS_TIMEOUT_MS=15000
RSS_MAX_RESPONSE_BYTES=2000000
RSS_MAX_REDIRECTS=5
SHUTDOWN_TIMEOUT_MS=10000
FLAHA_BOOTSTRAP_TENANT_CODE=flaha-local
FLAHA_BOOTSTRAP_ADMIN_EMAIL=admin@flaha.local
NODE_OPTIONS=--max-old-space-size=384
EOF
    echo "MIGRATOR_DATABASE_URL=postgresql://flaha_migrator:${FLAHA_MIGRATOR_DB_PASSWORD}@127.0.0.1:5432/flaha_intel?schema=public" > /etc/flahaintel/migrator.env
    chmod 600 /etc/flahaintel/production.env /etc/flahaintel/migrator.env /etc/flahaintel/db-passwords.env
  fi
  cp "${CURRENT}/ops/config/crawl-policy.json" /etc/flahaintel/crawl-policy.json
  chown root:flahaintel /etc/flahaintel/production.env
  chmod 640 /etc/flahaintel/production.env
}

step_build() {
  export NODE_OPTIONS=--max-old-space-size=768
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
  chmod +x "${CURRENT}/ops/scripts/linux/"*.sh
  chown -R flahaintel:flahaintel "${INSTALL_ROOT}" /var/lib/flahaintel/web
}

step_migrate_bootstrap() {
  set -a
  # shellcheck disable=SC1091
  source /etc/flahaintel/production.env
  # shellcheck disable=SC1091
  source /etc/flahaintel/migrator.env
  # shellcheck disable=SC1091
  source /etc/flahaintel/db-passwords.env
  set +a
  cd "${CURRENT}"
  DATABASE_URL="${MIGRATOR_DATABASE_URL}" npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
  export DATABASE_URL="postgresql://flaha_app:${FLAHA_APP_DB_PASSWORD}@127.0.0.1:5432/flaha_intel?schema=public"
  ln -sfn /etc/flahaintel/production.env "${CURRENT}/.env"
  node --import tsx apps/api/src/governance/seedGovernedData.ts
  node --import tsx apps/api/src/governance/bootstrapLocal.ts
  node --import tsx apps/api/src/governance/bootstrapAcceptedRssSources.ts || true
  node --import tsx apps/api/src/governance/backfillSourceMetadata.ts || true
  node --import tsx apps/api/src/market/seedChannelsFromRegistry.ts || true
}

step_systemd() {
  cp "${CURRENT}/ops/systemd/small-host/flahaintel-api.service" /etc/systemd/system/
  cp "${CURRENT}/ops/systemd/small-host/flahaintel-pipeline.service" /etc/systemd/system/
  cp "${CURRENT}/ops/systemd/small-host/flahaintel-pipeline.timer" /etc/systemd/system/
  cp "${CURRENT}/ops/systemd/small-host/flahaintel-harvest.service" /etc/systemd/system/
  cp "${CURRENT}/ops/systemd/small-host/flahaintel-harvest.timer" /etc/systemd/system/
  cp "${CURRENT}/ops/systemd/small-host/flahaintel-backup.service" /etc/systemd/system/
  cp "${CURRENT}/ops/systemd/small-host/flahaintel-backup.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now flahaintel-api.service
  systemctl enable --now flahaintel-pipeline.timer
  systemctl enable --now flahaintel-harvest.timer
  systemctl enable --now flahaintel-backup.timer
}

step_caddy() {
  cp "${CURRENT}/ops/caddy/Caddyfile" /etc/caddy/Caddyfile
  mkdir -p /etc/systemd/system/caddy.service.d
  cat > /etc/systemd/system/caddy.service.d/flahaintel.conf <<EOF
[Service]
Environment=FLAHA_PUBLIC_HOST=${PUBLIC_HOST}
Environment=API_PORT=3003
Environment=FLAHA_WEB_ROOT=/var/lib/flahaintel/web
Environment=FLAHA_ACCESS_LOG=/var/log/flahaintel/caddy-access.log
ReadWritePaths=/var/log/flahaintel /var/lib/caddy
EOF
  chown flahaintel:flahaintel /var/log/flahaintel
  usermod -aG flahaintel caddy || true
  chmod 2775 /var/log/flahaintel
  touch /var/log/flahaintel/caddy-access.log
  chown caddy:flahaintel /var/log/flahaintel/caddy-access.log
  chmod 664 /var/log/flahaintel/caddy-access.log
  systemctl daemon-reload
  systemctl enable --now caddy
  systemctl restart caddy
}

step_smoke() {
  sleep 3
  curl -fsS --max-time 10 http://127.0.0.1:3003/health
  echo
  curl -fsS --max-time 10 http://127.0.0.1:3003/ready || true
  echo
  systemctl is-active flahaintel-api
  systemctl is-active postgresql
  systemctl is-active caddy
  systemctl list-timers 'flahaintel-*' --no-pager
}

require_root
run_step "01-swap" step_swap
run_step "02-packages" step_packages
run_step "03-user-dirs" step_user_dirs
run_step "04-firewall" step_firewall
run_step "05-clone" step_clone
run_step "06-postgres" step_postgres
run_step "07-env" step_env
run_step "08-build" step_build
run_step "09-migrate-bootstrap" step_migrate_bootstrap
run_step "10-systemd" step_systemd
run_step "11-caddy" step_caddy
run_step "12-smoke" step_smoke

echo "INSTALL COMPLETE. Measure log: ${MEASURE_LOG}"
echo "Public: https://${PUBLIC_HOST}"
echo "Login: admin@flaha.local (bootstrap). Change immediately."
