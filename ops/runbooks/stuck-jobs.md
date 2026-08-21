# Stuck jobs

1. List jobs in RUNNING/LEASED older than lease window.
2. Run stale-recovery worker.
3. READY jobs with no live worker: `systemctl start flahaintel-pipeline.service` (Submit cannot sudo; path unit `flahaintel-pipeline.path` is the kick).
4. Cancel user-facing stuck submissions if needed.
5. Inspect provider diagnostics (safe fields only).
