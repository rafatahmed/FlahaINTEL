<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Evidence Intake Spine (Central Submit)
Introduction:
System vision for land-once → classify → promote. Domain models receive projections,
not independent per-model file re-ingests.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-08-19
-->

# Evidence Intake Spine — central Submit

**Status:** IMPLEMENTED (foundation) · **BINDING** product direction  
**Decision:** Submit is the **universal human intake door**, not a narrow one-off document form.

## Principle

```text
LAND (spine) → CLASSIFY → PROMOTE (typed domain engine)
```

- **One** evidence landing (file or URL) per human action.  
- **Promote** creates market rows, soil comparison cases, or eyes pipeline jobs.  
- **Never** auto-write FlahaSOIL / FlahaCALC / FlahaFAST product engines.  
- **Not** “upload into each model separately.”

## Classes

| Class | Promote target |
|-------|----------------|
| `EYES_WEBSITE` | One-shot acquire → extract → normalize → **human Approve**. Finished in the vault (Content). **Not RSS.** RSS is a separate recurring Sources protocol. |
| `EYES_DOCUMENT` | One-shot document pipeline → **human Approve**. Same vault finish. Not RSS promotion. |
| `MARKET_MAHASEEL_PDF` | `qa-mahaseel-local-vegetables` prices (period dedupe) |
| `MARKET_JO_AMMAN_EXCEL` | `jo-amman-central-market` prices (day dedupe) |
| `PRODUCT_SOIL_REPORT` | FlahaSOIL comparison cases (soil only) |
| `PRODUCT_CALC_REPORT` | Reserved — **FlahaCALC only** (irrigation, weather, ETo, Kc) |
| `PRODUCT_FAST_REPORT` | Reserved — **FlahaFAST only** (nutrient management, formulations) |

**Product separation (LOCKED):** FlahaCALC ≠ FlahaFAST. Do not count or hand off irrigation and nutrients as one product.

## API

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/intake/matrix` | Class matrix |
| GET | `/api/intake` | List intakes |
| GET | `/api/intake/:id` | Detail |
| POST | `/api/intake/land/website` | Land + promote website |
| POST | `/api/intake/land/file` | Multipart land (`intakeClass`, `autoPromote`) |
| POST | `/api/intake/:id/classify` | Set class; optional `autoPromote` |
| POST | `/api/intake/:id/promote` | Run domain promoter |

## Storage

- Landed files: `FLAHA_INTAKE_ROOT` or default `.flaha-intakes/{tenantId}/{intakeId}/`  
- DB: `EvidenceIntake`  
- Eyes still use ArtifactStore via product submissions  

## UI

**Submit** page: New intake (matrix + website + file type selector) · Recent intakes (status, promote, classify).

## Related

- Historical markets: `docs/markets/historical-import-matrix.md`  
- System posture: `docs/program/flaha-system-vision-and-operate-lock.md`  
