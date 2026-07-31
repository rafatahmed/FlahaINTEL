<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4B Product Feed Policies + PA Dashboard
Introduction:
Admin policies for what may feed SOIL/CALC/FAST (4B-A) and PA operational scorecard (4B-B).

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Gate 4B — Product feed policies + PA dashboard

## Status

**IMPLEMENTED** (2026-07-31) foundation

## 4B-A — Feed policies

| Target | Default allowed themes | Notes |
|--------|------------------------|-------|
| FlahaCALC | IRRIGATION | Blocks NUTRITION on policy update |
| FlahaFAST | NUTRITION | Blocks IRRIGATION on policy update |
| FlahaSOIL | SOIL | Optional comparison notes |

Model: `ProductFeedPolicy` · API: `GET/PUT /api/product-feed-policies`

## 4B-B — PA dashboard

`GET /api/pa-dashboard` returns pack health, market freshness, soil queues, handoff readiness by target.  
Web Dashboard shows scorecard card.

## Governance

- Policies require `governance_admin` to update.  
- Handoff export requires `submit` and enforces policy + APPROVED packs.  
- Auto-apply always blocked.
