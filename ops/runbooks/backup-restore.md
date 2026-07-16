# Backup and restore

**RPO 24h · RTO 4h**

## Backup

1. `ops/scripts/backup.ps1`
2. Copy backup directory off-host.
3. Confirm `last-backup.json` marker.

## Restore (isolated)

1. Provision empty DB + empty artifact root.
2. `ops/scripts/restore.ps1 -BackupDir ... -TargetDatabaseUrl ... -TargetArtifactRoot ... -Force`
3. Verify submissions, jobs, artifacts, candidates, decisions, promotion eligibility.
4. Run readiness and reconciliation.
