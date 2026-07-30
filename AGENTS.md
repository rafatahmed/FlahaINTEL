<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: FlahaINTEL Agent Instructions
Introduction:
Defines repository-wide operating instructions for automated coding agents.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-30
-->

# FlahaINTEL Agent Instructions

## Project purpose

FlahaINTEL is a **local-first OSINT and news intelligence platform** for Flaha Agri Tech’s Precision Agriculture Division.

It is an internal, governed intelligence workstation that:

- manages authoritative **RSS** sources with hardened collection and deduplication;
- runs a durable multi-stage **ingestion pipeline** (acquire → extract → normalize);
- stores **immutable artifacts** and PostgreSQL job/review provenance;
- supports **analyst governance** (approve / reject / hold / correct) and promotion eligibility;
- exposes an operational **API + web shell** (Dashboard, Sources, Submit, Jobs, Content, Governance, Artifacts, Settings);
- hardens **production-like operations** (fail-closed config, workers, backup/runbooks) including **Windows** acceptance (Phase 3N).

Do not expand beyond the currently approved milestone unless explicitly instructed.

When a new milestone is approved, preserve the verified RSS foundation and update this file and the project documentation to reflect the new scope.

## Source file ownership headers

All newly created human-authored files must follow `docs/standards/source-file-header-standard.md` automatically in all future Codex work.

- Owner: Flaha Agri Tech
- Division: Precision Agriculture Division
- Copyright: © 2026–2027 Flaha Agri Tech. All rights reserved.
- Created by: Rafat Al Khashan
- Include title, introduction, created date, and last modified date using the format's native comment syntax.
- Do not add comments to JSON, JSON Schema, lockfiles, generated files, binaries, database-generated migrations, third-party code, external fixtures, or formats without comments.
- Do not modify existing files solely to add headers unless a dedicated migration is approved. When materially editing an owned file that already has the standard header, update its last modified date.

## Architecture invariants (do not violate)

1. **TypeScript API is the sole database writer** (Prisma). Workers never hold DB credentials for writes.
2. **Python/Node workers** run as supervised subprocesses (JSONL), no TCP listeners, no approval authority.
3. **ArtifactStore** is immutable promote/quarantine on local filesystem; PostgreSQL stores links and metadata.
4. **Worker success never implies governance approval.**
5. **RSS fingerprint and collection accounting semantics** remain the compatibility baseline until a dedicated parity gate.
6. Production API binds **loopback only**; reverse proxy terminates TLS.
7. No unrestricted crawling, automatic publication, embeddings, AI classification/summarization, OCR, or PPTX processing without a new approved phase.

## Current verified status (RSS MVP)

The RSS MVP has been runtime verified against local PostgreSQL.

Verified capabilities include:

- API health checks;
- RSS source creation;
- successful RSS collection;
- failed collection recording;
- URL-based deduplication;
- repeated collection without duplicate insertion;
- article search;
- API pagination;
- browser-rendered source and article views;
- API tests;
- API TypeScript build;
- web production build.

Initial migration:

```text
20260714141236_init
```

## Phase 1.1 verified status

RSS MVP hardening has been runtime verified on the `phase-1-1-rss-hardening` branch.

The verified baseline now also includes:

- strict Fastify request validation and stable error envelopes;
- configurable RSS timeouts, response-size bounds, and redirect limits;
- public-destination checks and redirect revalidation for RSS transport;
- separate bounded transport and RSS parsing;
- per-source collection overlap prevention;
- malformed feed failure recording and malformed item skipping;
- liveness and PostgreSQL readiness endpoints;
- configurable scheduler enablement and lifecycle status;
- bounded graceful shutdown behavior;
- source editing and enable/disable operations;
- article pagination controls and improved web runtime states;
- controlled automated transport, collector, scheduler, and API tests.

No Prisma schema change or new migration was required for Phase 1.1. Existing fingerprint generation, URL normalization, and collection-run database accounting semantics remain the compatibility baseline.

RSS destination controls are defense-in-depth and are not a claim of complete SSRF prevention. Preserve redirect validation, bounded transport, connection address pinning, and the documented residual DNS/network-infrastructure limitations when changing collection behavior.

## Phase 1.2 verified status

The authoritative RSS source registry and onboarding workflow has been runtime verified on the `phase-1-2-authoritative-rss-sources` branch.

The verified baseline now also includes:

- a reviewed machine-readable registry with stable human-readable IDs and controlled authority, HTTPS, and verification states;
- independent publisher-ownership and runtime-acceptance records;
- no-write preflight through the hardened transport and parser;
- manual content-suitability review before operational onboarding;
- two-run acceptance with zero duplicate additions on the second run;
- retained accepted, degraded, and rejected audit entries;
- individual database source IDs for accepted operational sources;
- documented safety findings and regional, language, and category coverage gaps.

