# FlahaINGEST contracts

Status: Gate 3B contract source; no runtime implementation.

JSON Schema Draft 2020-12 files under `schemas/v1` are canonical. Future TypeScript and Python types must be generated from these schemas and must not replace them as the source of truth. There are 13 public schemas plus `common.schema.json`.

## Validation layers

Validation is deliberately split into four layers:

1. **JSON Schema shape validation** checks exact version constants, required fields, types, formats, patterns, stable enums, static bounds, discriminators, and unknown-field rejection.
2. **Control-plane semantic validation** checks relationships requiring trusted runtime state: matching request/session IDs, `finishedAt >= startedAt`, known provider registration, artifact existence and checksum correctness, active-attempt fencing, and exactly one accepted terminal result.
3. **Policy-dependent validation** compares values with the current immutable `PolicySnapshot`: `byteLength` and aggregate output size, allowed artifact IDs/media types, allocated staging-prefix ownership, resource budgets, and network/source restrictions.
4. **Protocol sequence validation** checks one request per attempt session, zero or more progress messages, strictly increasing sequence values, exactly one terminal result, and no messages after it. See `protocol-sequencing.md`.

JSON Schema alone cannot enforce `byteLength` against the current policy, exact staging-prefix ownership, timestamp ordering, sequence ordering, exactly one terminal result, active-attempt fencing, artifact existence, or checksum correctness.

## Boundary invariants

- Unknown contract versions and unknown fields fail closed.
- All protocol timestamps use RFC 3339 `date-time` plus a trailing `Z`; numeric UTC offsets are rejected.
- Content moves by `ArtifactReference`, never inline raw/base64 data.
- Workers receive no database credentials or `DATABASE_URL`.
- Workers write only to allocated staging keys and never choose final keys.
- Provider SDK objects do not cross the boundary.
- Raw artifacts remain immutable.
- Processing success never grants analyst approval.
- TypeScript owns database writes and semantic/policy/sequence acceptance.

## Fixtures

`fixtures/valid` contains shape-valid examples. `fixtures/invalid` names the rule each example violates. JSONL sequence fixtures are validated as ordered sessions, not as individual JSON documents.

No generated TypeScript or Python code is part of Gate 3B.
