# Phase 3A: FlahaINGEST architecture and engine evaluation

Status: architecture gate proposal only
Date: 2026-07-15
Branch audited: `phase-3a-ingestion-architecture`
Baseline release: `v0.4.0-intelligence-foundation`

## 1. Decision summary

FlahaINGEST should be an internal FlahaINTEL subsystem, not a separate repository or independently governed product. PostgreSQL should own source governance, job state, provenance metadata, review state, and audit history. An immutable local artifact store should hold raw bytes and versioned normalized outputs. TypeScript should remain the control plane and sole database writer; Python workers should perform bounded collection, conversion, extraction, and dataset processing through versioned, provider-neutral contracts.

The first implementation gate should introduce contracts and an artifact-store abstraction, then a PostgreSQL-backed leased job queue and a local Python subprocess worker. It should prove one end-to-end document path before generalizing RSS. Existing RSS behavior must remain operational and unchanged until a compatibility adapter passes the existing suite and dedicated parity tests.

Recommended engine posture:

- Scrapy is the preferred candidate for allowlisted HTTP crawling and sitemap fan-out.
- Trafilatura is the preferred static-HTML extraction benchmark, but its GPL-3.0-or-later licence requires explicit legal acceptance or process isolation; a permissively licensed Readability implementation and selector profiles must also be benchmarked.
- Playwright is a last-resort rendered-page fetch provider, never a discovery crawler.
- Docling is the preferred PDF/document conversion candidate behind a provider interface.
- Tesseract is the initial offline OCR baseline, including Arabic; PaddleOCR is deferred to a benchmark gate.
- Apache Tika is a broad-format fallback candidate, not the default PDF-to-Markdown engine.
- PyArrow is the canonical columnar interchange layer, Polars the preferred transformation engine, DuckDB the bounded inspection/query engine, and pandas a compatibility tool for difficult Excel/ecosystem cases.

This report proposes designs only. It adds no production code, dependencies, migrations, services, or database changes.

## 2. Assumptions and non-goals

Assumptions:

- Phase 3 gates may later approve additive schema migrations, but Phase 3A does not.
- A single Windows workstation and its existing local PostgreSQL instance are the initial runtime.
- “Offline operation” means collection naturally needs network access, but conversion, normalization, review, replay, and tests can run with preinstalled binaries/models and no external service.
- Artifact roots are application-controlled directories outside source control. The proposed repository `storage/` folders are placeholders/documentation only, not a location for committed evidence.
- Analyst approval is an explicit authenticated/manual action in a later gate; worker success never implies approval.
- Existing `Article` rows remain the compatibility read model for RSS. New item kinds are not forced into it.

Non-goals include production implementation, schema design finalization, automatic classification, AI-provider integration, unrestricted crawling, cloud/object storage, publication, or a separate FlahaINGEST deployment.

## 3. Current-state ingestion architecture

The current runtime is a single TypeScript/Fastify API process:

```text
manual API request or in-process interval
  -> CollectionCoordinator (per-source overlap guard)
  -> collectSource
       -> fetchRssText (URL validation, DNS checks, pinned connection,
                        redirect revalidation, timeout and byte limits)
       -> rss-parser
       -> normalize URL and calculate legacy Article fingerprint
       -> Prisma Article.createMany(skipDuplicates)
       -> transactional CollectionRun + RssSource status update
  -> existing Article and Source APIs
```

Important observations:

- Scheduling, orchestration, fetching, parsing, persistence, and run accounting are in the API process.
- `CollectionCoordinator` prevents overlap only in memory and only within one process.
- Collection is source-oriented; there is no durable job, lease, retry, cancellation, or recovery model.
- `CollectionRun` has only `SUCCESS`/`FAILURE`, counts, timestamps, and a single error string.
- RSS bytes are not retained. Reprocessing and evidentiary replay are therefore impossible.
- Parsed items write directly to `Article`; provenance currently terminates at `RssSource` and `CollectionRun`.
- `EventEvidence` can link an intelligence event only to an `Article`.
- The source registry provides strong human-reviewed RSS governance, but it is file-backed and RSS-shaped.
- The current server listens on `0.0.0.0`. A future implementation gate must change the default to `127.0.0.1` and add a binding regression test to satisfy the stated local-only constraint.

## 4. Existing RSS components to generalize

Generalize behavior, not RSS names or database shapes:

| Existing capability | Generalized capability | Compatibility rule |
| --- | --- | --- |
| URL parsing and public-address checks | shared outbound destination policy | preserve redirect revalidation and address pinning |
| timeout, redirect, compressed/decoded byte bounds | per-provider fetch budget | RSS defaults and errors remain compatible |
| `CollectionCoordinator` overlap prevention | durable source/job concurrency keys | retain current HTTP 409 behavior for duplicate RSS manual requests |
| scheduler lifecycle and bounded shutdown | job dispatcher lifecycle and lease draining | scheduler API remains stable until versioned replacement exists |
| `CollectionRun` accounting | ingestion job/run metrics | legacy RSS counts and rows continue to be written |
| URL normalization | versioned canonicalization service | never recalculate existing fingerprints |
| SHA-256 use | checksum/fingerprint service with named algorithms and rule versions | legacy `articleFingerprint` is frozen as version `rss-article-v1` |
| source registry governance | channel-neutral source configuration plus channel profile | retain RSS registry IDs and review evidence |
| controlled fixtures and injected fetch/parser functions | provider contract/conformance tests | preserve deterministic, network-free tests |

## 5. Components that must remain RSS-specific

- `rss-parser`, Atom/RSS element mapping, GUID fallback, `contentSnippet`/`content` selection, and malformed-feed/item rules.
- `RssSource` and its existing routes, API response shapes, scheduler status semantics, registry backfill, and onboarding evidence.
- `Article` mapping and the exact legacy fingerprint identity order: normalized link, then GUID, then title plus published value.
- Current `itemsFound`, `itemsAdded`, skipped-item behavior, collection failure recording, and `lastCollectedAt`/`lastSuccessAt`/`lastError` updates.
- RSS-specific configuration names and error code `UNSAFE_RSS_URL` while those public contracts exist.

