<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4R-A Research Topic Index (Research Desk Foundation)
Introduction:
Comprehensive systemic frame for the research desk topic index over approved
FlahaINTEL content — crop × place × theme × method — without embeddings or AI.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Gate 4R-A — Research topic index (research desk foundation)

## Status

**IMPLEMENTED (4R-A.1 MVP)** (2026-07-31) · Materialized topics + API + Knowledge Research tab + CLI rebuild

**Position:** 4R-A is the **index muscle (partial L4)** only. Full multi-domain Stage D scope (library, APA/ASA–CSSA–SSSA citation, literature records, collections map) lives in:

→ [`gate-4r-research-desk-scope.md`](gate-4r-research-desk-scope.md) (2026-08-01)

Do **not** treat 4R-A.1 or any single paper/parameter as the outer boundary of Research.

---

## 1. One sentence

**4R-A** builds a **governed, facet-based research topic index** over **approved** FlahaINTEL content so PA can ask: *“What do we already know about tomato × Qatar × soil moisture / irrigation / nutrients?”* — and get **linked evidence**, not a search engine or a second knowledge wiki.

---

## 2. Why this gate exists now

| Already built | Still missing for “desk depth” |
|---------------|--------------------------------|
| Knowledge packs (SOIL / IRRIGATION / NUTRITION / MARKET_CONTEXT) | No **cross-pack** topic map |
| Human review states (DRAFT → APPROVED) | Hard to find “everything approved about crop X in country Y” |
| Markets analytics (multi-year trends) | Markets are **not** science literature; index must not confuse them |
| 4I-B handoff envelopes | Handoff is **export out**; 4R-A is **browse in** |
| FKP frozen-thin | INTEL must **not** become a methodology wiki; FKP stays methodology |

**4R-A is the research desk index inside INTEL** — operational knowledge and approved extracts, **not** FKP, not embeddings, not auto-summarization.

---

## 3. Maps to final product lock

| Dimension | Mapping |
|-----------|---------|
| **Stage** | Stage D — Research desk · **4R-A** |
| **Metaphor** | **Muscles** (index build) + **Brain** (only APPROVED / governed content surfaces) |
| **Outcomes** | **O2** science packs usable; **O3** product improvement context; supports later **4R-B** writing collections |
| **Geography** | Place is **tags** (country/region), not a separate product per country |
| **Sister products** | Index **links** to packs that hand off to SOIL / CALC / FAST — never merges products |

---

## 4. Core principles (LOCKED)

| # | Principle | Meaning |
|---|-----------|---------|
| P1 | **Approved-first** | Default index = `reviewState = APPROVED` packs (and approved soil cases). DRAFT optional toggle for analysts only. |
| P2 | **Facets, not free-text AI** | Index by structured facets: crop, region/country, theme, extract kind, method/parameter, product lane. No embeddings in 4R-A. |
| P3 | **One primary product per pack** | Theme → SOIL \| CALC \| FAST \| Markets context (existing matrix). Index preserves that split. |
| P4 | **Evidence stays linked** | Every hit points to pack + item (+ artifact / candidate / source URL when present). |
| P5 | **Markets are a sibling facet, not science** | Market prices appear as **MARKET_CONTEXT** or “market series” links — never mixed into THRESHOLD science without an explicit market-context pack. |
| P6 | **No auto-write** | Index never updates SOIL/CALC/FAST. Handoff remains 4I-B. |
| P7 | **FKP boundary** | Methodology / long-form doctrine stays FKP. INTEL indexes **operational extracts and packs** it owns. Optional later: cite FKP doc IDs on items (out of 4R-A MVP). |
| P8 | **Deterministic rebuild** | Index can be rebuilt from packs + items without ML. |

---

## 5. What a “topic” is

A **topic** is a **normalized facet bundle**, not a free paragraph:

```text
topicKey ≈ hash/stable-slug of (
  primaryTheme,           // SOIL | IRRIGATION | NUTRITION | MARKET_CONTEXT | …
  cropSlug?,              // tomato, cucumber, …
  regionSlug?,            // qa, jo, mena, …
  climateSlug?,           // arid, greenhouse, …
  methodOrParameter?,     // kcMid, pH, ETo_FAO56, …
  extractKind?            // THRESHOLD | METHOD | EQUATION | NOTE | …
)
```

