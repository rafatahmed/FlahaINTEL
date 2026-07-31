<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4S-D FlahaSOIL Comparison Workflow
Introduction:
Human-only deviation / comparison cases between literature thresholds and FlahaSOIL
report or product observations — never auto-change FlahaSOIL.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Gate 4S-D — FlahaSOIL comparison workflow

## Status

**APPROVED for build** · **IMPLEMENTED** (foundation)

## One sentence

PA operators open a **comparison case** linking a literature threshold (4S-C bank) to a **FlahaSOIL observation** (report value / note), record deviation + recommended human action, and move it through **human review** — optionally to **product ticket open** — **without** writing FlahaSOIL code.

## Maps to final product

- Outcomes **O2, O3**  
- Brain + science muscles  
- Explicit non-auto-update of FlahaSOIL  

## Depends on

- 4S-B extract template + FlahaSOIL keys / test levels  
- 4S-C threshold bank  
- Recon: `docs/knowledge/flahasoil-recon-webapp-and-report.md`  

## Workflow states (human only)

```text
DRAFT
  → READY_FOR_REVIEW
      → APPROVED | REJECTED
  APPROVED → PRODUCT_TICKET_OPEN | CLOSED
  PRODUCT_TICKET_OPEN → CLOSED
  REJECTED → DRAFT
```

No DRAFT → APPROVED jump. `autoApplyBlocked` and `doesNotAutoUpdateFlahaSOIL` always true.

## Case fields (core)

| Field | Role |
|-------|------|
| `parameter` | FlahaSOIL key (`ecDsM`, `pH`, `sar`, …) |
| `soilTestLevels` / `appliesFromLevel` | PRELIMINARY / MODERATE / ADVANCED scope |
| Literature | value / range / operator / source (bank item id) |
| FlahaSOIL side | observation text, optional numeric, report number (e.g. FLH-2026-001), test level, sample ref |
| `deviationSummary` | Plain language gap |
| `recommendedHumanAction` | review-in-PA \| schedule-product-ticket \| no-change \| need-more-evidence |
| `productTicketRef` | External ticket id when status is PRODUCT_TICKET_OPEN |

## Scope (out)

- Calling FlahaSOIL live API to mutate product  
- Auto-closing tickets from code  
- Full research desk (4R)  

## Acceptance

- [x] Schema + migration `FlahaSoilComparisonCase`  
- [x] Create from threshold bank entry  
- [x] List/filter + human status transitions  
- [x] Seed sample cases (from bank + sample report FLH-2026-001)  
- [x] Knowledge UI comparison workflow panel  
- [x] Tests for transitions + safety flags  

## Operator

```powershell
cd apps/api
npx prisma migrate deploy
npm run knowledge:seed-threshold-bank
npm run knowledge:seed-comparison-cases
```
