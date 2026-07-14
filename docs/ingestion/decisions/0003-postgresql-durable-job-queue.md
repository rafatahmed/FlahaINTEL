# ADR-0003: PostgreSQL durable job queue

Status: Proposed

## Decision

A future additive gate will use PostgreSQL rows with `FOR UPDATE SKIP LOCKED`, leases, heartbeats, fencing, retries, concurrency keys and idempotency as the local durable queue.

## Consequences

No Redis or broker is initially required. Queue state can participate in governance transactions, while polling, stale leases, starvation and duplicate execution require explicit tests. PostgreSQL never stores large artifacts.
