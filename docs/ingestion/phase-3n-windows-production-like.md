<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3N Windows Production-Like Deployment
Introduction:
Defines scope, topology, acceptance, and evidence for running FlahaINTEL
production-like on a single Windows host after Phase 3M hardening.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Phase 3N — Windows Production-Like Deployment

## Status

**Gate verdict: ACCEPT (2026-07-30).** Evidence: `docs/ingestion/phase-3n-evidence.md`.

Phase 3N proves that the Phase 3M production-hardening stack runs as a
**production-like controlled deployment on Windows**, using the existing
pinned runtimes, PowerShell ops scripts, PostgreSQL, ArtifactStore, and
worker processes.

**Branch:** `phase-3n-windows-production-like`  
**Prior gate:** Phase 3M production hardening (`phase-3m-production-hardening`)  
**Baseline product:** Phase 3L operational shell over 3G–3K pipeline  
**Release tag:** `v0.5.0-phase-3n-windows-production-like`  


## Purpose

3M delivered production topology, fail-closed config, auth, workers, backup
scripts, runbooks, and CI. 3N is the **Windows host acceptance gate**:

1. Provision and probe pinned runtimes on Windows.
2. Bootstrap a usable local database (taxonomy, tenant/user, optional RSS).
3. Run residual acceptance (runtimes, workers, controlled crawl, prod auth, backup).
4. Align repository documentation with Phase 3 product reality.
5. Record evidence and promote accepted work to `main` with a release tag.

## Non-goals

Phase 3N does **not**:

- expand intelligence product scope (no embeddings, AI classification, OCR, PPTX);
- enable unrestricted crawling or public self-service onboarding;
- claim multi-host HA or cloud object storage;
- replace Linux systemd units with a full Windows Service installer (Task
  Scheduler / manual process supervision is acceptable for this gate);
- automatically publish approved content;
- re-onboard external RSS publishers without registry discipline.

## Windows topology (production-like)

```text
Operator browser
  → optional Caddy (TLS) or direct loopback for local acceptance
      → static Vite build (apps/web/dist)
      → /api/* → 127.0.0.1:API_PORT (Fastify)
API process (loopback only in production AUTH_MODE)
PostgreSQL 16/17 on localhost
ArtifactStore under host path (default .flaha-artifacts-prod, gitignored)
FLAHA_STATE_DIR for session revocation and worker heartbeats
Workers (separate OS processes, no TCP listeners):
  acquisition | extraction | normalization | submission-advance | stale-recovery
Pinned runtimes under .benchmark-* / .flaha-runtimes (gitignored)
Backups under .flaha-backups / .flaha-backups-offhost (gitignored)
```

## Required host prerequisites

| Component | Windows expectation |
|-----------|---------------------|
| Node.js | ≥ 20 (verified 24.x acceptable) |
| npm | Workspace install from repo root |
| PostgreSQL | Local `flaha_intel` with migrations applied |
| Python | Pinned Scrapy/Docling envs (benchmark-isolated) |
| Java | Pinned JRE for Tika |
| Chromium | Playwright r1228 under ms-playwright |
| PowerShell | 5.1+ for ops scripts |

## Commands (canonical)

### 1. Provision / verify runtimes

```powershell
powershell -NoProfile -File ops\scripts\provision-runtimes.ps1
powershell -NoProfile -File ops\scripts\provision-runtimes.ps1 -VerifyOnly
```

Writes:

- `.flaha-runtimes/runtime-paths.env` (paths only; no secrets)
- `.flaha-runtimes/provision-report.json`

### 2. Bootstrap database

```powershell
# From repo root with .env DATABASE_URL set
npm run prisma:generate
npm run prisma:status --workspace=@flaha-intel/api
npm run governance:seed --workspace=@flaha-intel/api
npm run bootstrap:local --workspace=@flaha-intel/api
# Optional: accepted RSS sources with registry UUIDs, then metadata backfill
npm run bootstrap:rss-accepted --workspace=@flaha-intel/api
npm run governance:backfill-sources --workspace=@flaha-intel/api
```

### 3. Residual acceptance

```powershell
# Loads .flaha-runtimes/runtime-paths.env and .env
node ops/scripts/phase-3m-residual-acceptance.mjs
```

Writes (gitignored):

- `.flaha-runtimes/phase-3m-residual-report.json`

Human summary is recorded under:

- `docs/ingestion/phase-3n-evidence.md`

### 4. Smoke (API already running)

```powershell
powershell -NoProfile -File ops\scripts\smoke-test.ps1
```

## Acceptance criteria

See `docs/ingestion/gate-3n-acceptance-checklist.md`.

Minimum verdict for gate close:

| Area | Pass condition |
|------|----------------|
| Runtimes | provision `allReady=true` (or documented residual with workaround) |
| Migrations | Prisma reports all migrations applied |
| Seed | Classification terms + org types present |
| Bootstrap | Active tenant + GOVERNANCE_ADMIN user exist |
| Residual | Report `verdict` is `ACCEPT`, or `CONTINUE` with listed residuals only |
| Docs | `AGENTS.md` and `README.md` describe Phase 3 product + 3N |
| Git | Hardened ignore/attributes; no secrets committed; `main` is default |

## Relationship to other phases

| Phase | Relationship |
|-------|----------------|
| 3L | Product shell (API + web) consumed as-is |
| 3M | Production hardening consumed as-is; residual script reused |
| 3N | Windows host proof + bootstrap + documentation truth |
| Post-3N | Optional OCR, intelligence workflows, multi-host — separate approvals |

## Protected paths

Do not change during 3N without explicit approval:

- RSS fingerprint and collection accounting semantics
- Prisma migrations already applied (additive only if a new migration is approved)
- Worker JSONL contracts and sole-DB-writer rule
- Benchmark corpus byte stability

## Stop conditions

Stop and report if:

- residual acceptance requires production code changes beyond docs/bootstrap/ops;
- secrets would need to be committed;
- destructive DB reset is requested;
- scope expands into AI, OCR, or unrestricted crawl.