**Display title** (human): e.g. `Tomato · QA · IRRIGATION · Kc mid`  
**Members**: list of **index entries** (pack items, and optionally comparison cases / market analyst packs).

Topics are **derived** (computed), then **optionally materialized** in DB for fast browse.

---

## 6. Content universe (what gets indexed)

### 6.1 In scope for 4R-A (MVP)

| Source | When indexed | Facets from |
|--------|--------------|-------------|
| **KnowledgePack** + **KnowledgePackItem** | Pack `APPROVED` (default) | theme, cropTags, regionTags, climateTags, extractKind, structured.parameter / equationId / method |
| **FlahaSoilComparisonCase** | Status `APPROVED` (optional phase 4R-A.2) | parameter, crop/region if stored, product ticket ref |
| **MARKET_CONTEXT packs** | APPROVED only | crop/region tags + “market context” lane |

### 6.2 Explicitly out of 4R-A MVP

| Source | Why deferred |
|--------|----------------|
| Raw RSS articles / governance candidates | Backbone Content/Governance already owns that queue; 4R-B or later “evidence attach” |
| Every market price row | Use Markets analytics; index only **analyst packs** or curated market-context notes |
| OCR / scanned PDFs without text | No OCR gate |
| FKP corpus | Separate system |
| Auto-generated AI summaries | Forbidden without new gate |
| 4R-B research **collections** for paper writing | Next gate after index exists |

### 6.3 Relationship to markets (important)

```text
Markets hub          = price series, multi-year charts, harvest
Research index 4R-A  = “what approved knowledge do we hold about crop × place × theme?”
MARKET_CONTEXT packs = optional bridge (human-approved narrative around markets)
```

Do **not** put 17k Amman rows into the research index. Put **approved knowledge** that **cites** markets or crops.

---

## 7. Facet catalog (systemic)

### 7.1 Primary facets (required for browse)

| Facet | Source fields | Notes |
|-------|---------------|--------|
| **Theme** | `KnowledgePack.theme` | Maps to product lane |
| **Product lane** | Derived: SOIL→FlahaSOIL, IRRIGATION→FlahaCALC, NUTRITION→FlahaFAST, MARKET_CONTEXT→Markets | Display only |
| **Crop** | `cropTags[]` + structured.cropName | Normalize to slug (EN) |
| **Region / country** | `regionTags[]` | Prefer ISO-ish: `qa`, `jo`, `ca`; allow free tags |
| **Climate** | `climateTags[]` | Optional |
| **Extract kind** | `item.extractKind` | THRESHOLD, METHOD, EQUATION, NOTE, REFERENCE, COMPARISON_NOTE |
| **Parameter / method id** | `structured.parameter`, `equationId`, FlahaSOIL/CALC/FAST keys | Science identity |
| **Review state** | pack.reviewState | Filter default APPROVED |
| **Language** | pack.language | en / ar / … |

### 7.2 Secondary facets (nice-to-have in 4R-A.1)

| Facet | Source |
|-------|--------|
| Pack code / version | pack |
| Evidence present | item.evidenceArtifactId or sourceUrl |
| Handoff readiness | pack APPROVED + theme → can export 4I-B |
| Last updated | pack.updatedAt |

### 7.3 Normalization rules

- **Crops:** lowercase EN slug; Arabic names resolve via maps where we have them (Amman map / Mahaseel map / pack EN tags preferred).  
- **Regions:** prefer country codes; keep original tag as `label`.  
- **Parameters:** prefer catalog keys from FlahaSOIL / FlahaCALC / FlahaFAST parameter modules when present.  
- **Unknowns:** still index under theme + free tags; do not drop content.

---

## 8. User journeys (desk)

### Journey A — PA researcher

1. Open **Research** (or Knowledge → Research index).  
2. Filter: crop = tomato, region = qa, theme = IRRIGATION.  
3. See topic cards + list of approved pack items.  
4. Open item → pack detail → optional **Export handoff** if ready.

### Journey B — Product improvement

1. Filter: theme = SOIL, parameter = pH.  
2. See thresholds + comparison notes.  
3. Jump to comparison case or handoff envelope for FlahaSOIL.

