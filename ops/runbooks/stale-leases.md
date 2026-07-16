# Stale leases

1. Start `worker:stale-recovery`.
2. Confirm `recoverExpiredLeases` metrics.
3. Ensure heartbeats are written.
4. Investigate host clock skew.
