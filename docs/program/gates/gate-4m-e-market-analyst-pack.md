<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4M-E Market Analyst Pack
Introduction:
Builds governed MARKET_CONTEXT knowledge packs from live market price observations
for farm advice support (human review still required).

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Gate 4M-E — Market analyst pack (context for farm advice)

## Status

**APPROVED for build** · **IMPLEMENTED** (foundation)

## One sentence

Turn **harvested market rows** into **MARKET_CONTEXT knowledge packs** (per channel): freshness, top commodities, cadence, retention — so PA can use **governed market context** in advice discussions without inventing prices.

## Maps to final product

- Outcome **O1** (markets) · advice support  
- Eyes + Muscles + Brain (human pack review)  
- Does **not** auto-trade or auto-advise farmers  

## Depends on

- 4M-0…D (model, harvest, schedule, retention, trends)  
- 4S-A pack shell + human review (same KnowledgePack pipeline)  

## What a pack contains

Theme: `MARKET_CONTEXT`  
Code pattern: `market-analyst-{channelCode}-v1`

| Item | Content |
|------|---------|
| Freshness | last observed date, row count, review mix |
| Top commodities | latest mode/unit prices (top N by volume or name) |
| Cadence | harvestIntervalDays, filterMaxSpanDays |
| Retention | spanDays vs 365d target (from retention report) |
| Evidence | channel officialUrl |

## Human governance

- Packs are **DRAFT** after rebuild  
- Content rebuild from APPROVED pack → back to **DRAFT** (4S-B upsert rule)  
- PA must **READY_FOR_REVIEW → APPROVED** before treating as company market context  
- Never writes FlahaSOIL / CALC / FAST  

## Acceptance

- [x] Generator service from DB observations  
- [x] CLI + API rebuild  
- [x] Knowledge UI shows MARKET_CONTEXT packs  
- [x] Markets UI “Analyst packs” section  
- [x] Tests for pack shape  

## Operator

```powershell
cd apps/api
npm run markets:build-analyst-packs
# optional: -- --channel=qa-moci-daily-vegetables
```
