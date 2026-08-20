<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Small-host update, migrate, and live inventory
Introduction:
How to update intel.flaha.org after code changes, apply Prisma migrations,
and what lives only on the droplet (not in git).

Created by: Rafat Al Khashan
Created date: 2026-08-19
Last modified: 2026-08-19
-->

# Small-host update, migrate, and live inventory

**Host:** DigitalOcean droplet `Flaha-Intel` (`593421535`) · nyc1 · `s-2vcpu-2gb-90gb-intel`  
**Public:** https://intel.flaha.org (`A` + `AAAA` on `intel.flaha.org`)  
**SSH:** `root@67.205.137.148` (key `~/.ssh/rafat`)  
**Git on host:** `/opt/flahaintel/current` must track **`origin/main`**  
**Related:** `small-host-2g-full.md` · `docs/markets/harvest-lookback-qa-jo.md`

Do **not** run `install-small-host.sh` again on a live box. That script is first boot only. Updates use `update-small-host.sh`.

---

## 1. What git owns vs what the server owns

| Path | In git? | Rule |
|------|---------|------|
| `/opt/flahaintel/current` | Yes (clone of `main`) | `git pull --ff-only` only. Never force-push from the droplet. |
| `/etc/flahaintel/production.env` | **No** | Secrets + host paths. Update keys by hand. Never commit. |
| `/etc/flahaintel/migrator.env` | **No** | Migrator `DATABASE_URL` (no `?schema=` for `pg_dump`). |
| `/etc/flahaintel/db-passwords.env` | **No** | App + migrator passwords. |
| `/etc/flahaintel/crawl-policy.json` | Copy from repo | Replace only when crawl policy in git changes. |
| `/opt/flahaintel/runtimes/` | **No** | Java/Tika/Scrapy/Playwright/Chromium. Re-provision with `--runtimes`. |
| `/var/lib/flahaintel/artifacts` | **No** | Immutable ArtifactStore. |
| `/var/lib/flahaintel/intakes` | **No** | Submit file land (`FLAHA_INTAKE_ROOT`). API cannot write under `/opt/flahaintel/current`. |
| `/var/lib/flahaintel/state` | **No** | `last-backup.json`, `pipeline-heartbeat.json`, sessions. |
| `/var/lib/flahaintel/web` | Built | `rsync` from `apps/web/dist` on each update. |
| `/var/lib/flahaintel/backups` | **No** | Monthly (1st, 03:00 UTC) dumps. Copy off-host when you trust the host. |
| `/etc/systemd/system/flahaintel-*` | Copied from `ops/systemd/small-host/` | Re-copy on unit changes, then `daemon-reload`. |
| `/etc/caddy/Caddyfile` | Copied | Env: `FLAHA_PUBLIC_HOST=intel.flaha.org`. |
| Swap `/swapfile` 2 GiB | Host | Required. Do not remove. |

---

## 2. Update / migrate (normal code change)

From your laptop, after `main` has the commit:

```bash
ssh -i ~/.ssh/rafat root@67.205.137.148
bash /opt/flahaintel/current/ops/scripts/linux/update-small-host.sh
```

That script, in order:

1. Coordinated backup (`pg_dump` + artifacts tar + `last-backup.json`)  
2. `git fetch` + `git pull --ff-only origin main`  
3. `npm ci` + Prisma generate + package builds + Vite web build  
4. `prisma migrate deploy` as **migrator** (not `flaha_app`)  
5. Restart `flahaintel-api` and kick one serial pipeline  
6. Smoke `/health` and `/ready`

Flags:

```text
--skip-backup     only if you just backed up
--runtimes        also re-run provision-runtimes.sh (Chromium/Tika/Scrapy)
```

### New Prisma migration

1. Land the migration on `main` (`apps/api/prisma/migrations/<stamp>_…`).  
2. Run `update-small-host.sh` (step 4 applies it).  
3. If migrate fails: do **not** hand-edit production SQL. Restore from `/var/lib/flahaintel/backups/<stamp>/postgres.dump` and fix the migration on a branch.

