# ADR-0006: Frozen RSS compatibility path

Status: Proposed

## Decision

Existing RSS parsing, transport behavior, routes, scheduler semantics, collection accounting and `rss-article-v1` fingerprint identity remain unchanged through early FlahaINGEST gates.

## Consequences

Later adoption requires shadow/parity tests and rollback. Shared safety behavior may be extracted only with proven compatibility. New item kinds are not forced into `Article`.