### Journey C — Market-aware advice context

1. Filter: MARKET_CONTEXT + crop.  
2. See analyst packs; deep-link to Markets analytics for the same crop if commodity code maps.

### Journey D — Rebuild after pack approval

1. Human approves a pack.  
2. Index rebuild (on approve hook and/or CLI) adds/updates topics.

---

## 9. Architecture (systemic)

```text
                    ┌─────────────────────────────┐
                    │     APPROVED content        │
                    │  packs · items · (cases)    │
                    └──────────────┬──────────────┘
                                   │ rebuild (deterministic)
                                   ▼
                    ┌─────────────────────────────┐
                    │   Research Topic Index      │
                    │   topics + entry links      │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        Browse API            Research UI          Optional export
        facet filters         Knowledge hub        topic → pack list
```

### 9.1 Recommended data model (for implementation phase)

**Option A — Materialized (recommended for MVP performance)**

| Model | Role |
|-------|------|
| `ResearchTopic` | Stable topicKey, title, theme, crop, region, climate, parameter, productLane, entryCount, lastIndexedAt |
| `ResearchTopicEntry` | topicId → packId + itemId (or caseId), extractKind, snippet, reviewState snapshot |

**Option B — Virtual only (query-time aggregation)**  
Acceptable for tiny data; becomes slow as packs grow. Prefer A.

**No full-text search engine in 4R-A.** Optional `ILIKE` on title/snippet only.

### 9.2 Rebuild strategy

| Trigger | Behavior |
|---------|----------|
| CLI `knowledge:rebuild-research-index` | Full tenant rebuild |
| Pack → APPROVED | Incremental upsert topics for that pack’s items |
| Pack leaves APPROVED | Remove entries / recompute topic counts |
| Manual “Rebuild index” in UI | Admin / analyst |

Idempotent: same topicKey → one topic; entries unique (topicId, itemId).

### 9.3 API surface (planned)

| Method | Path | Role |
|--------|------|------|
| GET | `/api/research/topics` | inspect — facet filters + pagination |
| GET | `/api/research/topics/:id` | inspect — topic + entries |
| GET | `/api/research/facets` | inspect — available crop/region/theme counts |
| POST | `/api/research/rebuild` | submit or governance_admin — rebuild |

Query examples:

```http
GET /api/research/topics?theme=IRRIGATION&crop=tomato&region=qa&reviewState=APPROVED
GET /api/research/facets
POST /api/research/rebuild
```

### 9.4 UI surface (planned)

| Surface | Content |
|---------|---------|
| **Knowledge hub** new lane or tab: **Research** | Facet filters + topic list + entry drawer |
| Dashboard | Optional counter: “Approved topics” / “Index stale?” |
| Pack detail | “Topics this pack contributes to” (read-only chips) |

Nav label: **Research** under Knowledge / Brain — not a sixth product engine.

---

## 10. What 4R-A is not (boundaries)

| Not 4R-A | Owner |
|----------|--------|
| Paper writing workspace, citations manager | **4R-B** |
| Semantic / vector search | Future gate (explicit) |
| FKP document library | FKP frozen-thin |
| Market multi-year charts | Markets analytics (done) |
| Auto product parameter updates | Forbidden |
| Unrestricted web crawl for papers | Forbidden without eyes gate |

---

## 11. Split: 4R-A vs 4R-B

| | **4R-A Topic index** | **4R-B Research collection** |
|--|----------------------|------------------------------|
| Goal | Find what we already hold | Assemble a set for a paper / report |
| Unit | Topic + linked entries | Named collection (e.g. “Qatar tomato × moisture 2026”) |
| Output | Browse / filter | Export bibliography-like pack list + notes |
| Depends on | APPROVED packs | 4R-A index + human curation |

**Do not implement 4R-B inside 4R-A.** Only leave hooks (entry IDs stable for later collections).

---

## 12. Governance & security

- **Default visibility:** APPROVED only for VIEWER; analysts may toggle DRAFT if permission ≥ submit.  
- **Tenant isolation:** all topics tenant-scoped.  
- **Audit:** rebuild actor + timestamp; optional count of topics/entries.  
- **No PII** in topic keys beyond pack content already stored.