### New systemd unit or Caddy change

`update-small-host.sh` already copies `ops/systemd/small-host/*`.  
Caddy site name is `FLAHA_PUBLIC_HOST` in `/etc/systemd/system/caddy.service.d/flahaintel.conf`. After DNS change: set that + `WEB_ORIGIN` / `CORS_ORIGINS` in `production.env`, `systemctl daemon-reload && systemctl restart caddy flahaintel-api`.

### Engine / runtime change

```bash
bash /opt/flahaintel/current/ops/scripts/linux/update-small-host.sh --runtimes
```

Pins (from `ops/scripts/provision-runtimes.ps1` / Linux provisioner): Scrapy 2.17.0 · Playwright 1.61.1 · Chromium r1228 · Tika 3.3.1 · Java 21.

To drop leftover Docling disk (~5 GB) after code update:

```bash
sed -i '/^DOCLING_/d' /etc/flahaintel/production.env
# if PYTHON_BIN still points at the Docling venv:
sed -i 's|^PYTHON_BIN=.*|PYTHON_BIN=/opt/flahaintel/runtimes/scrapy/bin/python|' /etc/flahaintel/production.env
rm -rf /opt/flahaintel/runtimes/docling /opt/flahaintel/runtimes/docling-models
systemctl restart flahaintel-api
```

---

## 3. Live inventory (2026-08-19)

Recorded after first production-like install. Re-check after each update.

| Item | Value |
|------|--------|
| Droplet | `Flaha-Intel` · 2 vCPU Premium Intel · 2 GB RAM · 90 GB disk · Ubuntu 24.04 |
| Swap | 2 GiB `/swapfile`, swappiness 20 |
| Always on | `postgresql` · `flahaintel-api` (loopback `:3003`) · `caddy` (TLS) |
| Timers | pipeline every 15 min · harvest 05:30 UTC · backup **1st of month** 03:00 UTC |
| Worker mode | `FLAHA_WORKER_MODE=serial` — never five persistent worker daemons |
| Pipeline memory | `MemoryMax=1400M` (Chromium one family at a time) |
| API memory | `MemoryMax=450M` |
| Public host | `intel.flaha.org` (Let’s Encrypt) |
| Runtimes disk | Chromium/Playwright ~0.66 G · Scrapy 96 M · Tika 63 M (Docling trees may be deleted) |

**Bootstrap identity (change when you add a real operator):** tenant `flaha-local`; sign in with `admin@flaha.local` and tenant code `flaha-local`, or with the membership user UUID and tenant UUID. No password.

### Sign in (live web)

Public UI: `https://intel.flaha.org`

| Field | Value |
|-------|--------|
| Email or user ID | `admin@flaha.local` |
| Tenant code or tenant ID | `flaha-local` |

UUIDs also work (printed by `bootstrap:local` on the host). There is no password. Production rejects development `X-Flaha-User-Id` / `X-Flaha-Tenant-Id` headers.

To reprint live UUIDs without changing membership:

```bash
ssh -i ~/.ssh/rafat root@67.205.137.148
sudo -u postgres psql -d flaha_intel -c "SELECT u.id AS user_id, u.email, t.id AS tenant_id, t.code FROM \"UserAccount\" u JOIN \"TenantMembership\" m ON m.\"userId\"=u.id JOIN \"Tenant\" t ON t.id=m.\"tenantId\" WHERE u.email='admin@flaha.local';"
```

### Sign out

Use **Sign out** in any of:

- the top header (right of **System READY**)
- the sidebar footer
- **Settings → Session**

That calls `POST /api/auth/logout` (revokes the session id, clears cookies) and drops `flaha.product.auth` in the browser. Email and tenant code stay as login hints for the next sign-in.

### Website Submit (Eyes)

