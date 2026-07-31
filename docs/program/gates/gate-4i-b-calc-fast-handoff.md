<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4I-B Product Handoff Rules (CALC and FAST separate)
Introduction:
Defines read-only export envelopes toward FlahaCALC (irrigation/weather) and
separately FlahaFAST (nutrients) — never one merged product, never auto-mutation.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Gate 4I-B — Handoff rules (FlahaCALC and FlahaFAST as separate targets)

## Status

**IMPLEMENTED** (2026-07-31) · Export envelope + API/CLI/UI + audit; feed policies via **4B-A**

## Product separation (LOCKED)

| Envelope target | Pack themes / content | Product domain |
|-----------------|----------------------|----------------|
| `FlahaCALC` | `IRRIGATION` (ETo, Kc, depth, weather) | Irrigation & weather |
| `FlahaFAST` | `NUTRITION` (EC/pH, elements, salts) | Nutrient management |
| `FlahaSOIL` | `SOIL` / comparison cases | Soil (4S path) |

Never emit a single “CALC+FAST” product identity. Envelopes may list **one** primary target (or explicit multi-target only with separate section per product).

## One sentence

Export **approved** pack content as a **versioned, read-only handoff envelope** aimed at **either** FlahaCALC **or** FlahaFAST (or SOIL) for human product work — without FlahaINTEL writing into those products.

## Maps to final product

- Lock Stage C **4I-B** · Muscles `MUS-HND-*`  
- Brain still owns formal product-change process (later **4B** feed policies)

## Scope (in)

- Envelope schema `flaha-intel-product-handoff-v1` (see recon §5)
- API and/or CLI: build envelope from APPROVED packs filtered by theme / code / product target
- Web: download JSON from Knowledge pack detail (analyst role)
- Flags always: `autoApplyBlocked: true`
- Audit: who exported when; which pack versions

## Scope (out)

- HTTP/API write adapters into FlahaCalc or FlahaFast  
- Auto-merge of Kc or nutrient targets into product seeds  
- Live bidirectional sync  
- Farmer-facing advice automation  

## Human governance

```text
Pack DRAFT → READY_FOR_REVIEW → APPROVED
        │
        └── only APPROVED items enter handoff envelope
                │
                └── PA / product owner applies (or rejects) in Calc/Fast process
```

No DRAFT or READY_FOR_REVIEW content in production handoff exports.

## Acceptance (when built)

- [x] Envelope schema documented + validated in tests (`productHandoff/envelope.test.ts`)  
- [x] Export only APPROVED packs  
- [x] Targets field is **exactly one** of `FlahaCALC` | `FlahaFAST` | `FlahaSOIL`  
- [x] UI download (Knowledge pack detail) + CLI `knowledge:export-handoff`  
- [x] Explicit documentation: product code changes remain separate process  
- [x] Audit table `ProductHandoffExport` (who / when / sha256 / full envelope)

## Depends on

4I-A parameter catalog + packs; 4S-B review states.
