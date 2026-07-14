# FlahaINGEST state-machine specifications

All durable transitions are TypeScript control-plane compare-and-set operations. A future persistence gate must write the transition and its audit event atomically. Worker messages are observations, not transition authority.

## Ingestion jobs

States: `QUEUED`, `LEASED`, `RUNNING`, `RETRY_WAIT`, `CANCEL_REQUESTED`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `DEAD_LETTERED`.

| From | Allowed destinations | Guard |
| --- | --- | --- |
| `QUEUED` | `LEASED`, `CANCELLED` | eligible time reached; atomic lease claim, or authorized cancellation |
| `LEASED` | `RUNNING`, `QUEUED`, `CANCEL_REQUESTED` | matching lease/fence; return only after safe release/expiry |
| `RUNNING` | `SUCCEEDED`, `RETRY_WAIT`, `FAILED`, `CANCEL_REQUESTED` | active fenced attempt and verified terminal outcome |
| `RETRY_WAIT` | `QUEUED`, `CANCELLED`, `DEAD_LETTERED` | retry time/limit or authorized cancellation |
| `CANCEL_REQUESTED` | `CANCELLED`, `FAILED` | process ended and outputs quarantined; failure records cleanup failure |
| `FAILED` | `RETRY_WAIT`, `DEAD_LETTERED` | retry policy and attempt limit |

`SUCCEEDED`, `CANCELLED`, and `DEAD_LETTERED` are terminal. Administrative reprocessing creates a new job and audit link.

## Attempts

States: `CREATED`, `STARTING`, `RUNNING`, `CANCELLATION_REQUESTED`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `TIMED_OUT`, `LOST`.

The path is forward-only. Each retry creates a new attempt. Heartbeat expiry plus a fencing check permits `RUNNING -> LOST`; expiry alone is not success or failure. A late message from `LOST`, terminal, cancelled, timed-out, or superseded attempts is rejected and its staging output quarantined.

## Ingested items

Primary path: `DISCOVERED -> FETCHED -> RAW_STORED -> NORMALIZED -> VALIDATED -> READY_FOR_ANALYSIS`.

`FAILED` records the stage and preserves the last durable artifact for retry. `REJECTED` requires an identified policy or analyst actor and reason. `ARCHIVED` requires an approved retention/retraction workflow. Reprocessing creates derived versions and never changes the original raw evidence.

## Documents

Processing path: `UPLOADED -> CHECKSUM_VERIFIED -> CONVERTED -> NORMALIZED`.

Downloaded documents first traverse the common discovery/fetch/raw path. Checksum verification requires artifact existence, size and digest checks. Conversion/normalization success cannot set review approval. Unsupported, malformed, encrypted or policy-exceeding inputs record a failed attempt and governed warning/rejection reason.

## Datasets

Primary path: `DISCOVERED -> DOWNLOADED -> SCHEMA_VALIDATED -> VERSIONED -> IMPORTED -> READY`.

`IMPORTED` means canonical immutable dataset artifacts and metadata are registered, not that every record is stored in PostgreSQL. `REJECTED`, `FAILED`, and `ARCHIVED` follow the same actor/retry/retention rules as items. A changed source creates a new dataset version.

## Normalized content

States: `STAGED`, `INTEGRITY_VERIFIED`, `REGISTERED`, `AVAILABLE`, `SUPERSEDED`, `QUARANTINED`, `ARCHIVED`.

Only verified staged artifacts can be registered. Registration fixes the input checksum, provider/adapter/model identity, options digest and normalization version. Machine output is immutable. Analyst correction creates a new `AVAILABLE` version referencing the machine output; it never overwrites it. Failed verification or fenced output becomes `QUARANTINED`.

## Review status

| From | Allowed destinations | Authority |
| --- | --- | --- |
| `UNREVIEWED` | `REVIEW_REQUIRED`, `REJECTED` | TypeScript policy workflow or analyst |
| `REVIEW_REQUIRED` | `APPROVED`, `REJECTED` | authorized analyst only |
| `APPROVED` | `SUPERSEDED` | authorized analyst/correction workflow |
| `REJECTED` | `REVIEW_REQUIRED` | audited analyst reopen action |

`SUPERSEDED` is terminal. No worker schema contains review authority. `READY_FOR_ANALYSIS` and job `SUCCEEDED` are not approval.

## Artifact staging and promotion

Primary path: `ALLOCATED -> WRITING -> SEALED -> VERIFIED -> PROMOTING -> PROMOTED`.

TypeScript allocates the attempt staging prefix. The worker writes only beneath it and reports candidate references. TypeScript seals and verifies containment, no-follow path safety, media type, byte length, checksum, policy budget and active fencing. TypeScript selects the final logical key and performs same-volume atomic promotion. Raw targets are write-once.

Verification failure leads to `QUARANTINED`; abandoned pre-seal work leads to `ABANDONED`. A crash during `PROMOTING` is never assumed successful. Reconciliation checks the manifest, file and database status and resolves the artifact to `PROMOTED` or `QUARANTINED` with an audit event.
