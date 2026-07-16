<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3H Acquisition Workflow
Introduction:
Documents the controlled durable Scrapy and Playwright acquisition workflow and its security boundaries.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# Phase 3H acquisition workflow

## Scope

Phase 3H connects Phase 3F provider selection and Phase 3G durable jobs to bounded Scrapy 2.17.0 and Playwright 1.61.1/Chromium r1228 acquisition attempts. It ends with immutable raw, rendered, metadata, result and diagnostic artifacts. It performs no extraction, normalization, summarization, entity work, article promotion, OCR, UI work or unrestricted crawling. Phase 3I remains unstarted.

## Authority

TypeScript validates governed locators, creates and claims jobs, starts attempts, allocates canonical artifacts, supervises adapters, heartbeats, observes cancellation, verifies artifacts, validates Phase 3F results and calls Phase 3G completion or failure. Workers execute one request without Prisma, database credentials, retry scheduling, provider selection, fallback selection or promotion authority.

## Request and routing

Static HTTP, controlled crawling and link discovery select `acquisition.scrapy`. JavaScript rendering and rendered-DOM capture select `acquisition.playwright` only with `DYNAMIC_RENDER_REQUIRED`. A generic Scrapy error never upgrades to a browser. When Scrapy reports `DYNAMIC_RENDER_REQUIRED`, its static job ends with a typed terminal routing outcome; the caller creates a separate browser-acquisition job which is independently selected through Phase 3F. Correlation identity, selection evidence and the governed locator associate those jobs without inventing a cross-family fallback or parent relationship. Commands accept only exact scheme, host, port and relative route plus bounded closed limits and actor/idempotency data.

## Worker-once

`ingest:worker:once` claims one acquisition job, starts it, runs the persisted selected adapter, periodically heartbeats, observes `CANCEL_REQUESTED`, verifies/promotes allocated artifacts, submits a validated result and exits. Lease expiry or cancellation fences late output; eligible staging output is quarantined. There is no broker or permanent scheduler.

## Network policy

Public mode accepts only exact approved HTTP(S) origins after validating all IPv4/IPv6 DNS answers as public. Credentials, origin-changing redirects, private, loopback, link-local, multicast, reserved, unspecified and metadata destinations are rejected. Fixture mode permits only its exact loopback origin. Playwright intercepts subresources and closes WebSockets/popups; downloads are rejected or cancelled. Workers and frames are subject to the same exact-origin interception. Response headers are sanitized before persistence; authorization and cookie fields are excluded.

DNS validation and adapter enforcement are defense in depth, not a claim of perfect DNS-rebinding resistance. Public tests require an exact allowlist. No general crawling permission follows from one successful smoke test.

## Artifacts

The filesystem store uses atomic durable JSON manifests, ownership-bound staging, bounded writes, sealing, reread verification, immutable promotion, quarantine and reconciliation. The control plane pre-creates exact allocation files and passes only safe relative staging keys. Workers write only those files and JSONL returns metadata—allocation identity, role, key, size and SHA-256—never response bodies, rendered HTML or base64 content. TypeScript independently checks ownership, paths, regular-file status, limits, size and hash before lease-fenced promotion. Raw response bytes and rendered HTML always use separate artifact IDs and hashes. PostgreSQL stores only artifact links and verification snapshots.

## Results, retry and cancellation

Success maps to Phase 3F result validation and Phase 3G completion. Retryable technical failures use Phase 3G deterministic retry. Policy, request, integrity and protocol violations are security-relevant terminal failures. Only a persisted compatible fallback chain can change providers. Cancellation terminates the child and acknowledges durable cancellation; stale results cannot revive a job.

## Testing

The deterministic fixture acceptance starts an exact loopback server and executes the real pinned Scrapy and Playwright runtimes. Static acceptance verifies raw evidence and provenance. Dynamic acceptance verifies distinct raw and rendered evidence. Security tests cover addressing, credential/route rejection, origin escape and sensitive-header removal. A public static smoke uses only `https://example.com/` and flexible content assertions.

## Internal commands

```text
npm run ingest:create-acquisition -- --url <exact-url> --idempotencyKey <key> [--dynamic true]
npm run ingest:worker:once -- --workerId <id>
npm run ingest:job -- --jobId <uuid>
npm run ingest:artifact -- --artifactId <uuid>
```

Inspection omits lease hashes, raw request/policy JSON, absolute artifact paths and sensitive headers. No Phase 3H database migration is required.
