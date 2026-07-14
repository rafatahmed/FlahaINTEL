# ADR-0001: TypeScript is the sole database writer

Status: Proposed

## Decision

Only the TypeScript control plane receives PostgreSQL credentials and writes governance, lifecycle, audit, review and artifact metadata. Python workers remain database-blind and never receive `DATABASE_URL`.

## Consequences

Worker output is untrusted until schema, semantic, policy, sequence and artifact verification pass. Database invariants and analyst authority remain centralized, at the cost of a stricter supervisor protocol.
