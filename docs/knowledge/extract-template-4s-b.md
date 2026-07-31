<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Knowledge Pack Extract Template (Gate 4S-B)
Introduction:
Field dictionary aligned to FlahaSOIL wire keys and three SoilTestLevel tiers.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Extract template (4S-B)

**FlahaSOIL recon:** `docs/knowledge/flahasoil-recon-webapp-and-report.md`  
**Parameter catalog (code):** `apps/api/src/knowledgePack/flahaSoilParameters.ts`

## Closed extract kinds

| extractKind | Purpose |
|-------------|---------|
| `THRESHOLD` | Numeric or range limit |
| `METHOD` | Lab/field method identity |
| `EQUATION` | Formula identity (note only) |
| `REFERENCE` | Citation / evidence pointer |
| `NOTE` | Free insight in structured envelope |
| `COMPARISON_NOTE` | Human literature vs FlahaSOIL deviation note |

## FlahaSOIL parameter keys (use these)

Aliases (e.g. `EC`, `ECe`) are accepted and **normalized** on write.

| Key | Unit | appliesFromLevel |
|-----|------|------------------|
| `sandPercent` / `siltPercent` / `clayPercent` | % | PRELIMINARY |
| `organicMatterPercent` | % | PRELIMINARY |
| `pH` | pH | PRELIMINARY |
| `ecDsM` | dS/m | PRELIMINARY |
| `tdsMgL` | mg/L | PRELIMINARY |
| `textureClass`, `fieldCapacity`, `wiltingPoint`, `plantAvailableWater`, … | model | PRELIMINARY |
| `ca`, `mg`, `k`, `na`, `cl`, `n`, `p`, `cec` | … | MODERATE |
| `sar`, `esp`, micros, carbonates, `heavyMetalsJson` | … | ADVANCED |
| `irrigationWaterEcDsM` | dS/m | irrigation water (not soil ECe) |

## Required level fields (THRESHOLD + COMPARISON_NOTE)

| Field | Meaning |
|-------|---------|
| `soilTestLevels` | Non-empty array of `PRELIMINARY` \| `MODERATE` \| `ADVANCED` where the note applies |
| `appliesFromLevel` | Lowest FlahaSOIL level that may include this parameter |

If omitted, defaults are filled from the parameter matrix (e.g. `ecDsM` → PRELIMINARY+ all three levels; `sar` → ADVANCED only).

**Reports are based on three test levels** — do not compare ADVANCED-only parameters against PRELIMINARY-scoped advice.

## Common envelope

```json
{
  "doesNotAutoUpdateFlahaSOIL": true
}
```

## THRESHOLD

```json
{
  "parameter": "ecDsM",
  "unit": "dS/m",
  "operator": "<=",
  "value": 2.5,
  "soilTestLevels": ["PRELIMINARY", "MODERATE", "ADVANCED"],
  "appliesFromLevel": "PRELIMINARY",
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
  "parameter": "ecDsM",
  "unit": "dS/m",
  "soilTestLevels": ["PRELIMINARY", "MODERATE", "ADVANCED"],
  "appliesFromLevel": "PRELIMINARY",
  "doesNotAutoUpdateFlahaSOIL": true
}
```

## COMPARISON_NOTE

```json
{
  "product": "FlahaSOIL",
  "parameter": "ecDsM",
  "unit": "dS/m",
  "soilTestLevels": ["PRELIMINARY", "MODERATE", "ADVANCED"],
  "appliesFromLevel": "PRELIMINARY",
  "literatureValue": 2.5,
  "literatureOperator": "<=",
  "flahaSoilObservation": "optional human note from report snapshot (e.g. FLH-2026-001 ECe 1.00)",
  "deviationSummary": "Literature upper stress band vs product / report interpretation.",
  "recommendedHumanAction": "review-in-PA",
  "autoApplyBlocked": true,
  "doesNotAutoUpdateFlahaSOIL": true,
  "crop": "tomato",
  "confidence": "expert-draft"
}
```

`recommendedHumanAction`: `review-in-PA` | `schedule-product-ticket` | `no-change` | `need-more-evidence`.

## Human review

Pack-level only: `DRAFT` → `READY_FOR_REVIEW` → `APPROVED` | `REJECTED` | `ARCHIVED`.  
No auto-approve. APPROVED does not write FlahaSOIL.