RSS may later be wrapped by a compatibility adapter, but it should not be rewritten as the first FlahaINGEST slice.

## 6. Recommended repository structure

```text
FlahaINTEL/
  apps/
    api/                         # governance/review APIs; sole DB writer
    web/                         # analyst UI
    ingest-worker/               # Python package and local worker entry point
      pyproject.toml
      src/flaha_ingest_worker/
        protocol/
        providers/
          documents/
          html/
          datasets/
          ocr/
        sandbox/
      tests/
  packages/
    ingestion-contracts/         # JSON Schemas + generated TS/Python types
    ingestion-core/              # TS orchestration, leases, transitions
    source-governance/           # policies, allowlists, budgets, validation
    document-normalization/      # Flaha-owned normalization rules/contracts
  storage/                       # ignored placeholders only
    raw/.gitkeep
    normalized/.gitkeep
    evidence/.gitkeep
    quarantine/.gitkeep
  docs/ingestion/
    phase-3a-architecture-and-engine-evaluation.md
    decisions/
    threat-model.md
    provider-benchmarks.md
    runbooks/
```

Do not create a generic `utils` package. Provider SDK objects must not escape provider adapters. Contracts and normalization rules are Flaha-owned; engines are replaceable dependencies.

## 7. TypeScript-to-Python boundary

Use a local subprocess protocol for the first worker, not HTTP. The API/dispatcher starts an exact pinned Python executable with `stdio` pipes, passes no database credentials, and exchanges one JSON object per line. Large bytes move by artifact reference, never through JSON.

TypeScript owns:

- source approval, configuration validation, job creation, priority, leases, retries, cancellation, and lifecycle transitions;
- outbound policy decisions and the effective immutable policy snapshot attached to a job;
- artifact path allocation, metadata registration, review, evidence linkage, and all PostgreSQL writes;
- contract version negotiation and provider allowlisting.

Python owns:

- bounded conversion/extraction/transformation within the supplied policy;
- reading an approved input artifact and writing only to a job-scoped staging directory;
- calculating reported output checksums, warnings, metrics, and deterministic manifests;
- no governance decisions, approval, publication, database access, or arbitrary destination selection.

Protocol rules:

1. TS sends `WorkerRequest` containing contract version, job/run IDs, operation, provider ID/version, immutable input artifact, staging directory, limits, locale hints, and normalized provider options.
2. Worker emits structured progress events and exactly one terminal `WorkerResult`.
3. TS verifies schema, job/attempt IDs, output containment, sizes, and checksums before atomically promoting staged files.
4. TS records metadata and transitions the job. Invalid output is a failed attempt and remains quarantined for diagnosis.
5. Cancellation sends a protocol message, then a bounded graceful timeout, then terminates the process tree.

The protocol must use JSON Schema as the canonical source, with generated TypeScript and Python models. Reject unknown major versions and unknown fields at trust boundaries.

## 8. Worker execution model

Start with one supervisor process and a small bounded subprocess pool. Each conversion attempt gets a fresh child process when the engine has native code, ML models, browser state, or uncertain memory behavior. Lightweight deterministic transforms may later reuse workers after soak testing.

- Claim jobs with a database lease, heartbeat during work, and reclaim only after lease expiry.
- Use an idempotency key and unique attempt number; assume at-least-once delivery.
- Limit global concurrency and separately limit CPU-heavy, memory-heavy, browser, OCR, and per-source work.
- Run jobs under a low-privilege local account where practical; use a sanitized environment and explicit executable paths.
- Set wall-clock, input/output byte, page, row, file-count, archive-depth, redirect, request, and memory budgets.
- Capture stdout only for protocol; redirect structured provider logs to bounded attempt logs with secret/URL-query redaction.
- Never allow workers to choose final paths. Promote by atomic rename on the same volume after verification.

## 9. Job queue options for the local environment

| Option | Fit | Benefits | Costs/risks | Decision |
| --- | --- | --- | --- | --- |
| PostgreSQL job table using `FOR UPDATE SKIP LOCKED` plus leases | High | no new service; durable; transactional with governance; Windows-friendly | schema and careful lease/retry design required; avoid high-frequency polling | Recommended initial queue |
| pg-boss | Medium-high | mature PostgreSQL queue semantics in Node | adds a dependency and owns schema/upgrade conventions | Benchmark if custom queue scope grows |
| Graphile Worker | Medium-high | PostgreSQL-native, retries and scheduling | framework conventions and dependency footprint | Alternative benchmark |
| BullMQ/Redis | Medium | strong queue features | adds Redis, operations, persistence, and Windows friction | Defer until scale justifies another service |
| RabbitMQ | Low now | mature messaging and routing | separate broker and operational burden | Defer |
| Filesystem spool | Low | simple/offline | weak concurrency, querying, recovery, and audit semantics | Do not use as authoritative queue |
| In-process memory | Insufficient | no schema | loses jobs/recovery and cannot coordinate processes | Retain only inside tests |

The initial schema should use job rows, attempts, `availableAt`, `leaseOwner`, `leaseExpiresAt`, `heartbeatAt`, bounded attempt count, priority, concurrency key, and idempotency key. PostgreSQL is a queue here, not an artifact store.

## 10. Artifact storage strategy

Use a content-addressed, immutable filesystem store with PostgreSQL metadata.

```text
<artifact-root>/
  raw/sha256/ab/cd/<64-hex-digest>/payload
  normalized/<item-id>/<normalization-name>/<version>/<artifact-id>/content.md
  evidence/<evidence-id>/manifest.json
  staging/<job-id>/<attempt-id>/...
  quarantine/<job-id>/<attempt-id>/...
```

