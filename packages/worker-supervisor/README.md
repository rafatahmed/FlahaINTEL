<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Worker Supervisor Prototype
Introduction:
Documents the TypeScript worker control plane and its protocol boundaries.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Worker supervisor prototype

This package is the Phase 3D TypeScript control plane for a single local Python
worker attempt. It launches one explicitly configured absolute Python executable
without a shell, writes one `WorkerRequest` JSONL line, and accepts zero or more
`WorkerProgress` lines followed by exactly one `WorkerResult` line.

The child environment is an allowlist of Windows process essentials, temporary
directory variables, fixed Python UTF-8 settings, and the test-only
`FLAHA_WORKER_TEST_MARKER`. `DATABASE_URL`, ambient secrets, and the caller's
general environment are not inherited. The worker has no database, network
listener, artifact promotion, metadata-writing, or approval authority.

Validation is intentionally layered. The canonical Phase 3B JSON Schemas supply
the allowed and required top-level message fields. This prototype also enforces
JSONL bounds, known message types, safe sequences, sequencing, attempt identity,
operation ownership, and attempt staging-prefix ownership. It does not claim to
perform complete Draft 2020-12 validation of every nested value; generated types
and a production schema-validator integration remain future work.

Closing worker stdin is the prototype cancellation signal because Gate 3B does
not define a cancellation message. A cooperative worker emits an acknowledgement
progress message and a terminal `CANCELLED` result. After the configured grace
period, the supervisor kills the process group on POSIX or invokes Windows
`taskkill /T /F` for the complete process tree. Wall-clock timeout skips the
grace period. Stderr is bounded diagnostic text only and never protocol input.

Windows tree termination depends on the operating system's process ancestry and
`taskkill` availability. A descendant that escapes into another security context,
job, or host is outside this prototype's guarantee; a future production design
should use a dedicated Windows Job Object for stronger containment.
