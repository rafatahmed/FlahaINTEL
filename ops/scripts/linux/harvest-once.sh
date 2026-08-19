#!/usr/bin/env bash
# Flaha Agri Tech
# Precision Agriculture Division
# Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
#
# Title: Market harvest once (small host)
# Introduction: Cadence-aware harvest for due channels; --force is reserved for operator catch-up.
#
# Created by: Rafat Al Khashan
# Created date: 2026-08-19
# Last modified: 2026-08-19

set -euo pipefail
cd /opt/flahaintel/current/apps/api
export NODE_ENV="${NODE_ENV:-production}"
exec /usr/bin/node --import tsx src/market/harvest/cli.ts
