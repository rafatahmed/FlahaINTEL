<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Knowledge Pack Product Matrix
Introduction:
Systematic map of pack themes to FlahaSOIL, FlahaCALC, and FlahaFAST — three
separate sister products (irrigation/weather vs nutrients vs soil).

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Knowledge pack product matrix (LOCKED)

## Principle

| Rule | Meaning |
|------|---------|
| **One primary product per pack** | Theme drives the product lane |
| **Three engines** | FlahaSOIL ≠ FlahaCALC ≠ FlahaFAST |
| **CALC ≠ FAST** | Irrigation/weather vs nutrient management — never one handoff |
| **Inform only** | Packs never auto-update product code |

## Theme → product

| Pack `theme` | Primary product | Domain |
|--------------|-----------------|--------|
| `SOIL` | **FlahaSOIL** | Soil physics, chemistry, lab reports, comparison cases |
| `IRRIGATION` | **FlahaCALC** | Irrigation, weather, ETo, Kc, water balance, water-saving |
| `NUTRITION` | **FlahaFAST** | Nutrient management, formulations, solution chemistry |
| `MARKET_CONTEXT` | Markets (advice context) | Price analyst packs — not a calc engine |
| `DIGITAL_PLATFORM` / `OTHER` | Unassigned / meta | Use sparingly; set `productHandoff` explicitly |

## In scope / out of scope

### FlahaSOIL (`SOIL`)

**In:** pH, EC, texture, CEC, SAR, methods, soil test levels, report bridge, comparison cases.  
**Out:** ETo/Kc scheduling (CALC); recipe ppm (FAST); market prices.

### FlahaCALC (`IRRIGATION`)

**In:** ETo methods, Kc tables, ETc, net/gross irrigation, efficiency, runtime notes, landscape KL, irrigation weather.  
**Out:** Nutrient targets and salts (FAST); soil lab exchange panels (SOIL); market prices.

### FlahaFAST (`NUTRITION`)

**In:** Solution EC/pH, element ppm, water ions, salts, stock solutions, crop nutrient stages.  
**Out:** Irrigation depth/ETo (CALC); soil report SAR as soil test (SOIL); market prices.

## Extract flags (structured)

Every product-touching extract should assert the relevant flags:

```json
{
  "doesNotAutoUpdateFlahaSOIL": true,
  "doesNotAutoUpdateFlahaCALC": true,
  "doesNotAutoUpdateFlahaFAST": true,
  "productHandoff": ["FlahaCALC"]
}
```

`productHandoff` lists the **primary** product for that extract (usually one).  
Cross-product cautions use a note field — do not invent a combined “CALC-FAST” target.

## UI

Knowledge hub lanes: **Overview · FlahaSOIL · FlahaCALC · FlahaFAST · Markets**  
Source of truth for labels: `apps/web/src/knowledge/productLanes.ts`

## Samples

| Product | Example pack codes |
|---------|-------------------|
| SOIL | `soil-thresholds-baseline-v1`, `flahasoil-comparison-notes-v1` |
| CALC | `irrigation-calc-kc-etc-backbone-v1`, `irrigation-water-saving-notes-v1` |
| FAST | `nutrition-fast-water-targets-v1` |
| Markets | `market-analyst-*-v1` |

Seed: `npm run knowledge:seed-samples`
