# Stuck jobs

1. List jobs in RUNNING/LEASED older than lease window.
2. Run stale-recovery worker.
3. Cancel user-facing stuck submissions if needed.
4. Inspect provider diagnostics (safe fields only).
