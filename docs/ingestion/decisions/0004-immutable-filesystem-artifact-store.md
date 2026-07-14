# ADR-0004: Immutable filesystem artifact store

Status: Proposed

## Decision

Raw bytes and versioned outputs use SHA-256-addressed local filesystem artifacts. PostgreSQL stores logical relative keys and verified metadata.

## Consequences

Promotion is staged, verified and atomic on one volume. Raw artifacts are write-once; analyst corrections create versions. Reconciliation and coordinated filesystem/database backup are required.
