<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4S-B Structured Extract Template
Introduction:
Frames the structured extract template for soil/irrigation packs and the path
toward FlahaSOIL comparison notes under human review (no auto-update of product code).

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Gate 4S-B — Structured extract template (+ path to FlahaSOIL comparison notes)

## Status

**APPROVED** by product owner (option A, 2026-07-31) · **IMPLEMENTED** (template validation + human review + comparison samples)

## One sentence

**Lock a machine-readable extract template** (threshold, method, crop, region/climate tags, confidence) for soil/irrigation packs, and allow **human-authored comparison notes** that *inform* FlahaSOIL work — **never** silently change FlahaSOIL algorithms.

## Why this gate (after 4S-A)

| Already done (4S-A) | Still missing (4S-B) |
|---------------------|----------------------|
| Pack shell + items + region tags | Strict **shape** for each extract kind |
| Sample DRAFT packs | Validation so bad JSON cannot look like science |
| “Never auto-update SOIL” as principle | **Comparison-note** extract kind + review path |
| Manual comparison mentioned in docs | Operator can mark READY_FOR_REVIEW / APPROVE (human only) |

Without 4S-B, packs are free-text folders. With 4S-B, packs become a **governed template** Flaha can reuse worldwide.

## Maps to final product

- Outcomes **O2, O3**  
- Metaphor: Eyes + Muscles (science) + **Brain** (human review)  
- Lock Stage C · `flahaintel-final-product-lock.md`  
- Does **not** replace 4S-C (threshold bank artifact) or 4S-D (full comparison workflow productization)

## Human-governance rules (LOCKED for this gate)

1. **Default pack state:** `DRAFT`  
2. **Humans only** may move: `DRAFT → READY_FOR_REVIEW → APPROVED | REJECTED | ARCHIVED`  
3. **No auto-approve** of packs or comparison notes (unlike market channel policy)  
4. Every structured extract that touches product meaning carries  
   `doesNotAutoUpdateFlahaSOIL: true`  
5. **APPROVED** only means “governed knowledge ready for humans to use in product *discussions*” — **not** a write into FlahaSOIL code/config  

## Scope (in)

### A. Extract kinds (closed set for 4S-B)

| extractKind | Purpose |
|-------------|---------|
| `THRESHOLD` | Numeric or range limit (EC, pH, SAR, moisture, N/P/K…) |
| `METHOD` | Lab/field method identity (must pair with numbers later) |
| `EQUATION` | Formula identity for CALC/FAST handoff later (note only) |
| `REFERENCE` | Citation / evidence pointer |
| `NOTE` | Free insight (still structured envelope) |
| `COMPARISON_NOTE` | **Human** note: literature/pack value vs FlahaSOIL parameter — deviation, action, **no auto-patch** |

### B. Structured template fields (minimum)

**Common envelope (all kinds):**

| Field | Required | Meaning |
|-------|----------|---------|
| `doesNotAutoUpdateFlahaSOIL` | yes | Must be `true` |
| `crop` / `cropTags` | no* | Crop identity (*required on THRESHOLD when crop-specific) |
| `regionTags` | no | Place tags only (QA, JO, CA, arid…) — not product walls |
| `climateTags` | no | e.g. greenhouse, open-field, arid |
| `confidence` | no | e.g. `literature-note`, `lab-method`, `expert-draft` |
| `context` | no | Short applicability note |

**THRESHOLD:**

| Field | Required | Example |
|-------|----------|---------|
| `parameter` | yes | `EC`, `pH`, `SAR` |
| `unit` | yes | `dS/m`, `pH` |
| `operator` | yes | `<=`, `>=`, `range`, `~` |
| `value` **or** `valueMin`+`valueMax` | yes | `2.5` or `6.0`–`7.0` |

**METHOD:**

| Field | Required |
|-------|----------|
| `method` | yes (stable id, e.g. `saturated_paste_EC`) |
| `parameter` | recommended |

**COMPARISON_NOTE (path toward FlahaSOIL — still human):**

