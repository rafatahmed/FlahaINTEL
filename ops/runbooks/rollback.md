# Rollback

1. Approve rollback explicitly.
2. Identify last known-good release id under `$FLAHA_DEPLOY_ROOT/releases`.
3. Run `ops/scripts/rollback.ps1 -ReleaseId <id> -Approved`.
4. Restart API and workers.
5. Do **not** re-run forward migrations automatically.
6. If schema is incompatible, restore DB from pre-deploy backup into a maintenance window.
7. Smoke test `/health` and `/ready`.
