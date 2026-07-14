# FlahaINTEL

FlahaINTEL is a local-first RSS news application. It manages public RSS sources, collects and deduplicates articles in PostgreSQL, records collection outcomes, and presents a searchable, paginated web feed.

## Requirements

- Node.js 20 or newer
- PostgreSQL on `localhost:5432`
- The existing `flaha_intel` database with migrations `20260714141236_init` and `20260714165722_phase_2_intelligence_foundation` applied

## Setup

1. Run `npm install`.
2. Copy `.env.example` to `.env` and replace `<PASSWORD>` with the local PostgreSQL password.
3. Generate the Prisma client with `npm run prisma:generate`.
4. Confirm migration state with `npm run prisma:status --workspace=@flaha-intel/api`.
5. Run the applications in separate terminals:
   - `npm run dev --workspace=@flaha-intel/api`
   - `npm run dev --workspace=@flaha-intel/web`

The API listens on `127.0.0.1:3003` and the web app on port 5174 by default. Development commands load configuration from the root `.env`.

## Configuration

| Variable | Default | Purpose |
| --- | ---: | --- |
| `API_HOST` | `127.0.0.1` | Fastify listen host; only `127.0.0.1` or `::1` is accepted |
| `API_PORT` | `3003` | Fastify listen port |
| `WEB_PORT` | `5174` | Vite development port and fallback CORS origin port |
| `WEB_ORIGIN` | `http://localhost:5174` | Allowed browser origin |
| `COLLECTION_INTERVAL_MINUTES` | `15` | Scheduler interval |
| `SCHEDULER_ENABLED` | `true` | Enables or disables in-process scheduling |
| `RSS_TIMEOUT_MS` | `15000` | Total RSS request timeout, including redirects and body reading |
| `RSS_MAX_RESPONSE_BYTES` | `2000000` | Maximum compressed and decoded RSS response size |
| `RSS_MAX_REDIRECTS` | `5` | Maximum RSS redirects |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Bounded graceful-shutdown wait per stage |
| `VITE_API_URL` | `http://localhost:3003` | Browser API base URL |

Numeric and boolean configuration is validated at API startup. Invalid values stop startup with a configuration error. Boolean values must be exactly `true` or `false`.

## API

### Service status

- `GET /health` — process liveness; does not query PostgreSQL
- `GET /ready` — PostgreSQL readiness; returns 503 with a sanitized response when unavailable
- `GET /api/scheduler` — scheduler configuration, lifecycle timestamps, running state, and active source IDs

### RSS sources

- `GET /api/sources` — sources, recent collection runs, and current in-process collection state
- `POST /api/sources` — create a validated source
- `PATCH /api/sources/:id` — edit `name`, `url`, or `enabled`
- `POST /api/sources/:id/collect` — manually collect one source
- `POST /api/collect` — collect enabled sources, skipping sources already active

A duplicate manual request for the same source returns HTTP 409 with error code `COLLECTION_IN_PROGRESS` and does not create a collection run. Source deletion is not exposed.

### Articles

- `GET /api/articles?q=<text>&page=<number>&limit=<number>` — case-insensitive title/summary search with bounded pagination

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

## RSS transport safety

RSS downloading is separate from parsing. The transport:

- accepts only HTTP and HTTPS URLs without embedded credentials;
- resolves and rejects loopback, private, link-local, multicast, unspecified, and selected reserved destinations;
- pins each connection to an address checked immediately before that request;
- revalidates every redirect destination;
- bounds redirects, total request time, compressed bytes, and decoded bytes;
- parses only the bounded response content.

These controls are defense-in-depth, not a claim of complete SSRF prevention. Address classification and DNS behavior can vary across operating systems and network infrastructure, and future proxy or resolver changes could alter the connection path. Deployments with stronger isolation requirements should also enforce outbound network policy outside the application.

Malformed feeds are recorded as failed collection runs. Malformed items without a usable title and public HTTP(S) article link are skipped while preserving the existing `itemsFound` and `itemsAdded` database accounting semantics.

## Authoritative source registry

Phase 1.2 maintains a reviewed, machine-readable registry of publisher-owned RSS candidates at [`docs/rss-source-registry.json`](docs/rss-source-registry.json). It records ownership evidence, controlled verification states, safety and parsing results, manual content samples, operational collection counts, database source IDs, limitations, and rejection reasons.

The accompanying [`docs/rss-source-onboarding.md`](docs/rss-source-onboarding.md) documents the acceptance method, accepted, degraded, and rejected source summaries, database impact, safety findings, and current category and regional coverage gaps. Candidates are preflighted without database writes and are added individually only after publisher ownership, safe transport, valid parsing, and content suitability are established.

## Governed intelligence foundation

The approved taxonomy files under [`docs/taxonomy`](docs/taxonomy) seed 186 contextual and agricultural classification terms and 20 organization types. The current foundation stores governed vocabularies and source metadata only; it does not automatically classify articles or create organizations, products, or intelligence events.

The seed and source backfill commands are validation-first and idempotent:

- `npm run governance:seed --workspace=@flaha-intel/api`
- `npm run governance:backfill-sources --workspace=@flaha-intel/api`

Source backfill requires every registry `databaseSourceId` and `officialFeedUrl` to match PostgreSQL before any metadata is written. It preserves source enablement and collection state.

## Scheduler and shutdown

The scheduler is in-process and disabled with `SCHEDULER_ENABLED=false`. It never starts a second scheduler cycle while one is running. Active sources are skipped by scheduled collection while other enabled sources continue.

SIGINT and SIGTERM stop new scheduled cycles, wait for active collection only up to the configured bound, close Fastify, and disconnect Prisma. A timeout is logged rather than allowing shutdown to wait indefinitely.

## Commands

- `npm test` — run API tests with controlled fixtures and mocks
- `npm run build` — build both applications
- `npm run prisma:validate --workspace=@flaha-intel/api` — validate the Prisma schema
- `npm run prisma:generate` — generate the Prisma client without changing the database
- `npm run governance:seed --workspace=@flaha-intel/api` — validate and upsert governed taxonomy and organization types
- `npm run governance:backfill-sources --workspace=@flaha-intel/api` — validate and backfill governed RSS source metadata
