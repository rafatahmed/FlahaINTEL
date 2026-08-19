<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Deploy runbook
Introduction: Change-controlled deploy steps; small-host Linux path is separate.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-08-19
-->

# Deploy

**Small-host first boot:** [small-host-2g-full.md](./small-host-2g-full.md) (`install-small-host.sh`).  
**Small-host later updates / Prisma migrate:** [small-host-update-and-migrate.md](./small-host-update-and-migrate.md) (`update-small-host.sh`).

1. Obtain change approval (no automatic production deploy).
2. Ensure clean CI on the release commit.
3. Run `ops/scripts/backup.ps1` and confirm off-host copy.
4. Deploy with `ops/scripts/deploy.ps1 -ReleaseId <id> -Approved`.
5. Apply migrations as migrator role: `npm run prisma:migrate:deploy --workspace=@flaha-intel/api`.
6. Restart API then workers (`acquisition`, `extraction`, `normalization`, `submission-advance`, `stale-recovery`).
7. Run `ops/scripts/smoke-test.ps1`.
8. Authenticate and check `/api/system/readiness`.
9. Monitor alerts for 30 minutes.
