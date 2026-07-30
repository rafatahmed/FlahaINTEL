<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3N Windows Production-Like Evidence
Introduction:
Records host evidence for Gate 3N acceptance without embedding secrets or large machine reports.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Phase 3N evidence — Windows production-like

## Gate decision

| Field | Value |
|-------|--------|
| **Verdict** | **ACCEPT** |
| Date (UTC) | 2026-07-30 |
| Host | `LAPTOP-H92H2SLK` (Windows) |
| Branch | `phase-3n-windows-production-like` |
| Prior gate | Phase 3M production hardening |
| Local report (gitignored) | `.flaha-runtimes/phase-3m-residual-report.json` |
| Residual startedAt (report) | `2026-07-30T16:35:56.988Z` |
| Residual duration | ~45 s after probe/backup fixes |

## A. Repository hygiene

| Check | Result |
|-------|--------|
| Hardened `.gitignore` / `.gitattributes` | Done (`ab49378` and follow-up commit) |
| Secrets not committed | Confirmed (`.env` ignored; report under `.flaha-runtimes/`) |
| Remote `origin` | `https://github.com/rafatahmed/FlahaINTEL.git` |
| Default branch | `main` |

## B. Runtime provisioning

Command: `npm run ops:provision-verify` / `ops/scripts/provision-runtimes.ps1 -VerifyOnly`

| Probe | Result |
|-------|--------|
| Node | READY (v24.4.1) |
| Scrapy | READY (2.17.0) |
| Playwright | READY (1.61.1) |
| Chromium r1228 | READY (path + size; `--version` skipped on Windows) |
| Docling + models | READY |
| Java / Tika | READY (Java stderr version still treated ready) |
| `pg_dump` | READY (PostgreSQL 17.5) |
| `allReady` | **True** |

Artifacts (local only):

- `.flaha-runtimes/runtime-paths.env`
- `.flaha-runtimes/provision-report.json`

## C. Database bootstrap

| Step | Result |
|------|--------|
| Migrations | 7 applied; schema up to date |
| `governance:seed` | 186 classification terms + 20 organization types |
| `bootstrap:local` | Tenant `flaha-local`, admin `admin@flaha.local`, role `GOVERNANCE_ADMIN` |
| `bootstrap:rss-accepted` | 8 registry-mapped sources (7 ACCEPTED + NASA JPL REJECTED disabled) |
| `governance:backfill-sources` | Metadata backfilled for 8 sources |

## D. Residual acceptance summary

Command: `node ops/scripts/phase-3m-residual-acceptance.mjs`  
**Report verdict: `ACCEPT`**

| Area | Result |
|------|--------|
| Production auth | PASS — header auth disabled, default secret rejected, Secure/HttpOnly/SameSite, CSRF reject, session expiry, idle timeout, logout revoke, no secret leakage |
| JS website | SUCCEEDED — Playwright acquisition of `https://quotes.toscrape.com/js/`, extract → normalize → candidate APPROVED |
| Controlled crawl | SUCCEEDED — `books.toscrape.com`, pagesProcessed=4, externalLinksFollowed=0, cancel OK |
| Workers | 5 started; heartbeatsLive=5; claimProof SUCCEEDED; gracefulShutdown true |
| Backup / restore | databaseBackup PASS; artifactBackup PASS; offHostCopy PASS; restoreExit 0; governanceHistoryRestored true |
| Cleanup | validationRowsRemaining=0 |

### Documented residual (not a fail)

Promotion eligibility reports `SOURCE_POLICY_MISSING` for ad-hoc residual sources without a tenant source governance policy. Approval still succeeds; promotion remains blocked until policy is configured. This is expected governance behavior.

## E. Operational fixes recorded during Gate 3N

These fixes were required for a reliable Windows residual run:

1. **Chromium probe hang** — residual no longer runs `chrome.exe --version`; uses path existence + size (aligned with provision script).
2. **Silent core suite** — residual parent streams child stdout/stderr live.
3. **`psql` password hang** — residual sets `PGPASSWORD` from `DATABASE_URL` and default command timeouts.
4. **Disk full (`ENOSPC`)** — host C: was at 0 free; reclaimed space before re-run (~2.7–4.9 GB free at acceptance).

## F. Documentation delivered

| Document | Role |
|----------|------|
| `docs/ingestion/phase-3n-windows-production-like.md` | Scope and commands |
| `docs/ingestion/gate-3n-acceptance-checklist.md` | Checklist |
| `docs/ingestion/phase-3n-evidence.md` | This evidence record |
| `AGENTS.md` / `README.md` | Phase 3 product reality |

## G. Promote

| Step | Status |
|------|--------|
| Acceptance commit on `phase-3n-windows-production-like` | This release |
| Merge / fast-forward to `main` | This release |
| Tag `v0.5.0-phase-3n-windows-production-like` | This release |
| Push branch, main, tag | This release |

## Operator notes

- Bootstrap admin defaults: email `admin@flaha.local`, tenant code `flaha-local` (override with `FLAHA_BOOTSTRAP_*`).
- Production secrets remain outside the repo (`ops/config/production.env.example` only).
- Re-run residual after significant ops changes; keep local reports under `.flaha-runtimes/` (gitignored).
