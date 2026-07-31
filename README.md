# FlahaINTEL

FlahaINTEL is a **local-first OSINT and news intelligence platform** for Flaha Agri Tech (Precision Agriculture Division).

It combines:

1. **Authoritative RSS collection** — hardened transport, dedupe, search, and a reviewed source registry  
2. **Governed multi-channel ingestion (FlahaINGEST)** — durable jobs for websites and documents  
3. **Analyst governance** — review candidates, immutable decisions, promotion **eligibility** (not auto-publish)  
4. **Operational product shell** — React web UI + Fastify API with roles and production-like ops  

```text
Submit website / document
  → acquisition → extraction → normalization
  → governance candidate → human decision → promotion eligibility
```

RSS remains a first-class, compatibility-preserved path alongside the general pipeline.

## Requirements

- Node.js 20 or newer  
- PostgreSQL on `localhost:5432` (database `flaha_intel`)  
- All Prisma migrations under `apps/api/prisma/migrations` applied  
- Optional for full ingestion: pinned Scrapy / Playwright / Docling / Tika runtimes (see Phase 3N)

## Setup (development)

1. `npm install`
2. Copy `.env.example` to `.env` and set `DATABASE_URL` (never commit real secrets)
3. `npm run prisma:generate`
4. `npm run prisma:status --workspace=@flaha-intel/api` (must be up to date)
5. Bootstrap governed data and a local operator:

```text
npm run governance:seed
npm run bootstrap:local
npm run bootstrap:rss-accepted
npm run governance:backfill-sources
```

6. Run apps (Windows — recommended):

```powershell
.\start-flahaintel.ps1
# or: npm run ops:start
# stop:  .\start-flahaintel.ps1 -Stop   |  npm run ops:stop
```

Manual (two terminals):

```text
npm run dev --workspace=@flaha-intel/api
npm run dev --workspace=@flaha-intel/web
```

API default: `127.0.0.1:3003` · Web default: port `5174`.

Development uses `AUTH_MODE=development` (membership-verified session; optional bootstrap user from `bootstrap:local`).

## Product surface

### Web navigation

Dashboard · Sources · Submit · Jobs · Content · Governance · Artifacts · Settings

### Core APIs (summary)

| Area | Examples |
|------|----------|
| Health | `GET /health`, `GET /ready` |
| RSS | `/api/sources`, `/api/articles`, `/api/collect`, `/api/scheduler` |
| Auth / product | `/api/auth/session`, `/api/dashboard`, `/api/submissions/*`, `/api/jobs/*` |
| Governance | `/api/governance/candidates/*`, decisions, eligibility, policies |
| Taxonomy / entities | `/api/taxonomy`, events, organizations, products (manual; no auto-inference) |
| System | `/api/system/readiness`, metrics (role-gated) |

Errors use a stable envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": []
  }
}
```

## Configuration (development)

| Variable | Default | Purpose |
| --- | ---: | --- |
| `API_HOST` | `127.0.0.1` | Fastify listen host; only loopback is accepted |
| `API_PORT` | `3003` | Fastify listen port |
| `WEB_PORT` | `5174` | Vite development port |
| `WEB_ORIGIN` | `http://localhost:5174` | Allowed browser origin |
| `AUTH_MODE` | `development` | Use `production` with strict session secret (see ops template) |
| `COLLECTION_INTERVAL_MINUTES` | `15` | RSS scheduler interval |
| `SCHEDULER_ENABLED` | `true` | In-process RSS scheduling |
| `RSS_TIMEOUT_MS` | `15000` | RSS request timeout |
| `RSS_MAX_RESPONSE_BYTES` | `2000000` | RSS size bound |
| `RSS_MAX_REDIRECTS` | `5` | RSS redirect bound |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Graceful shutdown bound |
| `VITE_API_URL` | `http://localhost:3003` | Browser API base URL |

Production template: [`ops/config/production.env.example`](ops/config/production.env.example)  
Crawl policy: [`ops/config/crawl-policy.json`](ops/config/crawl-policy.json)

## RSS transport safety

RSS downloading is separate from parsing. The transport:

- accepts only HTTP/HTTPS URLs without embedded credentials;
- rejects loopback/private/link-local destinations;
- pins connections and revalidates redirects;
- bounds time, redirects, and response sizes.

These controls are **defense-in-depth**, not a claim of complete SSRF prevention.

