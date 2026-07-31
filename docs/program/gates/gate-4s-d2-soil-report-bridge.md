<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4S-D2 Soil Report Bridge
Introduction:
FlahaINTEL ingests FlahaSOIL test reports (upload PDF/JSON) and optionally
reads FlahaSOIL APIs — then opens human comparison cases. Never writes SOIL engines.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Gate 4S-D2 — Soil report bridge (upload + optional live read)

## Status

**IMPLEMENTED** (upload path foundation) · live SOIL API client is config stub

## What you asked for

1. **Upload** a soil test report into FlahaINTEL and let INTEL run the 4S pipeline  
2. **Or** communicate with FlahaSOIL **directly** (read-only)

## Architecture (LOCKED)

```text
┌──────────────────┐     read-only (optional)      ┌──────────────────┐
│ FlahaSOIL        │◄─────────────────────────────│ FlahaINTEL       │
│ tests · reports  │     FLAHASOIL_API_BASE_URL    │ report import    │
│ PDF / JSON API   │     future GET report         │ threshold bank   │
└────────┬─────────┘                               │ comparison cases │
         │ upload PDF/JSON                         └────────┬─────────┘
         └──────────────────────────────────────────────────┘
                              │
                              ▼ human review only
                    PRODUCT_TICKET_OPEN (people change SOIL)
```

**Write path into FlahaSOIL engines/defaults: FORBIDDEN.**

## Capture paths

| Path | How | Status |
|------|-----|--------|
| **A. Upload report** | `POST /api/flahasoil-comparisons/import-report` (PDF or JSON) | **Built** |
| **B. Direct SOIL API** | Env `FLAHASOIL_API_BASE_URL` + token — pull report by id | **Stub / config** |
| **C. Manual case** | Open case from threshold bank | Built (4S-D) |

## Import behaviour

1. Parse report → report number, test level, parameters (ecDsM, pH, sar, OM, …)  
2. Match each value to **threshold bank** entries for that parameter + level  
3. Create **DRAFT** comparison cases (literature vs report observation)  
4. Human reviews cases (4S-D transitions)  
5. Optional product ticket — **outside** SOIL auto-write  

## Acceptance

- [x] PDF text parser for FlahaSOIL-style reports  
- [x] Multipart or base64 upload endpoint  
- [x] Creates comparison cases from bank matches  
- [x] Human-only; doesNotAutoUpdateFlahaSOIL  
- [x] UI upload control on Knowledge page  
- [ ] Live SOIL API pull (when FLAHASOIL_API_BASE_URL configured + auth)  

## Operator

```powershell
# Upload via UI Knowledge → Import FlahaSOIL report
# or API multipart field "file"
```
