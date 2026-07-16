<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3K Governance, Review and Promotion
Introduction:
Defines the governed review workflow from immutable normalized content to promotion eligibility.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# Phase 3K — Governance, Review and Promotion

## Scope

Phase 3K converts verified Phase 3J normalized content into governed review candidates with:

- deterministic evidence checks (non-AI);
- authorized analyst / reviewer decisions;
- immutable decision history;
- candidate versioning and correction links;
- source governance policies;
- promotion eligibility evaluation (not publication).

Required flow:

```text
verified normalized content
→ create governance candidate
→ deterministic governance evaluation
→ evidence completeness classification
→ reviewer assignment
→ approve, reject, correct, hold, or withdraw
→ evaluate promotion eligibility
→ preserve immutable history and provenance
```

## Non-goals

Phase 3K does **not** implement:

- public publication;
- search indexing;
- embeddings;
- AI summarization;
- entity extraction;
- topic classification;
- sentiment analysis;
- autonomous factual approval;
- automatic source-trust scoring from popularity;
- OCR;
- live acquisition.

Promotion eligibility is **not** publication. Phase 3L owns broader product API/UI work beyond this internal console.

## Data models

Additive Prisma migration `20260716120000_phase_3k_governance_review` introduces:

| Model | Purpose |
| --- | --- |
| `UserAccount` | Authenticated governance principal |
| `Tenant` | Organization / tenant scope |
| `TenantMembership` | Active role binding |
| `GovernanceCandidate` | Reviewable candidate metadata (no content body) |
| `GovernanceDecision` | Append-only decision events |
| `GovernanceAssignment` | Reviewer assignment history |
| `SourceGovernancePolicy` | Administrative source controls |
| `PromotionEligibility` | Eligibility snapshots + invalidation |
| `CandidateRelationship` | Duplicate / version / correction links |

Candidate rows store hashes, lineage job IDs, evidence completeness, states, priority, and version counters. Normalized bodies remain in the artifact store only.

## State machine

Review states:

```text
PENDING_EVALUATION
READY_FOR_REVIEW
NEEDS_CORRECTION
ON_HOLD
APPROVED
REJECTED
PROMOTION_ELIGIBLE
PROMOTED
WITHDRAWN
```

Legal actions:

```text
EVALUATE, ASSIGN, APPROVE, REJECT, REQUEST_CORRECTION,
PLACE_ON_HOLD, RELEASE_HOLD, WITHDRAW_APPROVAL,
MARK_PROMOTION_ELIGIBLE, MARK_PROMOTED, WITHDRAW, SUPERSEDE
```

Unspecified transitions are rejected. Mutable candidate updates require optimistic `expectedCandidateVersion` and `expectedCurrentState`.

## Roles

| Role | Permissions |
| --- | --- |
| `VIEWER` | Inspect candidates, evidence, lineage, history |
| `ANALYST` | Inspect, bounded notes, request correction |
| `REVIEWER` | Assign, approve, reject, hold, release, request correction, withdraw, relationships |
| `GOVERNANCE_ADMIN` | All reviewer actions + source policies, withdraw approval, mark eligibility, create candidates |

Actor identity is taken **only** from authenticated headers (`X-Flaha-User-Id`, `X-Flaha-Tenant-Id`) after membership verification. Request bodies must not supply actor IDs.

## Evidence completeness

Values: `COMPLETE` | `PARTIAL` | `INSUFFICIENT` | `CONFLICTING`.

Derived from locators, lineage artifacts, hashes, language, content type, provenance, warnings, and quality indicators. Completeness is **not** truthfulness or credibility.

## Automated governance checks

Deterministic checks cover artifact integrity, lineage, supported type/language, source policy, normalization warnings, empty/low text, missing metadata, truncation, structure/table/encoding warnings, exact duplicate hashes, analyst-review flags, provenance gaps, and evidenced content age.

Checks emit flags, blockers, warnings, priority, and routing state. They never assert factual truth.

## Source policies

Administrators create/update/inspect policies per tenant source with:

- status, allowed modes/types/languages;
- review and promotion requirements;
- retention and sensitivity labels;
- **trust tier** (never inferred from popularity);
- owner, effective/review dates, optimistic version.

Incompatible policy updates invalidate promotion eligibility for affected candidates.

## Analyst workflow

Typed commands:

```text
assignCandidate, approveCandidate, rejectCandidate,
requestCandidateCorrection, placeCandidateOnHold, releaseCandidateHold,
withdrawCandidateApproval, markCandidatePromotionEligible, withdrawCandidate
```

Each requires candidate ID, expected state/version, reason code, optional bounded note (≤2000 chars), idempotency key, and correlation ID.

## Immutable history

Every successful action appends a `GovernanceDecision`. Corrections and withdrawals append new events. Application routes reject `PATCH`/`DELETE` on decisions.

## Correction and versioning

```text
candidate → NEEDS_CORRECTION
→ replacement extraction/normalization
→ new immutable normalized artifact
→ new candidate version + CORRECTION_OF / SUPERSEDES relationships
→ independent evaluation and review
```

Original candidates and decisions are preserved.

## Duplicates

Exact hash matches create `EXACT_DUPLICATE` relationships. Reviewers may add `LIKELY_DUPLICATE` or `UPDATED_VERSION` and choose keep-both / mark / reject / supersede without silent merges or deletes.

## Promotion eligibility

Evaluated only when approved, hash-stable, lineage/policy/language/type satisfied, no terminal integrity blocker, and not withdrawn/superseded/quarantined.

Eligibility snapshots persist blockers and policy version. Invalidation triggers:

- content hash change;
- approval withdrawal;
- incompatible source policy change;
- quarantine / supersession / missing lineage.

No content is published.

## Internal API

Authenticated routes under `/api/governance/*`:

- list/inspect candidates, evidence, preview, decisions, assignments, eligibility;
- create candidate from normalization job;
- decision commands and relationships;
- source policy CRUD;
- retention policy document;
- explicit decision mutation rejection.

Queue filters: state, priority, evidence completeness, reviewer, source, language, content type, promotion state, created date.

## Review console

Narrow internal web tab **Governance**:

- candidate queue;
- detail with preview, lineage, hashes, warnings, policy, state;
- authorized decision controls with reason/note;
- chronological decision history;
- evidence panel without storage paths/secrets.

## Concurrency

Optimistic concurrency: conflicting decisions yield one success and one `VERSION_CONFLICT` or `STATE_CONFLICT`. No last-write-wins.

## Security

Enforced controls include authentication, role authorization, tenant isolation, forged-actor rejection, hash/state/version checks, unsupported-content approval blocks, idempotency replay, note/reason validation, and decision immutability.

## Retention

`STANDARD_GOVERNANCE_RETENTION` retains acquisition/extraction/normalized artifacts while referenced; candidates and decisions are not hard-deleted through normal application commands. Diagnostics follow a shorter horizon. See `RETENTION_POLICY` in code.

## Unsupported paths

The following cannot become approved or promotion-eligible:

- PPTX;
- Arabic authoritative PDF;
- bilingual authoritative PDF;
- quarantined content;
- failed normalization;
- hash-mismatched content.

No administrator override silently converts unsupported artifacts into authoritative content. Exceptions require a new supported normalized artifact and candidate version.

## Relationship to Phase 3L

Phase 3L may expand product-facing API/UI. Phase 3K delivers the governance control plane and a minimal internal console only. 3L is not started by this phase.
