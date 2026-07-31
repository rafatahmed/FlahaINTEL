<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4R-B Research Collections
Introduction:
Named research dossiers for scientific writing / internal reports with APA 7th
bibliography export from member literature sources (Stage D L5).

Created by: Rafat Al Khashan
Created date: 2026-08-01
Last modified: 2026-08-01
-->

# Gate 4R-B — Research collections (L5)

## Status

**IMPLEMENTED (4R-B.1 MVP)** (2026-08-01)

Parent scope: `gate-4r-research-desk-scope.md`  
Depends on: **4R-L** literature sources (APA-grade)

---

## Outcome

PA can create a **named collection** (e.g. “Qatar tomato × soil moisture 2026”), add **literature** (and optionally pack items / topics), and **export an APA 7th reference list** (alphabetical by author). Collections do **not** write sister products.

## Also in this ship (thin 4R-E)

- `KnowledgePackItem.literatureSourceId` — claim item may cite a literature source  
- `POST /api/research/literature/:id/attach-claim` — draft REFERENCE note on a pack linked to that source  

## Acceptance

- [x] Create / list / get collection  
- [x] Add / remove literature members  
- [x] APA bibliography export (desk default ASA/CSSA/SSSA-compatible)  
- [x] Research UI Collections panel  
- [x] No product engine writes  

## Operator

```powershell
# UI: Knowledge → Research → Collections
# Or API POST /api/research/collections
# GET /api/research/collections/:id/bibliography
```
