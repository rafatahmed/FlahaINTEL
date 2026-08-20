<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3F Provider Framework
Introduction:
Defines the provider control-plane authority, catalogue, contracts, selection, fallback, and security invariants.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-08-19
-->

# Phase 3F provider framework

## Scope and non-goals

Phase 3F introduces a lightweight internal TypeScript framework for cataloguing and selecting benchmark-informed ingestion providers. It does not install, launch, or production-register providers. It adds no database model, durable job, scheduler, API endpoint, UI control, crawler deployment, browser deployment, OCR path, public crawling, or production RSS change.

## Authority boundary

The TypeScript control plane exclusively owns provider identity, capability declarations, eligibility, selection, fallback order, policies, limits, artifact references, result validation, provenance, audit evidence, and production authorization. External Python, Java, browser, or future runtimes receive a closed request and return a bounded result. They cannot select another provider, mutate the catalogue, promote artifacts, write a database, or return arbitrary paths.

```text
provider core → bounded request → isolated adapter/worker
             ← bounded result  ←
             → identity/artifact/policy/result validation
```

The existing ingestion JSON Schemas remain canonical for the external worker protocol. Provider core does not duplicate the artifact-store implementation; it uses the canonical artifact-reference semantics—identifier, closed kind, media type, byte size, SHA-256, namespace and relative key—for control-plane validation.

## Families and capabilities

Families are closed: dataset validation, HTML extraction, document processing, static acquisition, and browser acquisition. OCR is intentionally absent. Capability support is declared per provider with independent support, maturity, authorization, media, language, constraint, runtime, policy, fallback and evidence fields. No benchmark provider is production ready or authorized.

## Catalogue and registry

The immutable built-in catalogue contains:

| Provider ID | Role | Catalogue state |
| --- | --- | --- |
| `dataset.csv.stdlib` | authoritative schema, row and type validation | hardened benchmark primary |
| `dataset.tabular.pandas` | tabular fallback | benchmarked fallback |
| `html.stdlib-htmlparser` | baseline text/link/metadata/encoding | hardened benchmark primary |
| `html.lxml` | DOM/structural extraction | benchmarked, partial, fallback |
| `html.selectolax` | DOM/structural extraction | benchmarked, partial, fallback |
| `html.trafilatura` | content extraction | deferred and not selectable |
| `document.pypdf-inspection` | narrow inspection/metadata/inventory | benchmarked partial candidate |
| `document.pdfminer-six` | general text extraction | rejected and not selectable |
| `document.docling-slim` | former English PDF layout/table engine | rejected and not selectable |
| `document.apache-tika` | PDF/DOCX/RTF/TXT text and metadata | hardened operate primary |
| `acquisition.scrapy` | static HTTP, crawling and link discovery | hardened benchmark primary |
| `acquisition.playwright` | dynamic rendering and browser evidence | hardened benchmark fallback |

Registry construction validates every descriptor, rejects duplicate IDs and contradictions, sorts by stable provider ID, freezes returned values, and exposes deterministic family and capability indexes. It performs no plugin discovery, package scan, dynamic import, or runtime mutation.

## Requests, policies, limits, and artifacts

The request envelope is a discriminated union for dataset, HTML, document, static acquisition, and browser acquisition. Family payloads contain closed options rather than arbitrary option maps. Acquisition uses a governed source locator and requires an exact-origin network policy. Every request carries a typed versioned policy, bounded execution limits, language hints, artifact references and provenance context. It cannot carry credentials, arbitrary environment variables, database settings, shell commands, import paths, absolute paths, or storage roots.

Artifact validation rejects traversal, absolute paths, Windows paths, URLs, device/ADS-like colon paths, malformed SHA-256 values, invalid media types, and negative byte sizes. Limits reject negative, nonfinite, unsafe, or excessive values instead of silently clamping them.

## Selection and fallback

Selection uses a closed capability priority table, never display names or object iteration. Dataset validation chooses stdlib CSV; pandas is only the tabular fallback. Baseline HTML chooses stdlib; structural HTML chooses lxml then selectolax. English PDF text chooses Tika only; layout/section/table have no provider (MinerU is a future approved gate, not in this catalogue); broad format chooses Tika; inspection chooses pypdf. Arabic or bilingual authoritative document extraction returns governed `NO_ELIGIBLE_PROVIDER` and never reverses or repairs text.

Static acquisition chooses Scrapy. Browser acquisition chooses Playwright only with the typed `DYNAMIC_RENDER_REQUIRED` signal. A generic Scrapy failure never automatically upgrades to a browser.

Fallback reasons are closed and chains are finite, deduplicated, family compatible, capability compatible and evidence preserving. Invalid requests, security violations, hash mismatches, unsupported languages and contract violations terminate without fallback.

## Results, provenance, and errors

Results discriminate success, unsupported, policy-blocked, retryable/non-retryable failure, resource limit, cancellation, unavailability and contract violation. Success alone may contain artifacts and structured family output. Validation binds provider/version, contract, capability, request, execution and policy identities; validates timestamps, hashes, output totals, warnings and artifacts; and rejects provider-supplied authority.

Provenance includes provider/version/contract, capability, policy, input/output hashes, selection decision, fallback history, runtime evidence, timestamps and determinism classification. It is returned to the caller and is not persisted in Phase 3F. The closed error taxonomy explicitly records retry, fallback and security semantics.

## Production authorization and security

Every built-in descriptor is `NOT_AUTHORIZED`. When `requireProductionAuthorization` is true, no current provider is eligible and fallback cannot bypass the gate. Provider IDs are validated data and never become imports or commands. Network providers require a governed policy. Unsupported languages cannot silently succeed. Result sizes and diagnostics remain bounded. Fake adapters prove success, unsupported, unavailable, retryable failure, contract violation and cancellation without external runtimes.

## Dependency direction and future extension

```text
apps / future Phase 3G control plane
        ↓
ingestion-provider-core
        ↓ (future request translation only)
worker-supervisor + canonical ingestion JSON Schemas
        ↓
isolated provider adapters
```

Provider core imports none of the downstream layers. A future provider extension requires reviewed code, a validated descriptor, benchmark evidence, a closed adapter, runtime locks, tests, and an explicit production-authorization decision. Dynamic plugins and untrusted JSON definitions are not an extension mechanism.

Phase 3G may persist provider selection, execution, fallback and provenance through durable jobs. Phase 3F performs no persistence and grants no production authorization.
