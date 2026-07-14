<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: FlahaINGEST Reference Worker
Introduction:
Documents the deterministic Python reference worker and its safety boundaries.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# FlahaINGEST reference worker

This is a deterministic, standard-library-only protocol test worker. It is not an ingestion engine and exposes no network listener. It reads one bounded `WorkerRequest` JSON line from stdin and writes JSONL protocol messages only to stdout. Diagnostics use stderr.

The `mode` and `delayMs` provider options exist only for protocol tests. After the request, stdin EOF is the prototype cancellation signal because the approved v1 protocol has no cancellation-message schema. Delayed mode acknowledges EOF with progress and one `CANCELLED` result. Forced-cancellation mode intentionally ignores EOF so the TypeScript supervisor can test process-tree termination.

The worker never accesses PostgreSQL, writes artifacts, promotes content, or grants approval.
