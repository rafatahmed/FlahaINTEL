<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3L FlahaINTEL API and Web Application
Introduction:
Defines the operational product shell over acquisition, extraction, normalization, and governance.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-08-19
-->

# Phase 3L — FlahaINTEL API and Web Application

## Product scope

Phase 3L exposes the completed pipeline as an internal operational application:

```text
submit website or document
→ acquisition or input artifact
→ extraction
→ normalization
→ governance candidate
→ analyst review
→ promotion eligibility
```

**Non-goals:** public publication, unrestricted crawling, embeddings, semantic search, AI summarization, entity extraction, classification, sentiment, OCR, PPTX, billing, public onboarding, production deployment automation.

## Navigation

```text
Dashboard · Sources · Submit · Jobs · Content · Governance · Artifacts · Settings
```

## Submission orchestration

`SubmissionOrchestrator` preserves stage authority (3H/3I/3J/3K/3G). Modes:

- `AUTO_CHAIN` — start next stage only after verified success
- `MANUAL_STAGE` — wait for explicit advance

Durable `ProductSubmission` + `ProductSubmissionStage` rows track the chain. Failures never create false downstream success.

## Website workflow

Exact governed URL → private/credential rejection → acquisition job → optional chain to extraction → normalization → governance candidate.

## Upload workflow

Bounded multipart upload → ArtifactStore INPUT → extraction → normalization → candidate.

Supported: PDF, DOCX, RTF, TXT. **PPTX rejected before processing.**

## Unified API

Routes under `/api` include submissions, jobs, content, artifacts, dashboard, system readiness, auth session, plus existing governance and sources.

## Authentication

- Internal signed session cookie / Bearer token (`POST /api/auth/session`)
- Sign-in body is either membership **user UUID + tenant UUID**, or **email + tenant code** (case-insensitive). No password and no external IdP.
- `POST /api/auth/logout` revokes the session id and clears the session/CSRF cookies. The web shell **Sign out** control (header, sidebar, Settings) always drops local storage even if the API call fails.
- Production (`AUTH_MODE=production`) rejects `X-Flaha-User-Id` / `X-Flaha-Tenant-Id` headers. The web client sends those headers only in development builds without a session token.
- Actor IDs never accepted from request bodies

## Authorization

`VIEWER` / `ANALYST` / `REVIEWER` / `GOVERNANCE_ADMIN` with tenant scope on all product resources.

## Artifact preview

Escaped text only, bounded size, no iframe/script/external loads, no filesystem paths, no downloads by default.

## Health states

`READY` | `DEGRADED` | `UNAVAILABLE` | `NOT_CONFIGURED` for API, PostgreSQL, ArtifactStore, runtimes, queue, migrations, disk.

## Errors

Safe messages with optional failed stage and correlation ID. No stack traces, secrets, or paths.

## Residual limitations

- Full website E2E requires acquisition workers (Scrapy/Playwright) and network/fixture hosts
- Docling/Tika/Java readiness may be `NOT_CONFIGURED` on the API host when workers run separately
- No external IdP; session binds verified membership (email + tenant code, or UUIDs)

## Relationship to Phase 3M

Phase 3M covers production hardening, deployment, and operational security beyond this internal application. See `docs/ingestion/phase-3m-production-hardening.md`.
