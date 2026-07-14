# FlahaINTEL artifact-store prototype

This dependency-free TypeScript package implements Gate 3C only. It has no PostgreSQL, Prisma, API, RSS, web, network, Python, or engine integration.

## Architecture

- `ArtifactRepository` separates lifecycle persistence from filesystem behavior. `InMemoryArtifactRepository` is the prototype implementation and can later be replaced by a PostgreSQL adapter.
- `FilesystemArtifactStore` requires an explicit absolute root and creates it only through `initialize()`.
- TypeScript allocates `staging/<jobId>/<attemptId>/<artifactId>/payload`; callers cannot supply staging or raw final paths during allocation.
- Streaming writes hash SHA-256 and enforce exact byte bounds without whole-file buffering. Successful completion seals the artifact; failures retain an `ABANDONED` partial artifact and bounded diagnostic metadata.
- Reread verification detects changes after sealing. Failures move evidence to quarantine when possible and mark it `QUARANTINED`.
- Only `VERIFIED` content can be promoted. The application supplies the final relative key. Promotion stays within one configured root/volume, rejects case-insensitive collisions and existing targets, and marks `PROMOTED` only after rename succeeds.
- Raw promotion uses `raw/sha256/<2>/<2>/<64-hex>/payload`.
- Reads expose logical metadata and streams, never absolute paths. Optional verified reads detect missing/corrupt content.
- Reconciliation is read-only and returns sorted orphan, missing, unregistered and checksum-mismatch findings.

## Lifecycle

`ALLOCATED -> WRITING -> SEALED -> VERIFIED -> PROMOTING -> PROMOTED`

`QUARANTINED` and `ABANDONED` are failure states. Repository compare-and-set guards reject invalid transitions and wrong job/attempt ownership. Allocation is reject-on-duplicate rather than idempotent.

## Path safety

Logical keys use forward slashes and reject traversal, absolute Windows/POSIX paths, UNC/device paths, ADS, reserved Windows names, empty/dot components, trailing dots/spaces, backslashes, controls, and root escape. Existing path components are checked for detectable symbolic links, junctions or reparse-point links, and real paths must remain under the configured root.

## Atomicity and Windows notes

Staging and final keys resolve beneath the same configured root, so promotion is designed for same-volume `rename`. Node does not expose a portable no-replace rename primitive. The prototype performs a collision check immediately before rename; on Windows, rename does not replace an existing destination. A future cross-platform production gate must add OS-specific no-replace semantics or a lock/transaction protocol before claiming multi-process safety on POSIX.

Windows case-insensitive collisions are rejected proactively on every platform. Reparse detection uses `lstat`, `realpath`, and containment checks; exotic or concurrently substituted reparse points remain a residual race requiring stronger OS-level directory handles/sandboxing in a production gate.

## Commands

- `npm test --workspace=@flaha-intel/artifact-store`
- `npm run build --workspace=@flaha-intel/artifact-store`