No Prisma schema change or migration was required for Phase 1.2. Keep individual feed URLs, collection results, publisher evidence, and source-specific limitations in the source registry rather than duplicating them in this file.

## Phase 2 Gate 3 verified status

The contextual intelligence foundation migration and governed seed/backfill process have been applied and verified against local PostgreSQL.

The verified foundation now includes:

- governed RSS source metadata linked to the reviewed source registry;
- 186 contextual and agricultural `ClassificationTerm` records;
- 20 governed `OrganizationType` records;
- empty event, classification, organization, product, and relationship tables ready for later approved workflows;
- idempotent, validation-first taxonomy and organization-type seeding;
- all-or-nothing source metadata backfill with exact database ID and feed URL matching.

Migration `20260714165722_phase_2_intelligence_foundation` is applied. Existing source IDs and enabled states, all article IDs and fingerprints, article counts, source counts, and collection-run counts were preserved. NASA JPL remains disabled and `REJECTED`. Do not infer classifications or create organizations, products, or intelligence events without a separately approved workflow.

## Phase 3 verified status (FlahaINGEST + product shell)

Phase 3 delivers governed multi-channel ingestion under the FlahaINTEL product. Gates **3A–3M are implemented** on the lineage leading to `main` / `phase-3n-windows-production-like`.

| Gate | Scope | Status |
|------|--------|--------|
| 3A | Architecture and engine evaluation | Complete (docs) |
| 3B | Contracts, threat model, state machines, ADRs | Complete |
| 3C | Immutable filesystem artifact store | Complete |
| 3D | Worker supervisor + JSONL protocol | Complete |
| 3E | Governed engine benchmarks (D–H, J; OCR deferred) | Complete |
| 3F | Provider framework | Complete |
| 3G | Durable jobs, leases, provenance | Complete |
| 3H | Controlled acquisition (Scrapy / Playwright) | Complete |
| 3I | Extraction routing | Complete |
| 3J | Content normalization | Complete |
| 3K | Governance review and promotion eligibility | Complete |
| 3L | Product API and web UI | Complete |
| 3M | Production hardening (ops, auth, workers, backup) | Complete (code) |
| 3N | Windows production-like acceptance | **ACCEPT** — evidence in `docs/ingestion/phase-3n-evidence.md`; tag `v0.5.0-phase-3n-windows-production-like` |

Additional migrations in the Phase 3 lineage include durable ingestion jobs, governance review, and product submissions. See `apps/api/prisma/migrations/`.

### Phase 3 product capabilities

- Website and document submission orchestration (`AUTO_CHAIN` / `MANUAL_STAGE`)
- Durable jobs with cancel, retry, and provenance
- Immutable ArtifactStore with path safety (including Windows)
- Governance candidates with immutable decision history
- Session auth, CSRF in production mode, tenant-scoped roles
- Ops scripts: provision runtimes, residual acceptance, backup/restore, smoke, deploy/rollback
- Bootstrap: taxonomy seed, local tenant/admin, registry-mapped RSS sources

### Phase 3 non-goals (still in force)

- Unrestricted crawling; automatic publication
- Embeddings, semantic search, AI summarization/classification
- OCR (3E-I deferred); PPTX processing
- Authoritative Arabic/bilingual PDF extraction as a supported path
- Public self-service onboarding, billing, multi-host HA

### Phase 3 documentation map

- **Program frame / audit / plan / backlog:** `docs/program/flahaintel-program-frame-audit-plan-backlog.md`
- Roadmap: `docs/ingestion/phase-3a-architecture-and-engine-evaluation.md` §31
- 3N scope: `docs/ingestion/phase-3n-windows-production-like.md`
- 3N checklist: `docs/ingestion/gate-3n-acceptance-checklist.md`
- 3N evidence: `docs/ingestion/phase-3n-evidence.md`
- Production: `docs/ingestion/phase-3m-production-hardening.md`
- Product shell: `docs/ingestion/phase-3l-api-web-ui.md`

After Phase 3N, do not invent Phase 4+ work without an approved gate. Prefer the P0 ops backlog in the program charter.

## Local bootstrap (Windows / development)

```text
npm install
npm run prisma:generate
npm run prisma:status --workspace=@flaha-intel/api
npm run governance:seed
npm run bootstrap:local
npm run bootstrap:rss-accepted
npm run governance:backfill-sources
npm run ops:provision-verify
```

Default bootstrap admin email is `admin@flaha.local` under tenant code `flaha-local` (override with `FLAHA_BOOTSTRAP_*` env vars). Never commit real production secrets.
