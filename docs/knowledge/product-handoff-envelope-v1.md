<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Product Handoff Envelope v1
Introduction:
Schema and rules for flaha-intel-product-handoff-v1 (Gate 4I-B) under 4B-A feed policies.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Product handoff envelope `flaha-intel-product-handoff-v1`

## Purpose

Export **APPROVED** FlahaINTEL knowledge packs as a **read-only** JSON envelope for human product work in **exactly one** sister product:

| Target | Pack themes (default policy) |
|--------|------------------------------|
| **FlahaCALC** | `IRRIGATION` |
| **FlahaFAST** | `NUTRITION` |
| **FlahaSOIL** | `SOIL` (+ optional comparison notes) |

**Never** merge CALC and FAST into one primary target.  
**Never** auto-write product engines (`autoApplyBlocked: true` always).

## Shape (normative)

```json
{
  "envelopeVersion": "flaha-intel-product-handoff-v1",
  "generatedAt": "ISO-8601",
  "tenantCode": "flaha-local",
  "targets": ["FlahaCALC"],
  "autoApplyBlocked": true,
  "governance": {
    "humanOnly": true,
    "doesNotWriteProductEngines": true,
    "productChangeProcess": "separate-ticket-outside-flahaintel",
    "feedPolicyEnforced": true
  },
  "sourcePacks": [{ "code": "...", "theme": "IRRIGATION", "reviewState": "APPROVED", "version": 1 }],
  "equations": [],
  "parameters": [],
  "notes": [],
  "comparisonNotes": [],
  "exportMeta": { "exportedByUserId": "...", "packCount": 1, "itemCount": 3 }
}
```

## API

| Method | Path | Role |
|--------|------|------|
| POST | `/api/product-handoff/export` | submit |
| GET | `/api/product-handoff/exports` | inspect |
| GET | `/api/product-handoff/exports/:id` | inspect |
| POST | `/api/knowledge-packs/:id/handoff` | submit |
| GET | `/api/product-feed-policies` | inspect |
| PUT | `/api/product-feed-policies/:target` | governance_admin |
| GET | `/api/pa-dashboard` | inspect (4B-B) |

## CLI

```powershell
npm run knowledge:export-handoff -- --target=FlahaCALC
npm run knowledge:export-handoff -- --target=FlahaFAST --out=./handoff-fast.json
```

## Product change process (outside INTEL)

1. Export envelope from APPROVED pack(s).  
2. PA / product owner reviews envelope.  
3. Open product ticket in FlahaCALC / FlahaFAST / FlahaSOIL process.  
4. Optional: cite FKP methodology docs.  
5. **Product repo** owns any code/seed change — INTEL does not.

## 4B-A feed policies

Admin-governed per tenant. Defaults seed on first list:

- Cross-product themes blocked (e.g. NUTRITION cannot be allowed on FlahaCALC policy).  
- `requireApprovedPacks: true` by default.
