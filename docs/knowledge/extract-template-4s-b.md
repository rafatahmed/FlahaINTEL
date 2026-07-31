<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Knowledge Pack Extract Template (Gate 4S-B)
Introduction:
Field dictionary for structured soil/irrigation extracts and FlahaSOIL comparison notes.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Extract template (4S-B)

## Closed extract kinds

| extractKind | Purpose |
|-------------|---------|
| `THRESHOLD` | Numeric or range limit |
| `METHOD` | Lab/field method identity |
| `EQUATION` | Formula identity (note only) |
| `REFERENCE` | Citation / evidence pointer |
| `NOTE` | Free insight in structured envelope |
| `COMPARISON_NOTE` | Human literature vs FlahaSOIL deviation note |

## Common envelope

Every `structured` object for product-touching science must include:

```json
{
  "doesNotAutoUpdateFlahaSOIL": true
}
```

Optional: `crop`, `regionTags`, `climateTags`, `confidence`, `context`.

## THRESHOLD

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

Range form: `operator: "range"` with `valueMin` + `valueMax`.

## METHOD

```json
{
  "method": "saturated_paste_EC",
  "parameter": "EC",
  "unit": "dS/m",
  "doesNotAutoUpdateFlahaSOIL": true
}
```

## COMPARISON_NOTE

```json
{
  "product": "FlahaSOIL",
  "parameter": "EC",
  "unit": "dS/m",
  "literatureValue": 2.5,
  "literatureOperator": "<=",
  "flahaSoilObservation": "optional human note of current product behaviour",
  "deviationSummary": "Literature upper stress band may be lower than product default band for soilless tomato.",
  "recommendedHumanAction": "review-in-PA",
  "autoApplyBlocked": true,
  "doesNotAutoUpdateFlahaSOIL": true,
  "crop": "tomato",
  "confidence": "expert-draft"
}
```

`recommendedHumanAction` one of: `review-in-PA`, `schedule-product-ticket`, `no-change`, `need-more-evidence`.

## Human review

Pack-level only: `DRAFT` → `READY_FOR_REVIEW` → `APPROVED` | `REJECTED` | `ARCHIVED`.  
No auto-approve. APPROVED does not write FlahaSOIL.
