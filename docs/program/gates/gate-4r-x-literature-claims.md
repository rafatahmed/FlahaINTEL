<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4R-X Literature Claims (Extract Depth)
Introduction:
Structured claim drafts from literature sources using 4S-B extract templates,
with evidence citation and no product auto-write.

Created by: Rafat Al Khashan
Created date: 2026-08-01
Last modified: 2026-08-01
-->

# Gate 4R-X — Literature claims (extract depth)

## Status

**IMPLEMENTED (4R-X.1 MVP)** (2026-08-01)

Depends on: 4R-L literature · 4S-B extract template · thin 4R-E attach-claim

---

## Outcome

From a **literature source**, PA can create a **validated pack extract** (REFERENCE / METHOD / NOTE / THRESHOLD / …) that:

- cites APA metadata + DOI  
- stores `literatureSourceId` on the pack item  
- passes **4S-B extract validation** for claim kinds  
- remains on a **DRAFT** pack until human pack APPROVED  
- **never** writes FlahaSOIL / FlahaCALC / FlahaFAST  

## Hard rules

1. Literature SOURCE_APPROVED ≠ claim APPROVED  
2. THRESHOLD/METHOD require known parameter keys when using product catalogs  
3. `doesNotAutoUpdateFlahaSOIL|CALC|FAST = true` always on literature-linked items  
4. DOI unique per tenant (library integrity)

## API

| Method | Path |
|--------|------|
| POST | `/api/research/literature/:id/attach-claim` body: `extractKind`, `method?`, `parameter?`, `structured?` |
| GET | `/api/research/literature/:id/claims` |

## Operator

```powershell
# Crossref bulk (polite delay)
npm run knowledge:crossref-bulk -- --file=dois.txt --domain=soil
# UI: Literature → Draft claim (REFERENCE default) or API with extractKind=METHOD
npm run knowledge:rebuild-research-index
```