Rules:

- Raw identity is SHA-256 of exact received bytes. Once promoted, raw paths are write-once and opened read-only.
- Store media type, byte length, checksum algorithm/value, retrieval timestamp, original locator, final URL, response metadata allowlist, collector version, and policy snapshot in PostgreSQL.
- Normalized content has its own byte checksum and a deterministic derivation key: input raw checksum + converter/provider/version + normalization ruleset/version + effective options.
- Never overwrite a normalized artifact. Corrections create a new analyst-authored revision referencing both the machine output and prior revision.
- Store relative POSIX-style logical keys in PostgreSQL, not machine-specific absolute paths. Resolve them under one configured root and reject traversal, alternate data streams, device paths, symlinks/reparse points, and cross-volume promotion.
- Fsync file and parent directory where supported before metadata commit. Reconciliation detects orphaned staged/promoted files and metadata whose files are missing.
- Back up PostgreSQL and artifact root as one consistency set; periodically verify checksums and record audit results.
- Do not use DuckDB database files as durable dataset storage. Use immutable Parquet artifacts; DuckDB is a query engine.

## 11. Database ownership boundaries

PostgreSQL owns small, queryable control metadata: sources/configurations, policy snapshots, jobs/attempts, items, artifact manifests, normalized-content versions, warnings, audit events, review decisions, dataset/version schemas and statistics, evidence relationships, and references to external artifact bytes.

Filesystem owns raw response/file bytes, normalized Markdown/JSON, page images, extracted attachments, Parquet shards, conversion sidecars, and bounded diagnostic logs.

Python owns no durable authoritative state and receives no `DATABASE_URL`. Only the TypeScript control plane writes PostgreSQL. Provider caches and models are installation assets, not evidence; their exact versions/checksums are recorded in run manifests.

## 12. Proposed common ingestion contracts

The following are logical contracts, not approved Prisma models:

| Contract | Essential fields |
| --- | --- |
| `IngestionSourceConfiguration` | id, stable key, channel, authority/review state, endpoints, domain/path allowlists, schedule, budgets, credential reference, profile version, active version |
| `IngestionJob` | id, source configuration/version, operation, status, priority, idempotency key, concurrency key, policy snapshot, lease, retry policy, timestamps |
| `IngestionAttempt` | job, attempt number, worker/provider identity, start/finish/heartbeat, outcome, metrics, error category and sanitized detail |
| `IngestedItem` | id, kind, source, discovery/retrieval locators and times, external ID, published/observed times, status, raw artifact, review status |
| `RawArtifact` | id, logical key, media type, size, SHA-256, retrieval metadata, immutable flag, collector/version |
| `NormalizedContent` | id, item, input artifact, format, language/direction, provider/version, ruleset/version, checksum, logical key, supersedes, machine/analyst origin |
| `ConversionRun` | input/output artifacts, provider/version/model checksums, options, metrics, warnings, outcome |
| `ExtractionRun` | normalized input, extractor/profile version, structured output, field-level provenance, warnings |
| `Dataset` | source, stable dataset key, title, description, licence, publisher, review state |
| `DatasetVersion` | dataset, source version, retrieved time, raw artifact, schema fingerprint, row count, Parquet artifacts, status |
| `DatasetRecordReference` | dataset version, shard, row group/range or governed external reference; no mandatory row-per-record table |
| `SocialSignal` | platform, source/account identity, platform item ID, observed/published times, raw artifact, unverified status, corroboration links |
| `IngestionWarning` | scope, stable code, severity, stage, provider, message template, bounded context, timestamp |
| `IngestionAuditEvent` | append-only sequence, actor type/id, action, entity type/id, prior/new status, reason, correlation/causation IDs, timestamp, payload digest |
| `EvidenceRelationship` | event, normalized content/item, relationship type, analyst, rationale, approval state, added/retracted timestamps |

Use UTC ISO-8601 timestamps, UUIDs, stable uppercase enum values, integer byte counts, and explicit nullable fields. Every contract carries `contractVersion` and correlation IDs.

## 13. Lifecycle and status enums

Do not use one enum for three different concerns. Separate processing status, review status, job status, and availability.

### Item processing

`DISCOVERED -> FETCHED -> RAW_STORED -> NORMALIZED -> VALIDATED -> READY_FOR_ANALYSIS`

From any active state: `FAILED` for retryable/terminal technical failure as recorded on an attempt; `REJECTED` only by policy or analyst decision; `ARCHIVED` only after retention/retraction workflow. A retry resumes from the last durable state and does not erase the failed attempt.

### Documents

`UPLOADED -> CHECKSUM_VERIFIED -> CONVERTED -> NORMALIZED -> REVIEW_REQUIRED -> APPROVED`

`REJECTED` requires a reason and actor. Downloaded documents use the common discovery/fetch states before `CHECKSUM_VERIFIED`. `APPROVED` is a review status in the canonical model even if a document-facing API presents this simplified lifecycle.

### Datasets

`DISCOVERED -> DOWNLOADED -> SCHEMA_VALIDATED -> VERSIONED -> IMPORTED -> READY`

Here `IMPORTED` means immutable canonical dataset artifacts and metadata are registered, not that every row is inserted into PostgreSQL.

### Jobs and review

- Job: `QUEUED`, `LEASED`, `RUNNING`, `RETRY_WAIT`, `SUCCEEDED`, `FAILED`, `CANCEL_REQUESTED`, `CANCELLED`, `DEAD_LETTERED`.
- Review: `UNREVIEWED`, `REVIEW_REQUIRED`, `APPROVED`, `REJECTED`, `SUPERSEDED`.
- Warning severity: `INFO`, `WARNING`, `ERROR`.
- Item kind: `ARTICLE`, `PRESS_RELEASE`, `DOCUMENT`, `PDF_REPORT`, `RESEARCH_PAPER`, `DATASET`, `DATASET_VERSION`, `SOCIAL_SIGNAL`, `MARKET_OBSERVATION`, `WEATHER_ALERT`, `REGULATION`, `TENDER_NOTICE`, `EVENT_NOTICE`, `MARKDOWN`.

