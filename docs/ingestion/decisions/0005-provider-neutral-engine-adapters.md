# ADR-0005: Provider-neutral engine adapters

Status: Proposed

## Decision

Flaha-owned JSON Schemas and normalization rules define the boundary. Engine SDK objects, classes and native result types remain inside adapters.

## Consequences

Providers can be benchmarked and replaced. Engine-specific features cross the boundary only after becoming governed neutral capabilities. Exact provider, adapter, binary and model identities remain provenance.
