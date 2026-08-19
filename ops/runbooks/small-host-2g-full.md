<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Small-host full stack (2 vCPU / 2 GB / 90 GB)
Introduction:
How to install and operate the full FlahaINTEL vault on a constrained
DigitalOcean droplet: serial workers, swap, loopback API, Caddy TLS.

Created by: Rafat Al Khashan
Created date: 2026-08-19
Last modified: 2026-08-19
-->

# Small-host full stack (2 vCPU / 2 GB / 90 GB)

**Status:** BINDING for droplet `Flaha-Intel` (slug `s-2vcpu-2gb-90gb-intel`).  
**Branch:** deploy **`main`** only after it is fast-forwarded to the product tip.

## What “full” means on 2 GB

Always on: PostgreSQL + Fastify (loopback) + Caddy + RSS scheduler.  
Serial (timer): one worker family at a time; daily `markets:harvest`.  
Engines (installed, not daemons): Scrapy, Playwright/Chromium, Docling, Java/Tika under `/opt/flahaintel/runtimes`. Never five persistent worker loops.

**Updates and migrations:** `ops/runbooks/small-host-update-and-migrate.md` — do not re-run this installer on a live host.

## Install (root)

```bash
export FLAHA_PUBLIC_HOST=intel.flaha.org
export GIT_REF=main
curl -fsSL https://raw.githubusercontent.com/rafatahmed/FlahaINTEL/main/ops/scripts/linux/install-small-host.sh | bash
# or after clone:
# bash /opt/flahaintel/current/ops/scripts/linux/install-small-host.sh
```

Measure log: `/var/log/flahaintel/install-measure.log`

## After install

| Check | Command |
|-------|---------|
| Health | `curl -sS http://127.0.0.1:3003/health` |
| Public | `https://intel.flaha.org` |
| Harvest now | `systemctl start flahaintel-harvest.service` |
| Timers | `systemctl list-timers 'flahaintel-*'` |

Bootstrap admin: sign in at `https://intel.flaha.org` with email `admin@flaha.local` and tenant code `flaha-local` (or the user/tenant UUIDs from `bootstrap:local`). No password. Use **Sign out** in the header, sidebar, or Settings. Change the bootstrap email when you add a real operator.

Lookback rules: `docs/markets/harvest-lookback-qa-jo.md` (MoCI daily only; Amman ≤ 3-day windows).
