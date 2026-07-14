# ADR-0008: Local-only operation and no worker TCP server

Status: Proposed

## Decision

FlahaINTEL retains its validated loopback API binding. Workers use stdio and expose no HTTP or TCP listener.

## Consequences

Diagnostics use supervisor-owned channels or bounded files. Any remote/distributed-worker design requires a new ADR and security gate. Wildcard host binding remains rejected.
