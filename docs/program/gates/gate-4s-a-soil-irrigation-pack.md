<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4S-A Soil and Irrigation Knowledge Pack
Introduction:
Charter for universal soil/irrigation knowledge packs with place tags for FlahaSOIL and related products.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Gate 4S-A — Soil and irrigation knowledge pack (definition)

## Status

**APPROVED** by product owner (2026-07-30) · **IMPLEMENTED** (schema + API + pack documentation)

## Purpose

Define the **knowledge pack** shape for soil analysis and irrigation/water-saving context: universal science first, **country/climate as tags**, so Flaha can improve FlahaSOIL / CALC / FAST and advice **anywhere** farmers are served.

## Maps to final product

- Outcomes **O2, O3**  
- Metaphor: Eyes + Muscles (science)  
- Lock Stage C  

## Scope (in)

- Pack metadata: theme (soil | irrigation | nutrition…), crop tags, region/climate tags, language  
- Required evidence links to approved governance candidates/artifacts  
- Extract template fields (e.g. threshold, method, unit, crop, note) — human reviewed  
- Explicit non-auto-update of FlahaSOIL product code  

## Scope (out)

- Full literature auto-extraction at scale  
- YouTube/social  
- Changing FlahaSOIL algorithms without separate product process  

## Acceptance (when implemented)

- [x] Pack schema documented (`docs/knowledge/knowledge-pack-schema.md` + Prisma models)  
- [x] Sample packs seeded systemically (`docs/knowledge/samples/soil-irrigation-pack-samples.json` + `npm run knowledge:seed-samples`)
- [x] Comparison note path toward FlahaSOIL documented (manual; packs never auto-change SOIL)  
- [x] Works with multi-country tags (regionTags e.g. QA, JO, CA)

## Depends on

Backbone + governance; product owner approval.
