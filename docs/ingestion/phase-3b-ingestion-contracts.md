# Phase 3B: governed ingestion contracts

Status: proposed Gate 3B deliverable. This gate contains documentation, JSON Schemas, and inert fixtures only.

## Decisions preserved

- TypeScript is the sole PostgreSQL writer and owns governance, jobs, policy, audit, review, verification, and promotion.
- Python workers are database-blind subprocesses using bounded stdio JSONL.
- PostgreSQL is the future durable leased queue; it is not an artifact store.
- Raw evidence and normalized outputs use immutable, content-addressed filesystem artifacts.
- Flaha-owned provider-neutral contracts contain no engine SDK objects.
- Existing RSS behavior, APIs, accounting, and `rss-article-v1` fingerprint behavior remain frozen.
- Worker success has no analyst approval or publication authority.
- Operation is local-only; the API stays loopback-bound and workers expose no TCP server.

## Contract rules

The canonical version is `1.0.0`. Each public message requires correlation and attempt identity. All object boundaries reject unknown fields. IDs are UUIDs, times are UTC `date-time` strings ending in `Z`, integers are safely bounded, and artifact keys are relative forward-slash keys.

Large content is never inline. Workers receive artifact references and a job-scoped staging prefix, not final paths, database credentials, secrets, arbitrary commands, or environment dumps.

Validation is layered as documented in the contract README: schema shape, control-plane semantics, current-policy checks, and stateful protocol sequencing. Passing JSON Schema does not imply authorization, policy compliance, artifact integrity, or processing acceptance.

## State-machine summary

The complete transition, guard, ownership, fencing, terminal, retry, quarantine and correction rules are specified in `state-machines.md`.

- Job: `QUEUED -> LEASED -> RUNNING -> SUCCEEDED`; alternate paths include retry, cancellation, failure and dead letter.
- Attempt: `CREATED -> STARTING -> RUNNING -> SUCCEEDED`; retry creates a new attempt, and late fenced results are rejected.
- Item: `DISCOVERED -> FETCHED -> RAW_STORED -> NORMALIZED -> VALIDATED -> READY_FOR_ANALYSIS`.
- Document processing: `UPLOADED -> CHECKSUM_VERIFIED -> CONVERTED -> NORMALIZED`.
- Dataset: `DISCOVERED -> DOWNLOADED -> SCHEMA_VALIDATED -> VERSIONED -> IMPORTED -> READY`.
- Normalized content: `STAGED -> INTEGRITY_VERIFIED -> REGISTERED -> AVAILABLE`; correction creates a new version.
- Review: `UNREVIEWED -> REVIEW_REQUIRED -> APPROVED|REJECTED`, separate from processing.
- Artifact: `ALLOCATED -> WRITING -> SEALED -> VERIFIED -> PROMOTING -> PROMOTED`; failures quarantine or abandon.

Every future durable transition is a TypeScript-owned compare-and-set operation with an audit event. Terminal state exceptions require a separately governed action, never a worker assertion.

## Gate acceptance

- All 14 schemas parse and meta-validate under Draft 2020-12.
- All local `$ref` targets resolve without network access.
- Valid fixtures pass and invalid fixtures fail their intended layer.
- JSONL sequence violations are separately detected.
- Threats, ADRs, benchmark strata and quantitative thresholds are documented.
- No runtime code, dependency, generated type, database, Prisma, RSS, route, fingerprint, environment, or service change is included.
- Changed-file audit and `git diff --check` pass; nothing is staged or committed.
