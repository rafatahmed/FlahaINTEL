# Gate 3B acceptance checklist

Gate 3B is accepted only when every item is confirmed.

## Scope and baseline

- [ ] Work is on `phase-3b-ingestion-contracts` from the approved Phase 3A and loopback-binding baseline.
- [ ] Changes contain documentation, JSON Schemas and inert fixtures only.
- [ ] No package manifest, lockfile, application source, Prisma, migration, RSS, API/web contract, database or environment file changed.
- [ ] No dependency, engine, service, generated TypeScript/Python code, staging action or commit was performed.

## Canonical contracts

- [ ] Draft 2020-12 JSON Schema is documented as canonical.
- [ ] Thirteen public schemas and one shared schema exist under `schemas/v1`.
- [ ] Every schema has `$schema`, stable `$id`, title and strict object boundaries.
- [ ] Top-level protocol messages require exact `contractVersion`, correlation, causation, job and attempt identity.
- [ ] Unknown major/minor versions and unknown top-level/nested fields have rejection fixtures.
- [ ] UUIDs, safe integers, SHA-256 values, static bounds and stable enums are enforced.
- [ ] UTC timestamps combine `format: date-time` with a trailing-`Z` pattern; numeric offsets are rejected.
- [ ] Large content moves only through `ArtifactReference`.
- [ ] Relative-key rules reject traversal, Windows/POSIX absolute, UNC, device, ADS and reserved-device paths.
- [ ] No schema accepts database credentials, inline raw/base64 content, arbitrary environment data or final absolute paths.
- [ ] Operation/payload and terminal outcome/result/error conditions are enforced.

## Validation ownership

- [ ] Shape, control-plane semantic, policy-dependent and protocol-sequence validation are separately documented.
- [ ] Schema limitations explicitly include policy byte limits, staging ownership, timestamp ordering, sequence ordering, terminal cardinality, fencing, artifact existence and checksum correctness.
- [ ] TypeScript owns semantic, policy, sequence, fencing, promotion and database validation.
- [ ] Workers remain database-blind, provider-neutral and unable to approve content or select final paths.

## Protocol and lifecycle

- [ ] Protocol sequencing specifies one request, zero-or-more progress, strictly increasing sequences, exactly one result and no post-terminal messages.
- [ ] Session IDs must match; late/fenced results are rejected and quarantined.
- [ ] Job, attempt, item, document, dataset, normalized-content, review and artifact state machines specify transitions, guards, authority and terminal behavior.
- [ ] Processing success and analyst approval are separate.
- [ ] Raw artifacts and registered normalized versions are immutable.

## Security and architecture

- [ ] The threat model covers all required network, path, parser, worker, integrity, leakage, resource, lease, duplicate, promotion and divergence threats.
- [ ] Every threat maps to controls and verification evidence; residual risks are recorded.
- [ ] All eight ADRs preserve TypeScript database ownership, stdio JSONL, future PostgreSQL queue, filesystem artifacts, provider neutrality, RSS compatibility, analyst authority and local-only operation.

## Benchmarks

- [ ] Development and blind corpora cover English, Arabic, RTL/LTR, digital/scanned/rotated/malformed documents, tables, static/rendered HTML, CSV, JSON, Excel, Parquet and adversarial fixtures.
- [ ] Fixture provenance, licensing, checksums, ground truth and reference-machine conditions are required.
- [ ] Quantitative thresholds cover OCR, reading order, headings, tables, HTML, dataset fidelity, determinism, offline behavior, memory, runtime, disk, warnings, cancellation and recovery.
- [ ] Thresholds apply per corpus stratum; aggregate scores cannot hide Arabic or difficult-input failures.

## Validation evidence

- [ ] Every `.json` file parses and every JSONL record parses.
- [ ] Existing Draft 2020-12 tooling is inventoried without download or dependency changes.
- [ ] Every schema meta-validates and compiles, or any unavailable validation is reported pending.
- [ ] Every local `$ref` target exists and no contract `$ref` requires network access.
- [ ] All valid fixtures pass their intended schemas.
- [ ] All shape-invalid fixtures fail their intended schemas.
- [ ] Policy-prefix and JSONL sequence fixtures fail in their correct non-schema validation layers.
- [ ] Actual changed-file, schema and fixture counts are reported from the working tree.
- [ ] `git diff --check` and a supplemental untracked-file whitespace check pass.
- [ ] Working tree contains only approved Gate 3B files and nothing is staged or committed.
