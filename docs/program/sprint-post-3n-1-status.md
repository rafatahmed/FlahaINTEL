<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Post-3N Sprint 1 Status
Introduction:
Tracks systemic execution of the first post-Phase-3N sprint (backbone ops + gate charters).

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Post–3N Sprint 1 status

**Program position:** Systemic package after Phase 3N (platform complete; product lock active).  
**Sprint goal:** Backbone stays healthy; product direction visible in charters without drift.

## Task board

| ID | Task | Status | Notes |
|----|------|--------|-------|
| E1-T1 | Disk / volume layout guidance | **DONE** | `ops/runbooks/disk-and-volume-layout.md` |
| E1-T2 | Scheduled backup registration | **DONE** (tooling) | `register-backup-task.ps1` + `run-scheduled-backup.ps1`; operator must run elevated once per host |
| E1-T3 | Ops cadence runbook | **DONE** | `ops/runbooks/ops-cadence.md` |
| E1-T4 | Free-space check + alert | **DONE** | `check-free-space.ps1`; alert-rules updated |
| E2-T1 | Pin npm deps (no `latest`) | **DONE** | `apps/api/package.json` pinned to lock-known majors |
| E3-T1 | Source policies for ACCEPTED RSS | **DONE** (tooling) | `bootstrap:source-policies`; run after bootstrap:local |
| 4M-0 | Global market model | **IMPLEMENTED** | Migration + validation + `/api/markets/*` |
| 4M-A | Qatar MoCI vegetables channel | **IMPLEMENTED** (source) | Seeded `qa-moci-daily-vegetables`; daily scrape muscle next |
| 4S-A | Soil/irrigation pack schema | **IMPLEMENTED** | `/api/knowledge-packs` + schema doc |
| 4M-B | Jordan second | PLACEHOLDER in registry | Official URL pending ownership evidence |

## Operator one-time on this host

```powershell
npm run ops:check-free-space
npm run bootstrap:local
npm run bootstrap:rss-accepted   # if needed
npm run bootstrap:source-policies
# Elevated if desired:
# npm run ops:register-backup-task
```

## Next

1. **4M-C / muscle:** parse MoCI daily HTML/PDF into `MarketPriceObservation` rows (with evidence)  
2. **4M-B:** confirm Jordan official URL + enable channel  
3. Sample knowledge pack via API for soil thresholds  
4. Host: free disk + register backup task  

## Exit criteria for Sprint 1

- [x] Ops runbooks and scripts landed  
- [x] Deps pinned  
- [x] Policy bootstrap available  
- [x] Market/soil gate charters written  
- [x] Owner approved 4M-0 / 4M-A / 4S-A  
- [x] 4M-0 / 4M-A / 4S-A implemented (foundation)  
- [ ] Host: free space ≥15% sustained  
- [ ] Host: Task Scheduler registered (`npm run ops:register-backup-task`)
