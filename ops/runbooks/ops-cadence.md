<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Operational Cadence Runbook
Introduction:
Weekly and monthly operator checks after Phase 3N so backbone health stays boring.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Operational cadence (post–Phase 3N)

Aligned with program backlog **E1-T3** and final product lock (keep backbone healthy).

## Daily (automated preferred)

| Check | How |
|-------|-----|
| Backup | Task Scheduler runs `ops/scripts/backup.ps1`; off-host copy |
| Free space | `ops/scripts/check-free-space.ps1` or host monitoring |
| API | `ops/scripts/smoke-test.ps1` if API is supposed to be up |

## Weekly

| Check | Command / action |
|-------|------------------|
| Provision verify | `npm run ops:provision-verify` |
| Prisma migrations | `npm run prisma:status --workspace=@flaha-intel/api` |
| Free space | `ops/scripts/check-free-space.ps1` — target ≥15% free on OS + artifact volumes |
| last-backup age | Read `FLAHA_STATE_DIR/last-backup.json` — age ≤ 24 h (RPO) |
| Alerts | Review `ops/alerts/alert-rules.json` conditions that fired |

## Monthly

| Check | Command / action |
|-------|------------------|
| Residual acceptance | `npm run ops:residual-acceptance` (needs free disk + runtimes) |
| Restore drill (optional quarterly) | [backup-restore.md](./backup-restore.md) isolated restore |
| Dependency / security notes | See program charter T-SEC |

## When residual fails

1. Check free disk first (`ENOSPC` was a real 3N incident)
2. Re-run provision verify
3. Capture report under `.flaha-runtimes/` (gitignored)
4. Do not claim production health until residual or equivalent smoke is green

## Program tracking

Update task status in `docs/program/flahaintel-program-frame-audit-plan-backlog.md` when cadence is institutionalized on a host.
