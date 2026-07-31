<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4S-C Literature Threshold Bank
Introduction:
Charter for a human-approved, machine-readable literature threshold bank aligned to FlahaSOIL.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Gate 4S-C — Literature threshold bank (human approved)

## Status

**APPROVED for implementation** (follows locked Stage C) · **IMPLEMENTED** (foundation)

## One sentence

Maintain a **curated bank of THRESHOLD extracts** (FlahaSOIL parameter keys + PRELIMINARY / MODERATE / ADVANCED scope) that becomes **usable for PA comparison only after human pack approval** — never auto-updates FlahaSOIL.

## Depends on

- **4S-A** pack model  
- **4S-B** extract template + validation + human review  
- FlahaSOIL recon (`docs/knowledge/flahasoil-recon-webapp-and-report.md`)

## Scope (in)

- Curated JSON bank file (versioned in repo)  
- Seed into dedicated pack `literature-threshold-bank-v1` (DRAFT until human APPROVED)  
- API: query thresholds by parameter / soilTestLevel / onlyApproved  
- Knowledge UI: Threshold bank browser  
- Every entry: 4S-B valid THRESHOLD + `doesNotAutoUpdateFlahaSOIL: true`  

## Scope (out)

| Out | Later |
|-----|--------|
| Auto-harvest literature at scale | muscles later |
| Auto-approve bank | forbidden |
| Writing FlahaSOIL defaults | product process |
| Full operational comparison tickets | **4S-D** |

## Acceptance

- [x] Bank content file + seed  
- [x] `GET /api/knowledge-packs/threshold-bank`  
- [x] Entries validated as 4S-B THRESHOLD with FlahaSOIL keys + levels  
- [x] onlyApproved defaults to true for “live bank” consumers  
- [x] UI bank view  
- [x] Human still required for APPROVED pack state  

## Bank vs pack

```text
docs/knowledge/banks/literature-threshold-bank.json   ← source of truth in git
        │ seed
        ▼
KnowledgePack code=literature-threshold-bank-v1       ← DRAFT until human APPROVED
        │ onlyApproved=true
        ▼
Threshold bank API / UI                               ← “live” for PA use
```
