<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Post-3N Sprint 1 Status
Introduction:
Tracks systemic execution of the first post-Phase-3N sprint (backbone ops + product eyes/muscles).

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Post–3N Sprint 1 status

**Program position:** Systemic package after Phase 3N (platform complete; product lock active).  
**Sprint goal:** Backbone stays healthy; markets + soil packs advance without drift.

## Task board

| ID | Task | Status | Notes |
|----|------|--------|-------|
| E1-T1 | Disk / volume layout guidance | **DONE** | `ops/runbooks/disk-and-volume-layout.md` |
| E1-T2 | Scheduled backup registration | **DONE** (tooling) | Operator must run elevated once per host |
| E1-T3 | Ops cadence runbook | **DONE** | `ops/runbooks/ops-cadence.md` |
| E1-T4 | Free-space check + alert | **DONE** | Host still ~1–2% free → readiness DEGRADED |
| E2-T1 | Pin npm deps (no `latest`) | **DONE** | API pinned |
| E3-T1 | Source policies for ACCEPTED RSS | **DONE** (tooling) | `bootstrap:source-policies` |
| 4M-0 | Global market model | **DONE** | Schema + API + review policy |
| 4M-A | Qatar channels (MoCI + Mahaseel) | **DONE** (source + harvest) | Daily MoCI lists + 3-day Mahaseel PDF |
| 4M-B | Jordan Amman central market | **DONE** (source + harvest) | Live ASP.NET + AR↔EN map |
| 4M review | Auto-approve vs human review | **DONE** | `HUMAN_REQUIRED` / `AUTO_APPROVE_OFFICIAL` + batch review |
| 4M UI | Markets page + simple trends | **DONE** | Grade/method for Mahaseel; high/mode/low for Amman |
| 4S-A | Soil/irrigation pack schema | **DONE** | API + schema doc |
| 4S samples | Soil/irrigation sample packs | **DONE** | `knowledge:seed-samples` (DRAFT) |
| Host disk | Free space ≥15% | **OPEN** | Blocks full System READY |
| Host tasks | Register backup + market harvest | **OPEN** | Scripts ready; elevated once |

## Verified runtime notes (this host)

- Local tenant: `flaha-local` · admin `admin@flaha.local` · GOVERNANCE_ADMIN  
- Markets harvest: MoCI, Mahaseel PDF, Amman live POST  
- Readiness: DEGRADED primarily from **DiskCapacity** (~1% free on C:)  
- Artifact previews: many links are orphan test blobs (policy: no download; escaped text only)  
- Workers not required for market harvest; READY acquisition jobs wait without worker loops  

## Operator one-time on this host

```powershell
npm run ops:check-free-space
npm run bootstrap:local
npm run markets:seed-channels
npm run markets:backfill-jo-names   # once after EN map
npm run knowledge:seed-samples
# Elevated when ready:
# npm run ops:register-backup-task
# npm run ops:register-market-harvest-task
```

## Next (systemic order)

1. **Host hygiene:** free C: until free ≥ ~5–15%; clear DEGRADED disk  
2. **Ops muscle:** register backup + market harvest Task Scheduler tasks (elevated)  
3. **4M-D:** multi-day series retention checks + trend polish (already partial)  
4. **4S-B:** expand soil pack extracts toward FlahaSOIL comparison notes (human review stays)  
5. **Do not** open YouTube/X until markets + soil packs are used end-to-end  

## Exit criteria for Sprint 1

- [x] Ops runbooks and scripts landed  
- [x] Deps pinned  
- [x] Policy bootstrap available  
- [x] Market/soil gate charters written  
- [x] Owner approved 4M-0 / 4M-A / 4S-A  
- [x] 4M-0 / 4M-A / 4S-A + harvest + review + UI + samples implemented  
- [ ] Host: free space ≥15% sustained  
- [ ] Host: Task Scheduler registered (backup + market harvest)
