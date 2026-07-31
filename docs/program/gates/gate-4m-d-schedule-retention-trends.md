<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4M-D Schedule, Retention, Trends
Introduction:
Schedule harvest, retain ≥365 days of price history per market, expose trends.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Gate 4M-D — Schedule + 1-year retention + trends

## Status

**IMPLEMENTED** (foundation on this host) · continue building series daily

## Purpose

Keep market eyes current and historical enough for PA advice:

1. **Schedule** — daily harvest task; channel cadence still applies (JO/MoCI 1d, Mahaseel 3d)  
2. **Retention** — target **≥ 365 calendar days** of `observedOn` span **per channel**  
3. **Trends** — series charts in Markets UI (grade/method-aware for Mahaseel)

## Maps to final product

- Outcomes **O1**  
- Lock Stage B · metaphor Eyes + Muscles  

## Acceptance

- [x] Task Scheduler script: `ops:register-market-harvest-task` (daily 05:30)  
- [x] Retention report: `GET /api/markets/retention` + `npm run markets:retention`  
- [x] Trends: `GET /api/markets/prices/trend` + Markets page series chart  
- [ ] Host holds ≥365d of history (builds over time with scheduled harvest)  
- [ ] Product filter windows remain ≤ 3 days for operational pulls  

## Retention statuses

| Status | Meaning |
|--------|---------|
| `EMPTY` | No rows |
| `EARLY` | &lt; 30d span |
| `BUILDING` | 30–364d span |
| `MEETS_TARGET` | ≥ targetDays (default 365) |

Report **never deletes** rows. Purge policy is a separate approved ops gate.

## Operator

```powershell
npm run ops:register-market-harvest-task
npm run markets:retention --workspace=@flaha-intel/api
# or from apps/api:
npm run markets:retention
```

## Depends on

4M-0 model · 4M-A/B harvest muscle · Task Scheduler registration on host
