#!/usr/bin/env bash
# Flaha Agri Tech
# Precision Agriculture Division
# Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
#
# Title: Linux runtime provision (Chromium, Docling, Tika, Scrapy)
# Introduction: Installs pinned 3M engines under /opt/flahaintel/runtimes and writes production.env paths.
#
# Created by: Rafat Al Khashan
# Created date: 2026-08-19
# Last modified: 2026-08-19
#
# Pins: scrapy 2.17.0 · playwright 1.61.1 · chromium r1228 · docling-slim 2.111.0 · tika 3.3.1 · Java 21

set -euo pipefail
ROOT="${INSTALL_ROOT:-/opt/flahaintel/current}"
RT="${FLAHA_RUNTIME_ROOT:-/opt/flahaintel/runtimes}"
ENV_FILE="${ENV_FILE:-/etc/flahaintel/production.env}"
MEASURE_LOG="${MEASURE_LOG:-/var/log/flahaintel/runtime-provision.log}"
export DEBIAN_FRONTEND=noninteractive
mkdir -p "${RT}" /var/log/flahaintel
touch "${MEASURE_LOG}"

step() {
  local name="$1"; shift
  echo "========== ${name} start $(date -u +%FT%TZ) ==========" | tee -a "${MEASURE_LOG}"
  free -h | awk '/Mem:|Swap:/ {print}' | tee -a "${MEASURE_LOG}"
  df -h / | awk 'NR==2' | tee -a "${MEASURE_LOG}"
  local t0
  t0=$(date +%s)
  "$@"
  echo "========== ${name} end duration_s=$(( $(date +%s) - t0 )) ==========" | tee -a "${MEASURE_LOG}"
}

set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
  else
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}

step 01-apt bash -c '
  apt-get update -qq
  apt-get install -y -qq openjdk-21-jre-headless python3-venv python3-dev python3-pip wget ca-certificates
'

JAVA_BIN="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")/bin/java"
if [[ ! -x "${JAVA_BIN}" ]]; then JAVA_BIN="$(command -v java)"; fi

step 02-tika bash -c "
  mkdir -p '${RT}/tika'
  if [[ ! -f '${RT}/tika/tika-app-3.3.1.jar' ]]; then
    wget -q -O '${RT}/tika/tika-app-3.3.1.jar' \
      'https://repo1.maven.org/maven2/org/apache/tika/tika-app/3.3.1/tika-app-3.3.1.jar'
  fi
  \"${JAVA_BIN}\" -jar '${RT}/tika/tika-app-3.3.1.jar' --help >/dev/null
"

step 03-scrapy bash -c "
  python3 -m venv '${RT}/scrapy'
  '${RT}/scrapy/bin/pip' install --quiet 'scrapy==2.17.0'
  '${RT}/scrapy/bin/scrapy' version
"

step 04-docling bash -c "
  python3 -m venv '${RT}/docling'
  '${RT}/docling/bin/pip' install --quiet --upgrade pip
  '${RT}/docling/bin/pip' install --quiet 'docling-slim[format-pdf,models-local]==2.111.0' || \
    '${RT}/docling/bin/pip' install --quiet 'docling==2.111.0'
  mkdir -p '${RT}/docling-models'
  HF_HOME='${RT}/docling-models' TRANSFORMERS_CACHE='${RT}/docling-models' \
    '${RT}/docling/bin/python' -c 'import docling; print(docling.__version__ if hasattr(docling,\"__version__\") else \"ok\")'
"

step 05-playwright bash -c "
  mkdir -p '${RT}/playwright' '${RT}/ms-playwright'
  cd '${RT}/playwright'
  npm init -y >/dev/null
  npm install --omit=dev playwright@1.61.1
  export PLAYWRIGHT_BROWSERS_PATH='${RT}/ms-playwright'
  npx playwright install-deps chromium || true
  npx playwright install chromium
  npx playwright --version
"

CHROME="$(find "${RT}/ms-playwright" -type f -name chrome -path '*chromium-*' | head -n 1)"
if [[ -z "${CHROME}" ]]; then
  CHROME="$(find "${RT}/ms-playwright" -type f -name chrome-headless-shell | head -n 1)"
fi
TIKA_ALLOW="${ROOT}/benchmarks/ingestion/config/document-tika-parser-allowlist.xml"
PW_CLI="${RT}/playwright/node_modules/.bin/playwright"
PW_MODULE="${RT}/playwright/node_modules/playwright"

set_env JAVA_BIN "${JAVA_BIN}"
set_env TIKA_JAR "${RT}/tika/tika-app-3.3.1.jar"
set_env TIKA_ALLOWLIST "${TIKA_ALLOW}"
set_env PYTHON_BIN "${RT}/docling/bin/python"
set_env DOCLING_PYTHON "${RT}/docling/bin/python"
set_env DOCLING_CACHE_PATH "${RT}/docling-models"
set_env SCRAPY_PYTHON "${RT}/scrapy/bin/python"
set_env SCRAPY_BIN "${RT}/scrapy/bin/scrapy"
set_env PLAYWRIGHT_CLI "${PW_CLI}"
set_env PLAYWRIGHT_MODULE "${PW_MODULE}"
set_env PLAYWRIGHT_BROWSERS_PATH "${RT}/ms-playwright"
if [[ -n "${CHROME}" ]]; then set_env PLAYWRIGHT_CHROMIUM_PATH "${CHROME}"; fi

mkdir -p "${ROOT}/.benchmark-runtime/browser-playwright-1.61.1"
ln -sfn "${RT}/playwright/node_modules" "${ROOT}/.benchmark-runtime/browser-playwright-1.61.1/node_modules"
chown -R flahaintel:flahaintel "${RT}" "${ROOT}/.benchmark-runtime" || true

echo "Provision complete. Chromium=${CHROME}"
"${JAVA_BIN}" -version
"${RT}/scrapy/bin/scrapy" version
"${RT}/docling/bin/python" -c 'import docling; print("docling-ok")'
[[ -n "${CHROME}" ]] && "${CHROME}" --version || true
"${PW_CLI}" --version
