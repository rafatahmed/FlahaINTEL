<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Knowledge Pack Schema (Gate 4S-A)
Introduction:
Defines universal soil/irrigation knowledge packs with place as tags only.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Knowledge pack schema (4S-A)

## Principle

Science of **soil, irrigation, nutrition, water** is universal.  
**Region/country tags** record where a finding was observed or applied — they do not create a separate product per country.

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

## Item extract kinds (recommended)

| extractKind | Use |
|-------------|-----|
| `THRESHOLD` | Numeric threshold (EC, pH, NPK, moisture…) |
| `METHOD` | Lab or field method |
| `EQUATION` | Formula note (link to FlahaCALC/FAST later) |
| `REFERENCE` | Citation / source pointer |
| `NOTE` | Free text insight |

## Structured JSON (THRESHOLD example)

```json
{
  "parameter": "EC",
  "unit": "dS/m",
  "operator": "<=",
  "value": 2.5,
  "crop": "tomato",
  "context": "soilless greenhouse illustrative",
  "confidence": "literature-note",
  "doesNotAutoUpdateFlahaSOIL": true
}
```

## Product handoff rule

Approved packs **inform** FlahaSOIL / CALC / FAST work; they **never** silently change product algorithms without a separate product change process.

## API

- `GET /api/knowledge-packs`
- `GET /api/knowledge-packs/:id`
- `POST /api/knowledge-packs`
