<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Operate Gap Audit (2026-08)
Introduction:
Deep audit of vision vs v0.6 surface vs live operate — gaps and gap-close program.

Created by: Rafat Al Khashan
Created date: 2026-08-01
Last modified: 2026-08-19
-->

# Operate gap audit — 2026-08

**Status:** LIVING · owner operate reference  
**Posture:** `INTEL-primary · FKP-frozen-thin · MCP-on-named-consumer`  
**Tags:** `v0.5.0` backbone · `v0.6.0` product surface (surface ≠ product-complete)  
**Related:** final product lock · operate lock · systemic-operate-checklist · sprint-post-3n-1-status

---

## 1. Vision (locked)

Private PA intelligence: trusted eyes worldwide → structure markets + science → evidence trail → humans approve → feed SOIL · CALC · FAST. Not public news, not wild crawl, not one country.

| Metaphor | Target |
|----------|--------|
| Backbone | Trust, evidence, audit |
| Eyes | Markets, science, news, controlled web |
| Muscles | Harvest, extract, packs, index |
| Brain | Human approve, handoff rules |

**Outcomes O1–O5:** current world · PA knowledge packs · product trail · safe collect · human control.

---

## 2. Where we are

| Layer | Surface (v0.6) | Operate reality |
|-------|----------------|-----------------|
| Backbone | Strong | Strong |
| Eyes | Markets + RSS + Submit | Markets/RSS strong; science eyes weak |
| Muscles | Pipeline + harvest + packs API | Market harvest strong; document workers weak; packs empty of science |
| Brain | Many review UIs | Fragmented; little substance to approve |

**Program truth:** gates labeled DONE = **API/UI surface**.  
**Operate truth:** Content / Governance / Knowledge / literature **density still weak**.

### Host snapshot (audit time)

| Object | Typical state |
|--------|----------------|
| Market prices | Tens of thousands (real) |
| RSS articles | Hundreds (real) |
| SOIL/IRRIGATION/NUTRITION packs | Empty or near-empty |
| Literature | Thin catalog; DOI cards |
| Topics | Generic when keywords empty |
| EYES_DOCUMENT | Land + READY job without workers |
| Soil cases | Workflow exists; sample loop exercised |

---

## 3. Deep gaps (priority)

| ID | Gap | Severity | Close direction |
|----|-----|----------|-----------------|
| **G1** | EYES general document = upload/promote; PROMOTED ≠ finished | Critical UX | Workers + honest labels; de-emphasize for PA science |
| **G2** | Knowledge SOIL/CALC/FAST empty | Critical O2 | Authoring + one vertical pack to APPROVED |
| **G3** | Literature DOI-only UI; keywords empty; topics dumb | Critical Stage D | Edit aboutness; keyword→topics; PDF KEY WORDS later |
| **G4** | Brain queues fragmented | High | Review inbox + clear destiny per Submit class |
| **G5** | Markets not all 365d MEETS_TARGET; host-off misses days | High O1 | Daily harvest while PC is on. MoCI = today-only; Amman = 3-day lookback or Excel (`docs/markets/harvest-lookback-qa-jo.md`) |
| **G6** | RSS agri PENDING accept | Medium | Two-run process |
| **G7** | Evidence conjugation paper↔pack incomplete | Medium | Artifact link + hard ref (started) |
| **G8** | Docs say DONE; operate feels weak | High trust | This audit + language discipline |

---

## 4. Gap-close program (ordered)

### Wave A — Literature aboutness + topics (**SHIPPED 2026-08-01**)

1. ~~PATCH literature: keywords, domainTags, primaryTheme, parameterKeys, abstract~~  
2. ~~Crossref register accepts operator keywords/domains~~  
3. ~~Topic rebuild expands **all keywords** as aboutness facets~~  
4. ~~Research UI: edit aboutness + rebuild index~~  
5. ~~Require aboutness before SOURCE_APPROVED (domain + ≥1 keyword)~~  
6. ~~Backfill McLean KEY WORDS → SOIL topics~~  

**Next in Wave A residual:** PDF KEY WORDS auto-extract — **4O-B** (`gate-4o-operate-harden.md`).

### Wave B — Paper → SOIL pack vertical (**SHIPPED 2026-08-01**)

1. ~~One APPROVED SOIL pack from real literature~~ → `soil-mclean-base-saturation-sufficiency-1972-v1`  
2. ~~evidenceArtifactId + literatureSourceId + DOI on every extract~~  
3. ~~Hard gate READY_FOR_REVIEW → APPROVED~~  
4. ~~Research index rebuild (pack + literature topics)~~  
5. Residual: UI “create pack from selected literature” shortcut; more SOIL packs; handoff export when PA ready  

**Pack code:** `soil-mclean-base-saturation-sufficiency-1972-v1` · theme SOIL · APPROVED  
**Source:** McLean 1972 DOI `10.1080/00103627209366359` + Submit PDF artifact

### Wave C — Eyes document honesty (**SHIPPED foundation 2026-08-01**)

