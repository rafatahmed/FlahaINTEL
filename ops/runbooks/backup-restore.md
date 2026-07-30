# Backup and restore

**RPO 24h · RTO 4h**

## Backup (manual)

1. Ensure free space: `ops/scripts/check-free-space.ps1`
2. `ops/scripts/backup.ps1` (requires `DATABASE_URL`, `ARTIFACT_STORE_ROOT`)
3. Copy backup directory **off-host** (network share / other disk).
4. Confirm `FLAHA_STATE_DIR/last-backup.json` marker.

## Backup (scheduled — Windows)

1. Configure paths in `.env` / `.flaha-runtimes/runtime-paths.env` (prefer non-C: volumes — see [disk-and-volume-layout.md](./disk-and-volume-layout.md)).
2. Register task (elevated recommended):  
   `powershell -NoProfile -File ops/scripts/register-backup-task.ps1`
3. Wrapper: `ops/scripts/run-scheduled-backup.ps1` (logs to `FLAHA_STATE_DIR/scheduled-backup.log`).
4. Next morning: verify `last-backup.json` age ≤ 24h and off-host copy exists.
5. Unregister: `register-backup-task.ps1 -Unregister`

## Restore (isolated)

1. Provision empty DB + empty artifact root.
2. `ops/scripts/restore.ps1 -BackupDir ... -TargetDatabaseUrl ... -TargetArtifactRoot ... -Force`
3. Verify submissions, jobs, artifacts, candidates, decisions, promotion eligibility.
4. Run readiness and reconciliation.

## Cadence

See [ops-cadence.md](./ops-cadence.md).
