<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: FlahaINTEL Agent Instructions
Introduction:
Defines repository-wide operating instructions for automated coding agents.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

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

## Source file ownership headers

All newly created human-authored files must follow `docs/standards/source-file-header-standard.md` automatically in all future Codex work.

- Owner: Flaha Agri Tech
- Division: Precision Agriculture Division
- Copyright: © 2026–2027 Flaha Agri Tech. All rights reserved.
- Created by: Rafat Al Khashan
- Include title, introduction, created date, and last modified date using the format's native comment syntax.
- Do not add comments to JSON, JSON Schema, lockfiles, generated files, binaries, database-generated migrations, third-party code, external fixtures, or formats without comments.
- Do not modify existing files solely to add headers unless a dedicated migration is approved. When materially editing an owned file that already has the standard header, update its last modified date.

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
