<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: FlahaINTEL Agent Instructions
Introduction:
Defines repository-wide operating instructions for automated coding agents.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-08-19
-->

# FlahaINTEL Agent Instructions

## Project purpose

FlahaINTEL is Flaha Agri Tech’s **Precision Agriculture intelligence system** (local-first, governed).

**Final product (LOCKED):** `docs/program/flahaintel-final-product-lock.md`  
Do not steer implementation away from that lock. Platform Phases 1–3N delivered the **backbone** only; eyes/muscles/product handoff are future gates.

Metaphor:

- **Backbone** — trust, evidence, safe collection, audit (largely built through Phase 3N)
- **Eyes** — markets, science, news, controlled web **worldwide** (implement Qatar then Jordan first; any country Flaha serves); later video/social under allowlists
- **Muscles** — schedules, extraction, trends, knowledge packs, sister-product feeds
- **Brain** — human + admin governance and product handoff rules

**Platform capabilities in repo today:**

- authoritative **RSS** sources with hardened collection and deduplication (plus agribusiness news batch);
- durable multi-stage **ingestion pipeline** (acquire → extract → normalize);
- **immutable artifacts** and PostgreSQL jobs, provenance, decisions;
- **analyst governance** (approve / reject / hold / correct) and promotion eligibility;
- operational **API + web shell**;
- **Windows production-like** ops acceptance (Phase 3N);
- **product surface (post-3N):** markets (QA/JO), knowledge packs, research desk (4R-A/L/B/X + Crossref + APA), product handoff 4I-B / feed policies 4B.

**Milestone posture:** Backbone tag `v0.5.0-phase-3n-windows-production-like`. Product-surface tag `v0.6.0-post-3n-product-surface`. **Current engineering:** **v0.7 operate-harden (Gate 4O)** — `docs/program/gates/gate-4o-operate-harden.md`. **Stage E (5E-0 / 5V / 5X) is HOLD** — `docs/program/gates/gate-5e-extended-eyes-scope.md`. Not product-complete until operate criteria (disk, content, market span) land.

Do not expand beyond the currently approved milestone unless explicitly instructed.  
When a new milestone is approved, preserve the verified foundation, map the work to the final product lock (O1–O5 / Backbone|Eyes|Muscles|Brain), and update this file.  
Do **not** implement YouTube/X until Stage E unfreeze.

## Sister system: Flaha Knowledge Platform (LOCKED posture)

**Decision label:** `INTEL-primary · FKP-frozen-thin · MCP-on-named-consumer`  
**Metaphor (LOCKED):** **vault · door · engine** — operate lock §1.4  
**Owner-approved operate lock:** `docs/program/flaha-system-vision-and-operate-lock.md`  
**Binding matrix:** `docs/program/flaha-intel-vs-knowledge-platform-matrix.md`

| System | Metaphor | Owns | Does not own |
|--------|----------|------|----------------|
| **FlahaINTEL** (this repo) **PRIMARY** | **Vault / bank** | Gather, collect, process, govern: markets, RSS/ingest, jobs, artifacts, knowledge **packs**, handoff, PA UI | Long-form methodology CMS; Flaha-wide MCP host |
| **flaha-knowledge-platform** **FROZEN-THIN** | **Door (MCP)** | Governed documents (policy/standard/methodology), registry/inventory; **future** MCP serving PA apps, tailored by product | Markets, packs, ArtifactStore, a copy of this vault, product engine writes |
| **FlahaSOIL / CALC / FAST** | **Engines** | Runtime compute and farmer UX | Collection, governance bank, MCP host |

**Operate rules for agents in this repo:**

1. Default all new PA value work **here** (vault) unless the user explicitly names FKP thin work.  
2. Do not re-home full methodologies as a second wiki; optional `fkpDocId` when citing elevated standards.  
3. Never auto-apply into FlahaSOIL, FlahaCALC, or FlahaFAST (three separate products: soil · irrigation/weather · nutrients). The vault must work if the door is down.  
4. Do not implement Flaha-wide science MCP in this repo (that is the FKP door).  
5. Do not copy INTEL ops data into FKP. Serve later by ID; store of record stays here.  
6. Priority order: operate stack → 4I-B handoff / real pack use → market series depth → only then extended eyes.  
7. **Submit / intake:** land once → classify → promote (`docs/program/evidence-intake-spine.md`). Do not add parallel per-model upload silos; extend promoters under `apps/api/src/intake/`.

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
| 4M-0 | Global market data model | **Implemented** — `MarketChannel` / `MarketPriceObservation` + `/api/markets/*` + review policy (`HUMAN_REQUIRED` \| `AUTO_APPROVE_OFFICIAL`) |
| 4M-D | Schedule + retention + trends | **Foundation** — Task Scheduler harvest; `GET /api/markets/retention`; Markets UI series + retention table |
| 4M-E | Market analyst pack | **Implemented** — `markets:build-analyst-packs` + `POST /markets/analyst-packs/rebuild` → MARKET_CONTEXT packs |
| 4M-A | Qatar market channel (MoCI daily vegetables) | **Implemented** (source) — registry + seed; daily extract muscle pending |
| 4S-A | Soil/irrigation knowledge pack schema | **Implemented** — `KnowledgePack` + `/api/knowledge-packs` + sample packs (`knowledge:seed-samples`) |
| 4I-B | Product handoff envelope | **Implemented** — `flaha-intel-product-handoff-v1` + export API/CLI/UI (APPROVED only) |
| 4B-A/B | Feed policies + PA dashboard | **Implemented** — `ProductFeedPolicy` + `/api/pa-dashboard` |
| 4S-B | Structured extract template + FlahaSOIL comparison notes | **Implemented** — validation, human-only review, `COMPARISON_NOTE`, Knowledge UI |
| 4S-C | Literature threshold bank (human approved) | **Implemented** — bank JSON + seed + `GET /threshold-bank` + UI (APPROVED = live) |
| 4S-D | FlahaSOIL comparison workflow | **Implemented** — `FlahaSoilComparisonCase` + API + UI; human deviation notes only |
| 4S-D2 | Soil report bridge | **Implemented** — PDF/JSON upload import; optional read-only `FLAHASOIL_API_*`; never writes SOIL |
| 4R | Research desk (Stage D surface) | **Implemented (surface)** — topic index, literature+Crossref, collections+APA, claims; scope accepted |
| Markets analytics | Multi-year / histogram / deviation | **Implemented** — pure engine + `/api/markets/prices/analytics` |
| RSS agri batch | Agribusiness news/alerts | **Implemented (PENDING accept)** — practical register; prices stay Markets |

**Release readiness:** `docs/program/milestone-v0.6-product-surface-release-readiness.md`

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

Default bootstrap admin email is `admin@flaha.local` under tenant code `flaha-local` (override with `FLAHA_BOOTSTRAP_*` env vars). Live sign-in (`intel.flaha.org`) uses that email + tenant code, or the UUIDs printed by `bootstrap:local`. Sign out from the header, sidebar, or Settings. Never commit real production secrets.