Transitions must be compare-and-set operations with an audit event in the same PostgreSQL transaction.

## 14. Provenance and audit design

Required chain:

```text
IntelligenceEvent
  -> EvidenceRelationship (analyst decision and rationale)
  -> NormalizedContent (versioned, checksum-addressed)
  -> IngestedItem (kind and source identity)
  -> RawArtifact (immutable exact bytes)
  -> IngestionSourceConfiguration version
  -> IngestionJob / attempt / collection run
```

Every derived artifact records inputs, provider executable/package/model checksums, converter and normalization versions, effective options, warnings, start/end times, and correlation/causation IDs. Audit events are append-only; corrections add compensating events. Sensitive headers, cookies, tokens, local usernames, and URL query secrets are excluded or irreversibly redacted before persistence.

Extend evidence polymorphically in a later additive migration. Preserve existing `EventEvidence(articleId)` as a compatibility projection; do not drop or reinterpret it. A future `EvidenceRelationship` should point to `NormalizedContent` and optionally the legacy article, enabling documents and datasets without pretending they are articles.

## 15. Checksums and deduplication

Use distinct identities for distinct questions:

- Raw byte identity: `SHA-256(exact bytes)`; global storage deduplication is safe while source retrieval observations remain separate.
- Retrieval identity: source configuration version + final locator + retrieval timestamp/run. Multiple observations may reference one raw artifact.
- Item source identity: channel + source + stable external ID when authoritative.
- Canonical locator identity: normalized URL under a named, versioned ruleset; keep original and redirect chain.
- Semantic candidate identity: normalized title/date/body signature only for review suggestions, never silent merging.
- Normalized derivation identity: raw checksum + provider/version/model digest + normalization version + options digest.
- Dataset schema fingerprint: canonical ordered schema JSON hash; dataset version identity also includes raw manifest checksums and publisher version/modified metadata.

Continue SHA-256 unless a later threat model requires algorithm agility; store the algorithm name regardless. Never change or backfill existing `Article.fingerprint`. New RSS compatibility rows must still call the frozen current function. Cross-source duplicate content should link as duplicate/corroborating observations, not erase provenance.

## 16. Document-ingestion architecture

```text
manual upload or governed URL
 -> validate declared/observed type and size
 -> stream to staging while hashing
 -> malware/content safety gate (provider-neutral; later approved tooling)
 -> promote immutable raw artifact
 -> inspect PDF encryption, page count, embedded files and active content
 -> choose conversion provider from approved policy
 -> produce provider-native JSON + Markdown + assets in staging
 -> Flaha normalization (headings, whitespace, links, tables, bidi metadata)
 -> deterministic validation and warnings
 -> REVIEW_REQUIRED
 -> analyst approval/correction as a new revision
```

Reject password-protected, malformed, over-budget, polyglot, or unsupported documents by policy; never attempt password guessing. Disable macro execution and external resource resolution. Embedded files are separately budgeted artifacts and never executed.

## 17. PDF-to-Markdown provider abstraction

```ts
interface DocumentConversionProvider {
  descriptor(): ProviderDescriptor;
  probe(input: ArtifactRef): Promise<ProbeResult>;
  convert(request: DocumentConversionRequest): Promise<DocumentConversionResult>;
}
```

`DocumentConversionResult` returns provider-native structured JSON, Markdown, referenced assets, page/element spans, tables, detected languages, OCR usage, metrics, and stable warnings. It never returns an approved item.

Provider routing should be policy-driven: Docling default for PDF/DOCX/PPTX with layout; Tika fallback for broad type/metadata extraction; Tesseract OCR provider for scanned pages; PaddleOCR only after benchmark approval. Flaha normalization consumes provider-neutral blocks and owns final Markdown conventions. Preserve provider output unchanged alongside normalized output so a normalization bug can be fixed without reconversion.

Benchmark Arabic on native text, mixed Arabic/English, RTL tables, scans, rotated pages, ligatures/diacritics, and numerals. Measure character/word error rate, reading order, table cell accuracy, and human review time.

## 18. Crawler and scraper architecture

Separate discovery, fetching, rendering, and extraction providers.

- A governed `CrawlPolicySnapshot` contains exact schemes, domains, ports, path prefixes/regexes, deny paths, maximum requests/bytes/depth/duration, per-host concurrency and delay, user agent, redirect policy, content types, and schedule.
- The frontier accepts only canonical URLs that pass the snapshot. Validate every redirect and DNS destination with the shared outbound policy.
- Default depth is zero for explicit URLs and one for approved discovery; no whole-domain mode exists.
- Respect publisher terms and robots policy as a governance prerequisite; record robots response and effective decision. Robots permission does not replace source approval.
- Fetch raw bytes first, then extract. Selector profiles are versioned data with fixtures, not code pasted into spiders.
- Store request/response evidence with an allowlisted header subset. Never retain credentials in artifacts.
- Use Scrapy as the candidate HTTP crawler. Do not combine Playwright into the default crawl frontier.

## 19. Sitemap collector

1. Begin only from an explicitly approved sitemap URL.
2. Fetch through the hardened transport policy with compressed and decoded byte limits.
3. Parse XML without DTD/external entities; support sitemap indexes and gzip only within archive/expansion budgets.
4. Enforce host/path allowlists on every child sitemap and URL.
5. Bound sitemap count, URL count, recursion depth, total bytes, and elapsed time.
6. Normalize and deduplicate discovered locators while preserving `lastmod` and parent sitemap provenance.
7. Emit `DISCOVERED` candidates; do not automatically fetch or approve them unless the source policy explicitly schedules a bounded follow-up job.

