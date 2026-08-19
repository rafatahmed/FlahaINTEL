<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3M Production Hardening and Deployment Readiness
Introduction:
Documents production topology, configuration, workers, security, backup, and operations.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-08-19
-->

# Phase 3M — Production Hardening and Deployment Readiness

## Status

Phase 3M implements controlled production readiness on branch `phase-3m-production-hardening`.

**Non-goals:** unrestricted crawling, automatic publication, embeddings, semantic search, AI summarization/classification, OCR, PPTX support, billing, public self-service onboarding.

## Topology (single host, process isolation)

```text
Internet
  → Caddy (TLS, security headers, size limits)
      → /           static Vite build
      → /api/*      127.0.0.1:API_PORT
      → /health|/ready  loopback API
API (loopback only)
PostgreSQL (least-privilege app role)
ArtifactStore volume
Workers (separate OS processes, no TCP listeners):
  acquisition | extraction | normalization | submission-advance | stale-recovery
Host logs + off-host backups
```

## Configuration

Strict loader: `apps/api/src/production/config.ts`.

Production fails closed when secrets are default/weak, API bind is non-loopback, artifact roots conflict, or required settings are missing.

Template: `ops/config/production.env.example`.

Canonical artifact root: `ARTIFACT_STORE_ROOT` (must equal `FLAHA_ARTIFACT_ROOT` when both set).

## Authentication

- `AUTH_MODE=production` disables `X-Flaha-User-Id` / `X-Flaha-Tenant-Id` headers.
- Sign-in: `POST /api/auth/session` with email + tenant code **or** user UUID + tenant UUID (membership-verified; no password).
- Signed session cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Session TTL + idle timeout; `POST /api/auth/logout` revokes the sid (file-backed list) and clears cookies.
- CSRF for mutating cookie/session requests (`x-flaha-csrf` / CSRF cookie).
- Membership + role checks unchanged; actor IDs never trusted from bodies.

## Worker loops

```text
npm run worker:acquisition --workspace=@flaha-intel/api
npm run worker:extraction --workspace=@flaha-intel/api
npm run worker:normalization --workspace=@flaha-intel/api
npm run worker:submission-advance --workspace=@flaha-intel/api
npm run worker:stale-recovery --workspace=@flaha-intel/api
```

Bounded poll/backoff, max jobs per process, heartbeats for readiness, graceful SIGINT/SIGTERM. Uses existing PostgreSQL claim/lease (no new queue).

## Controlled crawl policy

`ops/config/crawl-policy.json` — exact hosts, path prefixes, max 10 pages, depth ≤1, attachment and byte caps, identifiable UA. No unrestricted mode.

## Reverse proxy

`ops/caddy/Caddyfile` — TLS, HSTS, security headers, body limits, access logs, loopback upstream only.

## Database

`ops/postgres/01-roles.sql` — `flaha_app` least privilege, `flaha_migrator` for migrations. Runtime must not use superuser.

## Artifacts

Dedicated root, permission checks on readiness, free-space warn/block thresholds, quarantine retention config, reconciliation via ArtifactStore APIs, coordinated backup with DB.

## Observability

- Structured ops logs: correlation, submission/job/attempt/tenant, safe error codes.
- Metrics: `GET /api/system/metrics` (settings role), counters/latencies in-process.
- Alerts: `ops/alerts/alert-rules.json`.

## Backup / recovery

Scripts: `ops/scripts/backup.ps1`, `ops/scripts/restore.ps1`.

**RPO ≤ 24h · RTO ≤ 4h**. Off-host copy required. Quarterly restore test procedure in runbooks.

## Deploy / rollback

Explicit approval flags only. `ops/scripts/deploy.ps1`, `ops/scripts/rollback.ps1`, `ops/scripts/smoke-test.ps1`. Immutable release directories.

## CI

`.github/workflows/ci.yml` — build, test, prisma validate, lockfile, secret scan, package listing. No deploy credentials on PRs.

## Runbooks

`ops/runbooks/` — deploy, rollback, failures, disk, artifacts, backup, compromise, emergency shutdown.

## Prisma

**Phase 3M product migration: NONE.** No secrets in PostgreSQL.

## Acceptance focus

Production-like controlled sources: static site, JS site, PDF/DOCX/RTF|TXT, depth 0–1 crawl ≤10 pages; full chain through promotion eligibility; cancellation; zero staging residue and orphan processes.

## Relationship

3L delivered the product shell. 3M hardens production operations without expanding product intelligence scope.