| Field | Required | Meaning |
|-------|----------|---------|
| `product` | yes | Must be `FlahaSOIL` for this gate (CALC/FAST later) |
| `parameter` | yes | Shared name with THRESHOLD when possible |
| `literatureValue` / `literatureRange` | yes | What the pack/literature says |
| `unit` | yes | Same unit family as literature |
| `flahaSoilObservation` | no | Optional human-entered product reading / current behaviour note |
| `deviationSummary` | yes | Plain language gap |
| `recommendedHumanAction` | yes | e.g. `review-in-PA`, `schedule-product-ticket`, `no-change` |
| `autoApplyBlocked` | yes | Must be `true` |
| `reviewedByHuman` | yes at APPROVED pack level | Pack-level review is the authority |

### C. Service / API (implementation after approval)

- Validate extract `structured` JSON on create/upsert (reject invalid THRESHOLD / COMPARISON_NOTE)  
- Human review transitions only (`governance_review` / admin)  
- List/filter packs by theme; optional filter items by `extractKind=COMPARISON_NOTE`  
- Expand sample seed packs with template-valid items + **one dedicated comparison pack** (DRAFT)  
- Knowledge UI: show extract kind chips; review actions; comparison notes highlighted  

### D. Documentation

- `docs/knowledge/extract-template-4s-b.md` (field dictionary)  
- Update schema doc + sprint status after implement  

## Scope (out)

| Out | Why / later gate |
|-----|------------------|
| Auto-extraction of PDFs at scale | Muscles later |
| Auto-approve packs | Violates Brain principle |
| Writing into FlahaSOIL algorithms/config | **Separate product process** (not FlahaINTEL gate) |
| Full literature “threshold bank” artifact | **4S-C** |
| End-to-end productized comparison UI against live FlahaSOIL API | **4S-D** |
| CALC/FAST equation export | **4I-B** |
| YouTube / social | Hold until soil packs prove value |

## Boundary: 4S-B vs 4S-C vs 4S-D

```text
4S-A  Pack shell exists
  │
4S-B  Template + validation + human review + COMPARISON_NOTE shape
  │     (this gate — knowledge quality in FlahaINTEL)
  │
4S-C  Approved literature threshold bank as controlled artifact set
  │
4S-D  Operational comparison workflow (deviation tickets, product handoff UX)
```

**4S-B is the dictionary and the human switch.**  
**4S-C is the filled library.**  
**4S-D is the factory process to FlahaSOIL people/process.**

## Acceptance (when implemented)

- [x] Extract template documented (`docs/knowledge/extract-template-4s-b.md`)  
- [x] Server validates THRESHOLD and COMPARISON_NOTE (and METHOD minimums)  
- [x] Human-only review transitions for packs (no auto-approve)  
- [x] Seed packs expanded with valid structured extracts + comparison notes (stay DRAFT until human)  
- [x] Knowledge UI surfaces extract kinds + review state + comparison notes  
- [x] Every comparison extract asserts `doesNotAutoUpdateFlahaSOIL` / `autoApplyBlocked`  
- [x] Tests for validation + illegal review transitions  
- [x] Multi-region tags still work (QA, JO, CA, global)  

## Non-goals / residual honesty

- Comparison notes may be incomplete (`flahaSoilObservation` empty) until a human fills them  
- “APPROVED” does not mean FlahaSOIL was changed  
- Templates are **illustrative science notes** until 4S-C promotes a governed bank  

## Depends on

- **4S-A** implemented (pack model + API + samples)  
- Product owner **approval of this charter** before code  

## Implementation sketch (after approve only)

1. Docs: extract template dictionary  
2. `knowledgePack/extractTemplate.ts` validation  
3. Service: validate on create/upsert; `reviewPack({ from, to, reviewerId, note })`  
4. Routes: `POST /api/knowledge-packs/:id/review`  
5. Expand `docs/knowledge/samples/...` + reseed  
6. Knowledge UI review + comparison highlight  
7. Gate status → IMPLEMENTED · tests green  

## Owner decision needed

Approve **4S-B as framed above**?

| Option | Meaning |
|--------|---------|
| **A. Approve as framed** | Implement template validation + human review + comparison-note pack (recommended) |
| **B. Approve template only** | Skip comparison-note kind until 4S-D; only THRESHOLD/METHOD validation now |
| **C. Change frame** | Edit this doc (say what to cut/add) then re-approve |

**Recommended: A** — small, systemic step toward FlahaSOIL without touching product code.