## 20. Static HTML extraction

Fetch and retain exact HTML before extraction. Run, in order: source-specific selector profile when governed and fixture-tested; a general extraction provider (Trafilatura benchmark); then a Readability-based permissive provider. Output title, author, dates with provenance, main blocks, links, language/direction, and warnings. Never execute scripts, load subresources, or trust page metadata without marking it as publisher-asserted.

Evaluate extraction against Arabic/English golden pages, press releases, regulatory pages, tables, malformed markup, cookie banners, navigation-heavy pages, and content updates. A low-confidence/empty result becomes `REVIEW_REQUIRED` or an approved Playwright-fallback candidate; it is not silently accepted.

## 21. Playwright fallback

Playwright is permitted only when a governed static request cannot obtain usable content and a source profile explicitly enables rendering.

- Use one pinned Chromium build prepared during an online installation gate; run fully offline from a verified cache afterward.
- Create an isolated context per job, block downloads, pop-ups, service workers, WebRTC, geolocation, notifications, and non-allowlisted subresource hosts.
- Route every request through the same domain/path policy; browser navigation is not an SSRF bypass.
- Apply navigation/action/total timeouts, response and screenshot limits, and a strict action script from the versioned source profile.
- No CAPTCHA solving, authentication bypass, stealth plugins, arbitrary analyst-supplied JavaScript, or persistent browser profiles.
- Save final DOM, bounded screenshot when justified, network summary, and console warnings as evidence; then use the same HTML extractor contract.

## 22. Public API collector

Use source-specific declarative profiles for endpoint, method (normally GET), accepted media type, pagination style, cursor location, record mapping, rate-limit interpretation, and checkpoint semantics. Credentials, if later approved, are referenced from local secret storage and never copied into jobs/artifacts/logs.

Validate destination and redirects, response bytes, JSON depth, record count, schema, and pagination budgets. Persist raw response pages and their ordering/checkpoints. Treat `ETag`, `Last-Modified`, publisher IDs, and rate-limit headers as observations. Retries need jitter, `Retry-After` bounds, and idempotency; never retry unsafe mutations. OpenAPI clients may be generated behind the provider contract but do not own Flaha contracts.

## 23. Open-data and dataset ingestion

Discover metadata first, then download an immutable version. Validate media type, compression expansion, encoding, delimiter, schema, nullability, row/column counts, and publisher licence. Convert accepted tabular inputs into versioned Parquet shards plus canonical schema JSON and statistics.

- PyArrow defines interchange and Parquet I/O.
- Polars performs typed, streaming/lazy transformations where supported.
- DuckDB performs bounded SQL inspection, validation, and analyst preview directly over Parquet.
- pandas handles ecosystem/Excel edge cases where its compatibility is stronger.
- Excel formulas are data, never executed; record both formula presence and cached values where available.
- Do not create a PostgreSQL row per dataset record by default. Store dataset/version metadata in PostgreSQL and immutable Parquet references on disk.
- Future GDAL/GeoPandas work is separate because native dependencies, coordinate systems, and geospatial validation require their own gate.

## 24. Social-signal architecture

Only official platform APIs or explicitly approved exports/connectors are candidates. No credential scraping or browser automation around platform restrictions. Preserve platform/account/post IDs, exact API response artifact, retrieval and publication times, edit/deletion observations, and API/provider version.

Every social item starts with review state `UNVERIFIED`. It cannot directly create an approved intelligence event. Corroboration is an explicit relationship to independent evidence, followed by analyst review. Edits create observations/versions; deletions create tombstone audit events and apply approved retention policy without rewriting prior evidence. Minimize personal data, honour licence/retention terms, and defer all platform-specific implementation and credentials.

## 25. Engine comparison matrix

Scores are 1 (poor/high friction) to 5 (excellent/low risk) for FlahaINTEL's stated local-first use. `—` means the criterion is not materially applicable. Scores are architectural estimates and must be replaced by reproducible corpus benchmarks before adoption.

Abbreviations: Fit capability fit; Mat maturity; Ext extensibility; Win Windows; Off offline; Perf performance; Ar Arabic; Tbl tables; Lay layout preservation; Lic licence suitability; Maint maintenance activity; Int integration simplicity; Risk low operational risk.

### Crawling and HTML extraction

| Engine | Fit | Mat | Ext | Win | Off | Perf | Ar | Tbl | Lay | Lic | Maint | Int | Risk | Role |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Scrapy | 5 | 5 | 5 | 4 | 5 | 5 | 3 | 2 | 2 | 5 | 5 | 3 | 4 | Preferred bounded HTTP crawler |
| Playwright | 3 | 5 | 5 | 5 | 3 | 2 | 4 | 3 | 5 | 5 | 5 | 3 | 2 | Explicit rendered-page fallback |
| Crawlee (TS) | 4 | 4 | 5 | 4 | 3 | 4 | 3 | 2 | 4 | 5 | 5 | 4 | 3 | Alternative if control-plane-native crawling wins benchmark |
| Trafilatura | 5 | 4 | 4 | 4 | 5 | 4 | 4 | 3 | 3 | 2 | 4 | 4 | 3 | Static extraction candidate subject to GPL review |

