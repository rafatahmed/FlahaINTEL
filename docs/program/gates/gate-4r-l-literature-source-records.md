<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4R-L Literature Source Records
Introduction:
Charter and acceptance for multi-domain citable literature records (Stage D L2)
with ASA/CSSA/SSSA · APA 7th citation fields, intake, and Research desk browse.

Created by: Rafat Al Khashan
Created date: 2026-08-01
Last modified: 2026-08-01
-->

# Gate 4R-L — Literature source records (L2)

## Status

**IMPLEMENTED (4R-L.1 MVP)** (2026-08-01) · Parent scope accepted  
Parent: `docs/program/gates/gate-4r-research-desk-scope.md`

---

## 1. Outcome

PA can **register multi-domain literature** (articles, reports, books, standards, bulletins) as **citable source records** with **APA 7th / ASA–CSSA–SSSA-compatible** identity, keywords, trust tier, optional product links, optional artifact/path evidence — then **browse and filter** them on the Research desk. Sources are **aboutness + bibliography**, not automatic scientific claims (claims remain L3 packs/extracts).

---

## 2. In scope (4R-L.1)

| Item | Detail |
|------|--------|
| Model | `LiteratureSource` tenant-scoped |
| Citation | Generated APA 7th reference string; `citationComplete` when DOI or stable URL + authors + year + title |
| Domains | Multi-domain tags (not product-hardcoded) |
| Trust | PEER_REVIEWED · INSTITUTIONAL · EXTENSION · BOOK · STANDARDS · TRADE · OTHER |
| Review | CATALOGUED → SOURCE_APPROVED \| REJECTED \| ARCHIVED |
| API | CRUD-ish list/get/create/update + review |
| CLI | `knowledge:register-literature` JSON register |
| UI | Knowledge → Research → **Literature** sub-panel |
| Index | SOURCE_APPROVED sources contribute REFERENCE entries to research topic rebuild |

## 3. Out of scope (later)

| Item | Gate |
|------|------|
| Full Zotero sync / Crossref auto-fetch | Later |
| 4R-B collections + bibliography export file | 4R-B |
| Deep extract cards from PDF body | 4R-X |
| OCR / AI keyword extraction | Forbidden without gate |
| Auto product write | Never |

## 4. Acceptance

- [x] Multi-domain literature records (not SOIL-only)
- [x] APA author–year reference formatting (desk default)
- [x] DOI preferred; URL/accession for reports
- [x] Aboutness keywords ≠ approved claims
- [x] SOURCE_APPROVED only in default literature browse of “trusted sources”
- [x] Research rebuild can attach approved literature as REFERENCE topics
- [x] No embeddings / AI

## 5. Operator

```powershell
# Register from JSON (see docs/knowledge/samples/literature-source-examples.json)
npm run knowledge:register-literature -- --file=path\to\sources.json
# Or API POST /api/research/literature
# Review → SOURCE_APPROVED in UI or POST .../review
npm run knowledge:rebuild-research-index
```
