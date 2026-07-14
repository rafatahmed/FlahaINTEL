# ADR-0007: No worker approval authority

Status: Proposed

## Decision

Workers may report technical processing success but cannot approve, publish, create approved evidence, or impersonate an analyst.

## Consequences

Review status is TypeScript-owned and auditable. Worker schemas contain no approval command. Social signals and all normalized outputs remain unapproved until an authorized review action.