Scrapy is cross-platform, Python 3.10+, BSD-3-Clause, and actively maintained, but Windows installation may require C++ build tooling for some dependencies ([Scrapy repository](https://github.com/scrapy/scrapy), [installation guide](https://docs.scrapy.org/en/latest/intro/install.html)). Playwright supports Windows and all three major engines and is Apache-2.0, but pins/downloads substantial browser binaries, which must be pre-provisioned for offline use ([Playwright repository](https://github.com/microsoft/playwright), [browser management](https://playwright.dev/docs/browsers)). Crawlee is Apache-2.0 and actively maintained with HTTP and browser adapters, but overlaps the TypeScript control plane and risks encouraging a browser-first crawler ([Crawlee repository](https://github.com/apify/crawlee)). Trafilatura can extract from already-fetched HTML but is GPL-3.0-or-later; distribution/linkage implications require review before embedding ([Trafilatura repository](https://github.com/adbar/trafilatura)).

### Document and OCR engines

| Engine | Fit | Mat | Ext | Win | Off | Perf | Ar | Tbl | Lay | Lic | Maint | Int | Risk | Role |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Docling | 5 | 4 | 5 | 4 | 4 | 3 | 3 | 5 | 5 | 5 | 5 | 3 | 3 | Preferred conversion benchmark |
| Apache Tika | 3 | 5 | 4 | 4 | 5 | 3 | 3 | 2 | 2 | 5 | 5 | 2 | 3 | Broad-format/type/metadata fallback |
| Tesseract | 4 | 5 | 4 | 4 | 5 | 3 | 4 | 1 | 1 | 5 | 4 | 3 | 4 | Initial OCR baseline |
| PaddleOCR | 4 | 4 | 4 | 3 | 3 | 3 | 3 | 5 | 5 | 5 | 5 | 2 | 2 | Deferred OCR/layout benchmark |

Docling is MIT-licensed, supports Windows, unified structured output, PDF layout, tables and multiple offline OCR providers; its models and resource consumption still need a Windows CPU benchmark ([Docling repository](https://github.com/docling-project/docling), [supported formats](https://docling-project.github.io/docling/usage/supported_formats/)). Tika is Apache-2.0, mature, broad-format, and recently added Markdown handling, but requires Java and is weaker at faithful layout ([Tika repository](https://github.com/apache/tika), [Tika 3.3.0](https://tika.apache.org/3.3.0/index.html)). Tesseract is Apache-2.0 with an Arabic model and Windows installation path, but provides OCR rather than document structure ([Tesseract repository](https://github.com/tesseract-ocr/tesseract), [language installation](https://github.com/tesseract-ocr/tessdoc/blob/main/Installation.md)). PaddleOCR is Apache-2.0, active, supports multilingual recognition and strong table/layout pipelines, but its model/runtime packaging and Arabic quality must be independently tested ([PaddleOCR repository](https://github.com/PaddlePaddle/PaddleOCR)).

### Dataset engines

| Engine | Fit | Mat | Ext | Win | Off | Perf | Ar | Tbl | Lay | Lic | Maint | Int | Risk | Role |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| pandas | 4 | 5 | 5 | 5 | 5 | 3 | 5 | 5 | 3 | 5 | 5 | 5 | 4 | Compatibility and Excel edge cases |
| Polars | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 5 | 2 | 5 | 5 | 4 | 4 | Preferred transformation engine |
| PyArrow | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 2 | 5 | 5 | 3 | 4 | Canonical Arrow/Parquet layer |
| DuckDB | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 2 | 5 | 5 | 5 | 4 | Bounded inspection/query engine |

Arabic is data rather than OCR for these tools; all score well when UTF-8/schema handling is controlled. pandas is BSD-3-Clause and highly mature ([pandas project](https://pandas.pydata.org/)). Polars is MIT-licensed and Arrow-oriented ([Polars repository](https://github.com/pola-rs/polars)). PyArrow is Apache-2.0 with official Windows wheels and Parquet support ([Arrow installation](https://arrow.apache.org/install/), [PyArrow installation](https://arrow.apache.org/docs/python/install.html)). DuckDB is MIT-licensed, Windows-capable, actively released, and queries Parquet locally; disable automatic extension installation/download in offline/governed execution ([DuckDB releases](https://github.com/duckdb/duckdb/releases), [release calendar](https://duckdb.org/release_calendar)).

## 26. Licence and maintenance assessment

Permissive candidates (MIT, Apache-2.0, BSD-3-Clause) are suitable in principle, subject to a dependency/NOTICE/model-licence inventory at adoption. Engine code licence does not automatically cover downloaded models, browser binaries, language data, transitive native libraries, or input/output content rights.

Trafilatura's GPL-3.0-or-later status is the only clear licence caution among the minimum set. Before adoption, decide with counsel whether use is internal only, subprocess isolation is sufficient for the intended distribution, and source-offer obligations are acceptable. If not, prefer a permissive Readability implementation plus source selectors.

Maintenance is currently strong across the shortlisted projects, but “active” is not a pinning policy. Each adoption gate must record exact version, release date, source URL, package and model hashes, supported Python/Node/Java versions, CVE scan, licence files, rollback version, and a quarterly review owner. Do not use `latest` for worker dependencies.

## 27. Windows and offline-operation assessment

- Maintain a locked Python virtual environment with hashes and a documented supported CPython version. Build an offline wheelhouse during an approved connected setup step.
- Pre-download and checksum Docling/OCR models. Providers must fail closed if a model is missing; no runtime model download.
- Preinstall one Playwright Chromium revision into a configured local cache; set browser download off at runtime.
- Tika requires a pinned local Java runtime/JAR. Tesseract requires a pinned executable and `ara.traineddata` checksum.
- Prefer binary wheels for Scrapy native dependencies, PyArrow, Polars, DuckDB, and document engines; test on a clean Windows machine without Visual Studio.
- Use `spawn` semantics and Windows Job Objects/process-tree termination rather than Unix signal assumptions.
- Test long paths, Unicode/Arabic filenames, file locking, antivirus latency, reparse points, case-insensitive collisions, and atomic rename behavior.
- DuckDB extensions, package indexes, browser installers, and model hubs must be disabled or redirected to verified local caches during execution.
- Produce a signed/checksummed offline bill of materials; installation is a separate approved gate, not Phase 3A.

## 28. Security and local-only safeguards

- Bind API, web, worker diagnostics, and any future IPC endpoint to `127.0.0.1`; prefer stdio/named pipes over a worker TCP server.
- Reuse and generalize public-destination checks, per-redirect validation, pinned connections, and bounded decoding. Add proxy-environment suppression unless explicitly approved.
- Require exact domain and path allowlists, deny embedded credentials, limit ports to policy, and resolve all subresources/API pages/sitemaps under the same policy.
- Apply request, byte, decompression, archive, page, row, depth, time, concurrency, and disk-quota budgets.
- Treat all collected bytes as hostile. Never execute scripts/macros/formulas; disable XML external entities and external document resources; quarantine suspicious files.
- Canonicalize paths beneath configured roots; reject traversal, UNC/device paths, ADS, symlinks/reparse points, and unsafe archive entries.
- Workers receive minimum filesystem access, no database credentials, no inherited secrets, and no outbound access unless the job explicitly requires governed collection.
- Redact authorization/cookies/query secrets; cap error/log sizes; return stable external errors with detailed local audit only.
- Sign or checksum policy snapshots and manifests; verify provider/model binaries and artifact hashes.
- No automatic approval, autonomous publication, external AI provider, CAPTCHA bypass, unrestricted crawler, or social corroboration inference.

## 29. Testing strategy

1. Contract tests: JSON Schema fixtures shared by TS/Python; version rejection, unknown fields, numeric bounds, enum transitions.
2. State-machine tests: every allowed/forbidden transition, compare-and-set races, leases, heartbeat expiry, retry/dead-letter/cancel behavior.
3. Artifact tests: stream hashing, immutability, atomic promotion, duplicate bytes, path attacks, missing/orphan reconciliation, corruption detection.
4. Security tests: SSRF IPv4/IPv6/DNS rebinding simulations, redirects, proxy variables, XML entities, zip bombs, decompression limits, oversized PDFs/datasets, malicious filenames.
5. Provider conformance: deterministic request/result, no final-path writes, bounded warnings, missing-model behavior, cancellation, crash and malformed output.
6. Golden corpora: Arabic/English RSS, HTML, born-digital/scanned PDFs, RTL/mixed tables, office documents, CSV/JSON/XLSX/Parquet, malformed and adversarial files. Store only redistributable fixtures.
7. Quality metrics: HTML precision/recall, OCR CER/WER, reading order, heading hierarchy, table cell/structure accuracy, schema fidelity, and analyst correction time.
8. Operational tests: API/worker crash recovery, duplicate delivery, stale leases, disk full, locked files, PostgreSQL interruption, graceful shutdown, CPU/RAM/disk budgets.
9. Compatibility tests: all current API tests/builds plus frozen RSS fingerprint vectors, collection accounting, source APIs, scheduler behavior, and event evidence.
10. Windows clean-room test: install from offline bundle, run with network disabled, verify no download attempts and localhost-only listeners.

Adoption thresholds must be set before running engine benchmarks. A provider cannot pass solely on qualitative examples.

## 30. Migration risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Polymorphic provenance breaks `Article` APIs | High | additive tables and compatibility projection; never repurpose existing columns |
| RSS fingerprints drift | High | frozen `rss-article-v1` function and vectors; no backfill |
| Two schedulers collect the same source | High | staged cutover, durable concurrency key, one scheduler enabled at a time |
| Dual writes partially fail | High | transactional metadata/outbox, idempotent projection, reconciliation |
| Raw storage grows without bound | High | quotas, observed retention policy, archive gate; no silent deletion |
| Files and PostgreSQL diverge | High | staging/promote protocol, manifests, reconciliation and backup consistency |
| Enum migrations become rigid | Medium | validate lifecycle in application/lookup tables initially; add DB enums only when stable |
| Cascades destroy provenance | High | use restrict/tombstone semantics for new evidence; audit existing cascade behavior before links |
| Provider upgrade changes output | High | pin versions/models, derivation keys, golden tests, parallel reprocessing |
| Windows native dependency failures | Medium-high | clean-room wheelhouse/model/browser/JRE test before merge |
| GPL/model/content licence surprise | High | software and model SBOM plus source-specific content licence review |
| Queue starvation/duplicate execution | Medium | leases, idempotency, priorities, concurrency keys, metrics, repair tooling |
| Existing `0.0.0.0` binding violates gate | High | first implementation gate changes default to `127.0.0.1` with listener test |

No destructive migration, reset, rename, or drop is appropriate. Snapshot counts/fingerprints/source states before and after every later migration, following the successful Phase 2 preservation approach.

## 31. Exact Phase 3 gate sequence

Each gate requires an explicit approval before implementation and stops with evidence.

1. **3A — Architecture and engine evaluation:** approve/revise this report; no runtime change.
2. **3B — Contracts and threat model:** JSON Schemas, state machines, ADRs, threat model, corpus/benchmark plan; no database or engines.
3. **3C — Artifact-store prototype:** immutable staging/promote/read/verify abstraction, path safety and reconciliation tests using fixtures; no ingestion engine.
4. **3D — Worker protocol prototype:** TS supervisor plus dependency-light Python echo/reference provider, cancellation and process-tree tests; no DB credentials/network.
5. **3E — Governed engine and extraction benchmarks:** the fixed sub-gates are:
   - **3E-D — Polars:** governed Polars benchmark.
   - **3E-E — PyArrow:** governed PyArrow benchmark.
   - **3E-F — DuckDB:** governed DuckDB benchmark.
   - **3E-G — HTML extraction:** governed HTML-extraction evaluation.
   - **3E-H — PDF and general document extraction:** governed PDF/document evaluation.
   - **3E-I — OCR:** omitted from the current implementation program; future optional development only.
   - **3E-J — crawler and browser:** governed crawler/browser evaluation; comparative benchmark completed with Scrapy as the primary static benchmark engine and Playwright as the dynamic fallback, without production registration.
6. **3F — Provider framework:** provider-neutral framework work begins here.
7. **3G — Durable jobs and database persistence:** durable queue, lease, attempt, and persistence work begins here.
8. **3H — Acquisition pipeline:** production acquisition work begins here.
9. **3I — Extraction routing:** production extraction-routing work begins here.
10. **3J — Normalization pipeline:** production normalization work begins here.
11. **3K — Governance and review workflow:** governance and analyst-review workflow work begins here.
12. **3L — API and UI:** ingestion API and user-interface work begins here.
13. **3M — Production hardening:** production security, reliability, deployment, and operational hardening begins here.

### Phase-number protection

Phase numbers and scopes must not be silently repurposed. In particular, `3E-E`
is PyArrow and must not be used for Polars hardening. `3E-F` is DuckDB and must
not be renamed as a final-comparison phase. PyArrow and DuckDB must not be
skipped. HTML, PDF/general-document extraction, optional future OCR, and
crawler/browser remain separate scopes; omitting 3E-I does not renumber 3E-J.

Provider framework work begins only at `3F`; durable jobs and database work only
at `3G`; acquisition only at `3H`; extraction routing only at `3I`; production
normalization only at `3J`; governance/review only at `3K`; API/UI only at `3L`;
and production hardening only at `3M`.

Technical hardening discovered during an earlier benchmark must be recorded as a
limitation, recommendation, proposed future sub-gate, or explicitly authorized
later work. It must not replace the next roadmap phase.

### Phase-transition standard

Before beginning a new phase, the implementation agent must verify and report:

1. previous phase name;
2. previous phase branch;
3. previous phase acceptance commit;
4. current branch and HEAD;
5. clean working-tree state;
6. exact next phase from this roadmap;
7. proposed branch name;
8. scope boundaries;
9. protected paths;
10. stop conditions; and
11. whether the gate begins with audit, installation authorization, implementation, or validation.

If an instruction conflicts with this authoritative roadmap, the agent must stop
before changing files and report the conflict.

### Branch naming standard

Expected branches are:

```text
phase-3e-d-polars-benchmark
phase-3e-e-pyarrow-benchmark
phase-3e-f-duckdb-benchmark
phase-3e-g-html-extraction
phase-3e-h-document-extraction
phase-3e-i-ocr
phase-3e-j-crawler-browser
phase-3f-provider-framework
phase-3g-durable-jobs-database
phase-3h-acquisition
phase-3i-extraction-routing
phase-3j-normalization
phase-3k-governance-review
phase-3l-api-ui
phase-3m-production-hardening
```

A branch name must not combine a phase number with the wrong scope.

## 32. Recommended branch and commit sequence

Do not commit Phase 3A until the report is accepted. Later, use small reviewable branches from the verified baseline and merge in gate order. Suggested commits (one concern each):

1. `docs(ingestion): record approved Phase 3A architecture`
2. `docs(ingestion): add threat model and architecture decisions`
3. `feat(ingestion-contracts): add versioned protocol schemas`
4. `test(ingestion-contracts): add cross-language contract fixtures`
5. `feat(artifact-store): add immutable local artifact abstraction`
6. `test(artifact-store): cover integrity and path containment`
7. `feat(ingest-worker): add local subprocess protocol`
8. `test(ingest-worker): cover limits cancellation and crashes`
9. `docs(ingestion): record reproducible provider benchmarks and licences`
10. `feat(db): add ingestion governance metadata` (only after migration approval)
11. `feat(ingestion-core): add PostgreSQL job leases and audit transitions`
12. `feat(ingestion-documents): add review-required document pipeline`

Use a dedicated branch per approved gate, for example `phase-3b-ingestion-contracts`, rather than one long-lived Phase 3 branch. Never mix generated lockfile/dependency changes, migrations, provider integration, and RSS cutover in one commit. Migration commits include preservation queries/results and rollback guidance, but never a destructive rollback command.

## 33. Explicitly deferred items

- Production code, dependencies, migrations, database writes, services, and commits.
- Final engine selection until reproducible Arabic/English and adversarial benchmarks.
- Trafilatura adoption pending GPL review.
- PaddleOCR, VLM-based conversion, local or external LLMs, and any external AI provider.
- GDAL/GeoPandas and geospatial storage/coordinate governance.
- Redis, RabbitMQ, distributed workers, containers, cloud queues, and object storage.
- SQLite and DuckDB as governance databases; DuckDB remains a bounded query tool only.
- Whole-domain crawling, CAPTCHA/anti-bot bypass, proxy rotation, stealth automation, and arbitrary browser scripts.
- Authenticated/private sources, credential creation, and secret-store changes.
- Social-platform-specific APIs, credentials, retention logic, and automatic corroboration.
- Webhooks and internal Flaha product signals until their trust/authentication contracts are approved.
- Automatic classification, event creation, evidence approval, publication, or analyst impersonation.
- Retention/deletion policy, malware scanner selection, encryption-at-rest/key management, signing infrastructure, and remote backup implementation.
- Breaking or deleting `Article`, `RssSource`, `CollectionRun`, `EventEvidence`, existing routes, fingerprints, migrations, or registry evidence.

## 34. Gate recommendation

Approve Phase 3A conditionally on four decisions being retained for the next gate:

1. TypeScript is the sole governance/database control plane; Python is a replaceable, database-blind worker.
2. PostgreSQL stores metadata and durable job state; immutable bytes and normalized artifacts live in a content-addressed filesystem store.
3. Existing RSS remains a frozen compatibility path until a late, tested adapter cutover.
4. No engine is adopted until licence/model inventory, Windows offline packaging, security limits, and corpus thresholds pass.

The next authorized work should be Phase 3B documentation and contracts only.
