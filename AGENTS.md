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