Submit → **Website (Eyes)** lands a URL, then the **serial pipeline** acquires → extracts → normalizes → opens a Governance candidate.

- Jobs sitting in **READY** are waiting for `flahaintel-pipeline.timer` (every 15 minutes). Do **not** start `npm run worker:*` on this host.
- Run one tick now: `systemctl start flahaintel-pipeline.service`
- Intake **PROMOTED** means queued, not finished. Human **Approve** in Governance is the product end-state (**VAULTED** in Content). RSS promotion eligibility does not apply.
- Production only accepts **allowlisted** hosts/paths in `ops/config/crawl-policy.json` (copied to `/etc/flahaintel/crawl-policy.json` on update). Current Eyes hosts: MoCI, Mahaseel, Amman market, Yara `/corporate-releases/`. Adding a new site is an allowlist change, not a free crawl.

---

## 4. DigitalOcean host monitor vs Flaha readiness

They answer different questions. Keep both.

| Signal | Where | Meaning |
|--------|--------|---------|
| CPU / memory / disk % | **DigitalOcean** Graphs + Alerts | Kernel/host pressure (noisy neighbor, swap storm, disk fill) |
| DiskCapacity | Flaha Settings readiness | App gate: warn 10% free, block 5% (`DISK_*_FREE_RATIO`) |
| BackupRecency | Flaha | `last-backup.json` ≤ **31 days** on this trial host (`FLAHA_BACKUP_RPO_HOURS=744`) |
| WorkerLoops | Flaha | Serial: `pipeline-heartbeat.json` ≤ 45 min |
| Engine probes | Flaha | Binary actually ran (`--version` / Tika `--help`) |

Recommended DigitalOcean alerts on this droplet:

- **CPU** ≥ 80% for 10 minutes (harvest will spike; 10 min avoids false pages)  
- **Memory** ≥ 90% for 5 minutes (2 GB + swap is the safety net)  
- **Disk** ≥ 80% used (backups grow)  
- Optional: droplet **down** / ping

Flaha Settings **overall READY** does **not** replace DO graphs. A 100% CPU harvest can still be READY in-app.

---

## 5. Readiness scoring (hardened)

Overall is **not** “any yellow chip.” Rules (`apps/api/src/product/readinessRollup.ts`):

1. **API / PostgreSQL / ArtifactStore UNAVAILABLE** → overall **UNAVAILABLE**.  
2. **NOT_CONFIGURED** never drives overall (engines not installed yet).  
3. **DEGRADED / UNAVAILABLE on a configured engine** (path set but probe failed) **does** degrade overall.  
4. **BackupRecency**, **JobQueue**, **DiskCapacity**, **WorkerLoops** (serial overdue) **do** degrade overall.  
5. Serial workers are READY only if `pipeline-heartbeat.json` is newer than 45 minutes (`FLAHA_PIPELINE_STALE_MS`).

Refresh Settings after an update. Hard-reload if you still see an old overall.

---

## 6. Emergency

| Problem | Action |
|---------|--------|
| Bad deploy | `git -C /opt/flahaintel/current log -5`; `git checkout <previous>`; rerun build+restart from update script mentally, or restore backup |
| Postgres | `pg_restore` from `/var/lib/flahaintel/backups/<stamp>/postgres.dump` (migrator role) |
| Disk full | `ops/runbooks/disk-full.md`; prune old backups **after** off-host copy |
| API loop | `journalctl -u flahaintel-api -n 80`; confirm `API_HOST=127.0.0.1` |
| Harvest miss | MoCI is today-only. `systemctl start flahaintel-harvest.service` when the box is up |

---

## 7. Do not

- Run five `flahaintel-worker@*` daemons on this size.  
- Point `main` at an old commit and `git pull` without checking `git log origin/main`.  
- Store the only backup on this 90 GB disk.  
- Re-run `install-small-host.sh` (it will fight existing Postgres/roles).  
- Commit `/etc/flahaintel/production.env`.
