<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4I-A Irrigation Knowledge Pack (FlahaCALC-aligned)
Introduction:
Charter for irrigation and weather knowledge packs keyed to FlahaCALC only.
Nutrient management is FlahaFAST (separate product — not this gate’s primary target).

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Gate 4I-A — Irrigation knowledge pack (FlahaCALC)

## Status

**READY FOR APPROVAL** · Recon complete (`docs/knowledge/flahacalc-flahafast-recon.md`)  
Foundation (catalog + samples) may land with recon; full PA approval still required before treating packs as company context.

## Product separation (LOCKED)

| Product | Domain | Pack theme |
|---------|--------|------------|
| **FlahaCALC** | Irrigation, weather, ETo, Kc, water balance | `IRRIGATION` |
| **FlahaFAST** | Nutrient management, formulations, hydroponics | `NUTRITION` (separate packs / gate path) |
| **FlahaSOIL** | Soil physics & chemistry | `SOIL` (4S) |

Do **not** treat CALC and FAST as one handoff or one pack family.

## Purpose

Give FlahaINTEL a **governed** way to store **irrigation and weather** science extracts that use the **same parameter identities** as FlahaCALC — so PA can improve water-need and water-saving advice **anywhere** farmers are served, without auto-updating product code. Nutrient extracts belong under FlahaFAST, not this gate’s primary scope.

## Maps to final product

- Outcomes **O2, O3** (irrigation / water-saving primary; nutrition is separate FAST path)  
- Metaphor: Eyes + Muscles  
- Lock Stage C: **4I-A** (CALC) · FAST nutrition packs are parallel, not the same gate  
- Sister product: **FlahaCALC** (FlahaSOIL = 4S; FlahaFAST = nutrition packs)

## Scope (in)

- Parameter catalog module + docs keys for Calc (ETo, Kc, net/gross I, soil water table, landscape KL) and Fast (water EC/pH, element ppm targets, crop buckets)
- Sample `IRRIGATION` and `NUTRITION` knowledge packs (DRAFT), 4S-B extract kinds
- Explicit `doesNotAutoUpdateFlahaCALC` / `doesNotAutoUpdateFlahaFAST` / `doesNotAutoUpdateFlahaSOIL` on structured extracts
- Seed path via existing `knowledge:seed-samples` (or sibling CLI)

## Scope (out)

- Export envelope API (→ **4I-B**)
- Writing into Calc/Fast databases or code
- Changing Calc cropDatabase or Fast salt matrix from INTEL
- Unrestricted literature crawl; AI summarization
- OCR of scanned irrigation manuals (unless separate gate)

## Depends on

- 4S-A pack shell + 4S-B extract template / human review  
- Recon of Calc + Fast (this sprint)

## Acceptance

- [x] Recon doc merged and accurate to local product repos  
- [x] Parameter catalog in API code (`flahaCalcFastParameters.ts`)  
- [x] Sample packs seedable as DRAFT (`irrigation-calc-fast-pack-samples.json`)  
- [x] Extract template accepts CALC/FAST keys (4S-B + 4I)  
- [x] Human review path unchanged (no auto-approve)  
- [x] Documented non-auto-update of CALC / FAST / SOIL  

## Status note

**FOUNDATION IMPLEMENTED** (recon + catalog + samples + validation). Owner may still formal-approve before treating packs as company context.

## Operator (when implemented)

```powershell
cd apps/api
npm run knowledge:seed-samples
# Review packs in Web → Knowledge packs (theme IRRIGATION | NUTRITION)
```