1. ~~Intake list/get enriches live ProductSubmission pipeline status~~  
2. ~~Submit UI: live stage / extract job state; Advance submission button~~  
3. ~~Jobs UI: READY = need workers; `npm run ops:pipeline-once`~~  
4. Residual: always-on worker service on host; Docling/Tika provision when PDF extract fails  

### Wave B residual — pack from literature (**SHIPPED 2026-08-01**)

1. ~~`POST /api/research/literature/:id/create-pack`~~  
2. ~~Research UI: Create DRAFT knowledge pack~~  
3. Residual: one-click pack from collection; bulk pack builder  

**Operator path:** Research → aboutness → Create DRAFT pack → Knowledge lane → Submit → Approve

### Wave D — Markets + RSS operate (**SHIPPED tooling + host apply 2026-08-01**)

1. ~~`ops:wave-d-report`~~ retention + packs + RSS summary  
2. ~~`rss:accept-two-run`~~ PENDING → ACCEPTED when two SUCCESS + latest added 0  
3. ~~Disable test/phase3k broken sources~~  
4. ~~Approve MARKET_CONTEXT packs only for MEETS_TARGET~~ (Amman + Mahaseel APPROVED)  
5. ~~Publisher freshness on retention~~ (`publisherFreshness` FRESH|STALE + lag days)  
6. Residual: MoCI channels EARLY — **publisher-limited** (API returns one bulletin day; date params ignored). Keep daily harvest; do **not** invent history or APPROVE MoCI packs until span deepens.

**Commands:**
```powershell
npm run ops:wave-d-report
npm run ops:operate-scoreboard
npm run rss:accept-two-run -- --confirm
npm run bootstrap:source-policies
npm run ops:wave-d-report -- --approve-meets-target-packs --confirm
npm run markets:harvest -- --force   # ongoing for EARLY MoCI
```

### Wave C residual — Eyes PDF lite (**SHIPPED 2026-08-01**)

1. ~~`ops:eyes-pdf-lite`~~ completes READY DOCUMENT_TEXT_EXTRACTION PDFs via pdf-parse  
2. ~~`ops:eyes-advance`~~ attaches RESULT/METADATA and advances submission → Content  
3. ~~`ops:pipeline-once`~~ includes eyes-pdf-lite after workers  
4. ~~McLean DOCUMENT_UPLOAD~~ SUCCEEDED + governance candidate READY_FOR_REVIEW  
5. Residual: always-on workers; Docling/Tika for hard PDFs; PDF KEY WORDS auto-extract  

### Wave B residual — science packs (**SHIPPED 2026-08-01**)

| Theme | APPROVED pack (example) |
|-------|-------------------------|
| SOIL | `soil-mclean-base-saturation-sufficiency-1972-v1` (+ residual create-from-lit) |
| IRRIGATION / CALC | `irrigation-fao56-etc-kc-backbone-v1` |
| NUTRITION / FAST | `nutrition-solution-ec-ph-context-v1` |

### Wave E — Host hygiene (**partial 2026-08-01**)

1. ~~`ops:safe-disk-cleanup`~~ regenerable caches + optional Playwright browsers  
2. ~~`ops:cancel-fixture-jobs`~~ clears example.com READY noise from Jobs  
3. Disk ≥15% free — **still OPEN_HOST** (~4% after reclaim; D: also full → cannot relocate artifacts easily without operator volume plan)

### Operate scoreboard (single command)

```powershell
npm run ops:operate-scoreboard
```

Closes language drift: OPEN vs CLOSED vs BLOCKED_PUBLISHER vs OPEN_HOST.

---

## 5. Live residual scoreboard (2026-08-01 re-check)

| ID | Item | Status |
|----|------|--------|
| O1 | MoCI 365d series | **OPEN_PARTIAL_PUBLISHER** — 0/4 MEETS_TARGET; 2/4 STALE official bulletins |
| O2 | Disk ≥15% | **OPEN_HOST** (~4% free on C:) |
| O3 | Eyes PDF stuck | **CLOSED** (0 READY PDF; McLean at GOVERNANCE) |
| O4 | SOIL/CALC/FAST packs | **CLOSED** (APPROVED science packs present) |
| O5 | RSS agri accept | **CLOSED** (0 PENDING; 15 ACCEPTED) |
| O6 | Fixture Jobs noise | **CLOSED** (12 example.com READY cancelled) |

**Brain residual:** 1 governance candidate READY_FOR_REVIEW (McLean extract path) — human decide in Content/Governance UI.

---

## 6. Next operate checklist

See `systemic-operate-checklist.md` (Loops A–D).  
**Default PA path:** Markets + domain Submit + Knowledge packs — not general document as main science door.

---

## 7. Non-goals (still held)

YouTube/X · unrestricted crawl · OCR · AI auto-summarize · FKP peer build · auto-write sister engines.

---

## 8. Revision

| Date | Note |
|------|------|
| 2026-08-01 | Waves A–C + Wave D tooling: RSS two-run ACCEPTED (7+), MEETS_TARGET market packs APPROVED, MoCI still EARLY |
| 2026-08-01 | Systemic residual pass: publisher freshness, eyes McLean closed, science packs APPROVED, fixture cancel, operate-scoreboard; disk + MoCI publisher remain |
