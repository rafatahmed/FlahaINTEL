<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Knowledge Pack Schema
Introduction:
Universal knowledge packs with place as tags; theme maps to one sister product
(FlahaSOIL | FlahaCALC | FlahaFAST) — never merge irrigation with nutrients.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-31
-->

# Knowledge pack schema

## Principle

Science of **soil, irrigation, nutrition, water** is universal.  
**Region/country tags** record where a finding was observed or applied.

**Sister products are three separate engines (LOCKED):**

| Product | Pack theme | Domain |
|---------|------------|--------|
| **FlahaSOIL** | `SOIL` | Soil physics, chemistry, lab reports |
| **FlahaCALC** | `IRRIGATION` | Irrigation & weather (ETo, Kc, water need) |
| **FlahaFAST** | `NUTRITION` | Nutrient management (formulations, solution chemistry) |

**FlahaCALC ≠ FlahaFAST.** Do not treat them as one product, one handoff, or one Knowledge lane.

Full matrix: `docs/knowledge/knowledge-product-matrix.md`  
UI lanes: `apps/web/src/knowledge/productLanes.ts`

## Pack fields

| Field | Meaning |
|-------|---------|
| `code` | Stable slug per tenant |
| `theme` | `SOIL` \| `IRRIGATION` \| `NUTRITION` \| `DIGITAL_PLATFORM` \| `MARKET_CONTEXT` \| `OTHER` |
| `title` / `summary` | Human-readable |
| `cropTags` | e.g. tomato, cucumber |
| `regionTags` | ISO country or named region (QA, JO, CA, …) |
| `climateTags` | e.g. arid, greenhouse |
| `language` | Pack language |
| `reviewState` | DRAFT → READY_FOR_REVIEW → APPROVED / REJECTED / ARCHIVED |
| `items[]` | Ordered extracts |

## Theme → product (required mapping)

| theme | Primary product | Typical extract focus |
|-------|-----------------|----------------------|
| `SOIL` | FlahaSOIL | pH, EC, CEC, SAR, methods, comparison notes |
| `IRRIGATION` | FlahaCALC | ETo, Kc, ETc, efficiency, weather for irrigation |
| `NUTRITION` | FlahaFAST | Solution EC/pH, element ppm, salts, water ions |
| `MARKET_CONTEXT` | Markets context | Analyst packs from prices (not a calc engine) |

## Item extract kinds (closed set)

| extractKind | Use |
|-------------|-----|
| `THRESHOLD` | Numeric threshold |
| `METHOD` | Lab or field method |
| `EQUATION` | Formula identity (target **one** product via `productHandoff`) |
| `REFERENCE` | Citation |
| `NOTE` | Free text |
| `COMPARISON_NOTE` | Literature vs **FlahaSOIL** only (4S) |

## Structured flags

```json
{
  "parameter": "kcMid",
  "productHandoff": ["FlahaCALC"],
  "doesNotAutoUpdateFlahaSOIL": true,
  "doesNotAutoUpdateFlahaCALC": true,
  "doesNotAutoUpdateFlahaFAST": true,
  "autoApplyBlocked": true
}
```

- `productHandoff`: prefer **one** primary product.  
- Never invent a combined target like `"FlahaCALC+FAST"`.

## Product handoff rule

Approved packs **inform** the matching product only; they **never** silently change algorithms.  
Handoff envelopes (4I-B) must set a single primary `targets` product (or separate sections per product).

## Samples

| File | Products |
|------|----------|
| `docs/knowledge/samples/soil-irrigation-pack-samples.json` | SOIL + some IRRIGATION |
| `docs/knowledge/samples/irrigation-calc-fast-pack-samples.json` | CALC (`IRRIGATION`) and FAST (`NUTRITION`) as **separate** packs |

```bash
cd apps/api
npm run knowledge:seed-samples
```

## Human review

```text
DRAFT → READY_FOR_REVIEW → APPROVED | REJECTED
```

No auto-approve. Re-seed of APPROVED content returns to DRAFT.

## API

- `GET /api/knowledge-packs` — filter `theme`, `extractKind`, `reviewState`
- `GET /api/knowledge-packs/:id`
- `POST /api/knowledge-packs/:id/review`
- Threshold bank + FlahaSOIL comparison routes remain **SOIL lane tools**
