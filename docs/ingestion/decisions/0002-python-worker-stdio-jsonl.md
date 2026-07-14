# ADR-0002: Python worker over stdio JSONL

Status: Proposed

## Decision

Pinned local Python subprocesses exchange bounded, versioned JSONL messages over stdio. Large content moves by artifact reference.

## Consequences

No worker port or service lifecycle is required. Stdout is protocol-only; logs are bounded elsewhere. Framing, sequence, cancellation, process-tree termination and exactly-one-terminal validation are mandatory.
