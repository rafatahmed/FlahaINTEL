<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 3N Acceptance Checklist
Introduction:
Checklist for Windows production-like acceptance of FlahaINTEL after Phase 3M.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-08-20
-->

# Gate 3N acceptance checklist

Work on branch `phase-3n-windows-production-like` from accepted Phase 3M.

**Gate decision (2026-07-30): ACCEPT** — see `docs/ingestion/phase-3n-evidence.md`.

## A. Repository and branch hygiene

- [x] Clean working tree before acceptance evidence commit (or only docs/evidence changes)
- [x] `.gitignore` excludes secrets, artifacts, runtimes, backups, caches
- [x] `.gitattributes` enforces LF for source and binary rules for corpus
- [x] Remote `origin` configured; `main` exists and is GitHub default branch
- [x] No real `.env` secrets committed

## B. Runtime provisioning (Windows)

- [x] `ops/scripts/provision-runtimes.ps1` run (or `-VerifyOnly` after prior provision)
- [x] `.flaha-runtimes/runtime-paths.env` generated
- [x] `.flaha-runtimes/provision-report.json` shows runtimes ready
- [x] Node, Scrapy, Playwright, Chromium, Tika/Java, `pg_dump` probed (Docling later rejected; not re-probed)

## C. Database

- [x] PostgreSQL reachable; database `flaha_intel`
- [x] `prisma migrate status` reports all migrations applied
- [x] `governance:seed` completes (classification terms + organization types)
- [x] `bootstrap:local` creates/upserts default tenant + admin user
- [x] Optional: accepted RSS sources bootstrapped + `governance:backfill-sources`

## D. Residual acceptance

- [x] `node ops/scripts/phase-3m-residual-acceptance.mjs` executed on this host
- [x] Report written under `.flaha-runtimes/phase-3m-residual-report.json` (local only)
- [x] Summary captured in `docs/ingestion/phase-3n-evidence.md`
- [x] Verdict `ACCEPT`, or `CONTINUE` with explicit residual list and owner decision

Residual script covers (from 3M design):

- Runtime probes
- Worker start/heartbeat/shutdown families
- Controlled JS site / crawl policy paths as implemented
- Production auth session/CSRF path
- Backup dump + off-host copy path check
- Cleanup of acceptance residue

## E. Documentation

- [x] `docs/ingestion/phase-3n-windows-production-like.md` present
- [x] This checklist present
- [x] `docs/ingestion/phase-3n-evidence.md` present with host evidence
- [x] `AGENTS.md` reflects Phase 3 + 3N status
- [x] `README.md` describes product shell, not RSS-only MVP alone

## F. Promote

- [x] Acceptance commit on `phase-3n-windows-production-like`
- [x] Merged or fast-forwarded to `main`
- [x] Annotated tag `v0.5.0-phase-3n-windows-production-like` (or agreed version)
- [x] Pushed branch, main, and tag to `origin`

## Gate decision

| Field | Value |
|-------|--------|
| Date | 2026-07-30 |
| Host | LAPTOP-H92H2SLK (Windows) |
| Verdict | **ACCEPT** |
| Decided by | Phase 3N residual suite + operator promotion |
| Notes | See `phase-3n-evidence.md`. Promotion eligibility blocked without source policy is expected. |