---

## 13. Implementation phases (when coding starts)

### Phase 4R-A.0 — Frame (this document)

- [x] Charter + boundaries + facet catalog  
- [x] Owner accept (2026-07-31)  

### Phase 4R-A.1 — MVP index (code) — **DONE**

1. [x] Prisma: `ResearchTopic`, `ResearchTopicEntry`, `ResearchIndexRebuild` (+ migration `20260731240000_research_topic_index_4r_a`)  
2. [x] Indexer service: build facets from packs/items (`src/research/*`)  
3. [x] Rebuild CLI `knowledge:rebuild-research-index` + POST `/api/research/rebuild`  
4. [x] GET topics + facets + topic detail API  
5. [x] Knowledge UI: Research tab (filters + list + entry drawer)  
6. [x] Tests: facet extraction (vitest)  
7. [x] Docs: operator how-to (this gate §14)  
8. [x] Best-effort reindex on pack approve / leave-APPROVED 

### Phase 4R-A.2 — Enrichment (optional same sprint if fast)

- Include APPROVED soil comparison cases  
- “Topics for this pack” on pack detail  
- Dashboard index health chip  

### Phase 4R-A.3 — Deferred

- Governance candidate linking  
- FKP citation fields  
- Full-text engine  
- 4R-B collections  

---

## 14. Acceptance criteria (when built)

- [x] Only APPROVED content in default topic browse  
- [x] Filter by at least: theme, crop, region, extractKind, parameter  
- [x] Topic entry deep-links to pack/item  
- [x] Rebuild is idempotent and tenant-safe  
- [x] CALC vs FAST vs SOIL lanes remain separated in product facet  
- [x] No embeddings / AI summarization  
- [x] Documented FKP boundary  
- [x] API + UI usable on local tenant with sample packs  

### Operator

```powershell
npm run knowledge:seed-samples
# Human-approve packs in Knowledge UI
npm run knowledge:rebuild-research-index
# Knowledge → Research tab
```

---

## 15. Dependencies

| Depends on | Status |
|------------|--------|
| Knowledge packs + review states (4S-B) | Done |
| Product matrix SOIL/CALC/FAST | Done |
| Parameter catalogs (SOIL / CALC / FAST keys) | Done foundation |
| 4I-B handoff (optional deep-link from topic) | Done |
| Markets analytics | Done (sibling, not mixed into science index) |

---

## 16. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Empty index (few APPROVED packs) | Seed samples + operator path to approve; show empty states with “approve packs first” |
| Tag chaos (inconsistent crop names) | Normalize slugs; prefer EN; document tag conventions |
| Index becomes second wiki | Strict: no free-form topic editing in MVP — derived only |
| Performance on large tenants | Materialized topics + pagination |
| Confusion with Markets | Clear UI copy: Research = knowledge packs; Markets = prices |

---

## 17. Success picture (owner narrative)

> “I filter **tomato · Jordan · IRRIGATION**. I see three approved extracts on Kc and one water-saving note. I open the pack, export a CALC handoff if needed. Markets for tomato I open in Markets analytics — different tool, same crop tag where we mapped it.”

That is **research desk depth** without abandoning INTEL’s ops identity.

---

## 18. Decision required before code

| Decision | Recommendation |
|----------|----------------|
| Materialized DB topics vs virtual only | **Materialized** |
| Default APPROVED-only | **Yes** |
| Include soil cases in MVP | **4R-A.2** (after packs) |
| New top-level nav “Research” vs Knowledge tab | **Knowledge → Research tab** first (less nav sprawl) |
| Auto-rebuild on approve | **Yes** (best-effort) + CLI full rebuild |

**Owner: accept this frame (or amend) → then implement 4R-A.1.**

---

## 19. Related documents

- `docs/program/flahaintel-final-product-lock.md` — Stage D  
- `docs/knowledge/knowledge-product-matrix.md` — theme → product  
- `docs/program/gates/gate-4i-b-calc-fast-handoff.md` — export path  
- `docs/markets/market-price-analytics.md` — markets charts (sibling)  
- `docs/program/flaha-system-vision-and-operate-lock.md` — INTEL-primary / FKP-frozen  
