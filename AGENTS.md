# FlahaINTEL Agent Instructions

## Project purpose

FlahaINTEL is a local-first OSINT and news intelligence platform.

The current verified baseline is an RSS-only MVP that:

- manages RSS sources;
- collects RSS articles;
- stores articles in PostgreSQL;
- prevents duplicate article insertion;
- records collection runs and errors;
- exposes searchable and paginated article APIs;
- provides a React web interface for sources, articles, and collection status.

Do not expand beyond the currently approved milestone unless explicitly instructed.

When a new milestone is approved, preserve the verified RSS foundation and update this file and the project documentation to reflect the new scope.

## Current verified status

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
