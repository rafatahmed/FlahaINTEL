# Stuck jobs

1. List jobs in RUNNING/LEASED older than lease window.
2. Run stale-recovery worker.
3. READY jobs with no live worker: `systemctl start flahaintel-pipeline.service`. Confirm `flahaintel-pipeline.path` and `flahaintel-pipeline-need.timer` are **enabled**. `journalctl -u flahaintel-pipeline.service -n 80`. Do not rely on sudo from the API.
4. Cancel user-facing stuck submissions if needed.
5. Inspect provider diagnostics (safe fields only).
