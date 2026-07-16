# Acquisition worker failure

1. Inspect `flahaintel-worker@acquisition` logs.
2. Verify Scrapy runtime and network allowlist.
3. Confirm no worker TCP ports are open.
4. Restart worker unit; run stale-recovery.
5. Cancel stuck submissions if user-visible.
