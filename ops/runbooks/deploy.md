# Deploy

1. Obtain change approval (no automatic production deploy).
2. Ensure clean CI on the release commit.
3. Run `ops/scripts/backup.ps1` and confirm off-host copy.
4. Deploy with `ops/scripts/deploy.ps1 -ReleaseId <id> -Approved`.
5. Apply migrations as migrator role: `npm run prisma:migrate:deploy --workspace=@flaha-intel/api`.
6. Restart API then workers (`acquisition`, `extraction`, `normalization`, `submission-advance`, `stale-recovery`).
7. Run `ops/scripts/smoke-test.ps1`.
8. Authenticate and check `/api/system/readiness`.
9. Monitor alerts for 30 minutes.
