<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Post-3N Sprint 1 Status
Introduction:
Tracks systemic execution of the first post-Phase-3N sprint (backbone ops + product eyes/muscles).

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-08-01
-->

# Post–3N Sprint 1 status

**Program position:** Systemic package after Phase 3N (platform complete; product lock active).  
**Sprint goal:** Backbone stays healthy; markets + soil packs advance without drift.  
**System posture (OWNER LOCKED 2026-07-31):** `INTEL-primary · FKP-frozen-thin · MCP-on-named-consumer`  
→ `docs/program/flaha-system-vision-and-operate-lock.md`

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
| 4M UI | Markets page + simple trends | **DONE** | Grouped workbench + multi-series trend-bundle (hardened) |
| 4M-F | Historical Mahaseel PDF + JO Excel import | **DONE** | Dedupe layers; EN commodity map for AR bulletins |
| Spine | Evidence Intake (Submit land→classify→promote) | **DONE** | Migration + API + UI; ArtifactStore .metadata seal fix |
| 4I | Calc/Fast recon + sample packs | **DONE** (foundation) | Separate CALC vs FAST; DRAFT packs only |
| 4S-A | Soil/irrigation pack schema | **DONE** | API + schema doc |
| 4S samples | Soil/irrigation sample packs | **DONE** | `knowledge:seed-samples` (DRAFT) |
| Host disk | Free space ≥15% | **OPEN** | ~6 GB free (~2%) → still DEGRADED; improve when possible |
| Host tasks | Register backup + market harvest | **DONE** | `FlahaINTEL-NightlyBackup` 02:30 · `FlahaINTEL-MarketHarvest` 05:30 (Limited) |
| 4M-D | Schedule + retention report + trends | **DONE** (foundation) | Retention API/CLI; series builds over time to 365d |

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

| 4I-B | Product handoff envelope (CALC/FAST/SOIL) | **DONE** | `flaha-intel-product-handoff-v1` + API/CLI/UI + audit |
| 4B-A | Product feed policies | **DONE** | Per-target themes; cross-product guards |
| 4B-B | PA dashboard scorecard | **DONE** | `/api/pa-dashboard` + Dashboard card |

| 4R-A | Research topic index (desk) | **DONE (4R-A.1)** | Materialized topics + `/api/research/*` + Knowledge Research tab |
| 4R scope | Stage D multi-domain desk | **ACCEPTED** | `gate-4r-research-desk-scope.md` · APA/ASA–CSSA–SSSA |
| 4R-L | Literature source records (L2) | **DONE (4R-L.1)** | `LiteratureSource` + APA + `/api/research/literature/*` + UI + index hook |
| Markets analytics | Multi-year / monthly / histogram | **DONE** | `market-price-analytics.md` |

## Next (systemic order)

1. ~~**Owner accept 4R-A frame** → implement 4R-A.1~~ **DONE**  
2. ~~**Owner accept Stage D full scope**~~ **DONE**  
3. ~~**4R-L.1 literature sources**~~ **DONE** — operate: `knowledge:register-literature` + approve + rebuild  
4. **Operate:** real library JSON/PDF metadata in; harvest + historical fill; approve packs; handoff  
5. **Optional 4R-A.2:** soil cases in index + pack topic chips  
6. **Later 4R-X:** deep extract cards from literature (claims)  
7. **Later 4R-B:** collections + APA bibliography export  
8. **Host hygiene:** free C: toward ≥5–15% when practical  
9. **FKP:** frozen-thin only · **Do not** open YouTube/X yet

## Exit criteria for Sprint 1

- [x] Ops runbooks and scripts landed  
- [x] Deps pinned  
- [x] Policy bootstrap available  
- [x] Market/soil gate charters written  
- [x] Owner approved 4M-0 / 4M-A / 4S-A  
- [x] 4M-0 / 4M-A / 4S-A + harvest + review + UI + samples implemented  
- [x] Host: Task Scheduler registered (backup + market harvest)  
- [x] 4M-D foundation (schedule + retention report + trends)  
- [ ] Host: free space ≥15% sustained  
- [ ] Channels reach MEETS_TARGET (≥365d span)