## Authoritative source registry

Reviewed registry: [`docs/rss-source-registry.json`](docs/rss-source-registry.json)  
Onboarding notes: [`docs/rss-source-onboarding.md`](docs/rss-source-onboarding.md)

Bootstrap on an empty database:

```text
npm run bootstrap:rss-accepted
npm run governance:backfill-sources
```

NASA JPL remains **disabled** and `REJECTED` when present.

## Governed intelligence foundation

Taxonomy under [`docs/taxonomy`](docs/taxonomy) seeds **186** classification terms and **20** organization types.  
The foundation does **not** auto-classify articles or invent organizations/events/products.

```text
npm run governance:seed
```

## Ingestion pipeline (Phase 3)

| Stage | Role |
|-------|------|
| Jobs (3G) | Durable queue, lease, retry, cancel, provenance |
| Acquisition (3H) | Controlled Scrapy / Playwright fetch → immutable raw artifacts |
| Extraction (3I) | Offline routing to pinned document/HTML providers |
| Normalization (3J) | Deterministic profiles (HTML, PDF, DOCX, RTF, TXT) |
| Governance (3K) | Candidates, decisions, promotion eligibility |
| Product (3L) | Submissions, jobs UI, artifacts preview, auth |
| Production (3M) | Fail-closed config, workers, Caddy, backup, runbooks |
| Windows (3N) | Host acceptance on Windows — see docs below |

Workers (separate processes, no TCP):

```text
npm run worker:acquisition --workspace=@flaha-intel/api
npm run worker:extraction --workspace=@flaha-intel/api
npm run worker:normalization --workspace=@flaha-intel/api
npm run worker:submission-advance --workspace=@flaha-intel/api
npm run worker:stale-recovery --workspace=@flaha-intel/api
```

## Phase 3N (Windows production-like)

Documentation:

- [`docs/ingestion/phase-3n-windows-production-like.md`](docs/ingestion/phase-3n-windows-production-like.md)
- [`docs/ingestion/gate-3n-acceptance-checklist.md`](docs/ingestion/gate-3n-acceptance-checklist.md)
- [`docs/ingestion/phase-3n-evidence.md`](docs/ingestion/phase-3n-evidence.md)

Ops commands:

```text
npm run ops:provision-runtimes
npm run ops:provision-verify
npm run ops:residual-acceptance
npm run ops:smoke
```

## Explicit non-goals (current program)

- Unrestricted web crawling or open discovery  
- Automatic public publication  
- Embeddings / semantic search / AI classification or summarization  
- OCR and PPTX processing  
- Cloud object storage as primary artifact store  
- Public self-service SaaS onboarding  

## Commands

| Command | Purpose |
|---------|---------|
| `npm test` | API tests |
| `npm run build` | Build workspaces |
| `npm run prisma:generate` | Prisma client |
| `npm run governance:seed` | Seed taxonomy + org types |
| `npm run bootstrap:local` | Default tenant + admin user |
| `npm run bootstrap:rss-accepted` | Registry-mapped RSS rows |
| `npm run governance:backfill-sources` | Source metadata backfill |
| `npm run ops:provision-verify` | Probe pinned runtimes |
| `npm run ops:residual-acceptance` | Windows/prod residual suite |
| `npm run markets:seed-channels` | Seed market channels (Qatar MoCI first) |
| `npm run bootstrap:source-policies` | ACTIVE policies for accepted RSS |

## Further reading

- **Final product lock (north star):** [`docs/program/flahaintel-final-product-lock.md`](docs/program/flahaintel-final-product-lock.md)
- **Program frame, audit, plan & backlog:** [`docs/program/flahaintel-program-frame-audit-plan-backlog.md`](docs/program/flahaintel-program-frame-audit-plan-backlog.md)
- Agent rules and verified gates: [`AGENTS.md`](AGENTS.md)
- Phase 3 architecture roadmap: [`docs/ingestion/phase-3a-architecture-and-engine-evaluation.md`](docs/ingestion/phase-3a-architecture-and-engine-evaluation.md)
- Phase 3N evidence: [`docs/ingestion/phase-3n-evidence.md`](docs/ingestion/phase-3n-evidence.md)
- Production hardening: [`docs/ingestion/phase-3m-production-hardening.md`](docs/ingestion/phase-3m-production-hardening.md)
- Runbooks: [`ops/runbooks/`](ops/runbooks/)
