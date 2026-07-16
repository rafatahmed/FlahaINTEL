# API failure

1. Check Caddy upstream and `systemctl status flahaintel-api`.
2. Confirm bind is loopback only (`127.0.0.1`).
3. Inspect structured logs for correlation IDs.
4. Verify `/health` vs `/ready` (process vs database).
5. Restart API; if DB is down, follow PostgreSQL runbook.
