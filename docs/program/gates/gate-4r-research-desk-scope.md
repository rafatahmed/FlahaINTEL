<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4R Research Desk — Comprehensive Scope
Introduction:
Full Stage D research desk scope for FlahaINTEL: multi-domain agribusiness
literature library, citation standard (ASA/CSSA/SSSA · APA 7th), intake,
index, collections, and boundaries vs products, Markets, and FKP.
Not an implementation plan and not narrowed to any single paper or parameter.

Created by: Rafat Al Khashan
Created date: 2026-08-01
Last modified: 2026-08-01
-->

# Gate 4R — Research desk comprehensive scope (Stage D)

## Status

**SCOPE ACCEPTED** (2026-08-01) · Owner accept → implement along gate map  
**Not** limited to one domain, paper, or product.  
**4R-L.1** literature records: `gate-4r-l-literature-source-records.md`  
**4R-B.1** collections + APA export: `gate-4r-b-research-collections.md`  
**4R-E thin** attach-claim: pack item `literatureSourceId` + API.

Related short pointer: `docs/program/research-desk-frame.md`  
Related slice already built: `docs/program/gates/gate-4r-a-research-topic-index.md` (4R-A.1 = approved **pack** facet index only)

---

## 1. One sentence

**Stage D Research desk** is FlahaINTEL’s **governed multi-domain library and finding system** for Precision Agriculture knowledge — plant production, soil science, environmental/weather science, nutrition/irrigation context, markets-as-context, and broader agribusiness — so PA can **ingest authentic sources, cite them correctly, extract approved claims, find them by topic, and assemble them for writing or product improvement** without becoming a public search engine, an unsupervised crawl farm, or a silent writer into FlahaSOIL / FlahaCALC / FlahaFAST.

---

## 2. Why this document exists

Earlier work delivered **4R-A.1**: a facet index over **APPROVED knowledge packs**. That is a **muscle**, not the full research desk.

Owner intent (locked for this scope):

| Intent | Meaning |
|--------|---------|
| **Bigger than packs** | Full library of articles, reports, books, standards, institutional docs across **all** PA topics |
| **Bigger than one product** | FlahaSOIL, FlahaCALC, FlahaFAST are **consumers of some extracts**, not the outer walls of Research |
| **Bigger than one example** | Any single PDF (e.g. a CEC methods paper) is only an **illustration** of a well-structured source — never the system design boundary |
| **Scientifically literate** | Citation and reference practice follows **field standards** (ASA/CSSA/SSSA · APA 7th), not ad-hoc notes |

This scope defines **what Research is**, **what it is not**, **citation law**, **content universe**, **layers**, **gates**, and **non-goals** — so future coding does not shrink back to samples or one parameter.

---

## 3. Maps to final product lock

| Dimension | Mapping |
|-----------|---------|
| **Stage** | **D — Research desk** (product-complete path includes Stage D) |
| **Metaphor** | **Eyes** (literature & reports in) · **Muscles** (intake, index, collections) · **Brain** (approve, cite, handoff rules) · **Backbone** (artifacts, audit) |
| **Outcomes** | **O2** usable science knowledge · **O3** product improvement context · advice/research support |
| **Eyes channels** | **E-Science** (literature/reports) primary; **E-News** / markets remain siblings, not substitutes |
| **Geography** | Place is a **tag / applicability judgment**, not a product per country |
| **Sister products** | Optional extract links → SOIL / CALC / FAST; **never** auto-merge products or auto-write engines |
| **FKP** | Frozen-thin methodology authority — Research does **not** re-implement FKP |

---

## 4. Content universe (what Research covers)

### 4.1 Domains (open catalog — not product-only)

Research is **domain-agnostic first**. Product lane is **optional**.

| Domain family (illustrative, not exhaustive) | Typical use |
|-----------------------------------------------|-------------|
| **Soil science** | Chemistry, physics, taxonomy, methods, surveys |
| **Plant production / crops / horticulture** | Yield, stages, management, greenhouse |
| **Environmental / weather / agrometeorology** | Climate, ETo context, extremes, station reports |
| **Irrigation & water** | Scheduling science, efficiency, water quality for irrigation |
| **Nutrition & fertigation** | Solution chemistry, nutrient targets, source water |
| **Markets & agribusiness economics** | Price context, trade, farm economics (as **literature/context**, not the price DB) |
| **Pest, disease, IPM** (when PA needs it) | Desk knowledge; product link only if a future gate says so |
| **Digital agri / methods / standards** | Protocols, lab methods, ISO/soil survey standards |
| **Policy / institutional reports** | Official bulletins with stable URLs/accession |

**Rule:** An article need **not** map to FlahaSOIL/CALC/FAST to belong in Research. Many items stay **desk-only**.

### 4.2 Source types (intake shapes)

| Type | Trust default (starting) | Notes |
|------|--------------------------|--------|
| Peer-reviewed journal article | High | Prefer; DOI required when available |
| Official soil survey / weather-station / agency report | High | Stable URL or accession |
| Book / book chapter | Medium–high | Full bibliographic record |
| Extension bulletin / university pub | Medium–high | Prefer durable links |
| Standards (taxonomy, methods) | High | Cite edition/version |
| Conference paper | Medium | Explicit type |
| Trade / blog / vendor | Low | Allowed only with trust tier; never auto-elevate to THRESHOLD |
| Unpublished / personal communication | Not a library object | Text-only mention if needed; **do not** invent a fake citation |

### 4.3 Explicitly not the content universe of Research

| Out | Where it lives instead |
|-----|-------------------------|
| Every raw market price row | Markets store + analytics |
| Unrestricted web crawl corpus | Forbidden without eyes gate |
| Full FKP methodology wiki | FKP frozen-thin |
| Sister product runtime engines | FlahaSOIL / CALC / FAST apps |
| AI-generated “summary libraries” as authority | Forbidden without new gate |

---

## 5. Core principles (LOCKED for Stage D)

| # | Principle | Meaning |
|---|-----------|---------|
| R1 | **Multi-domain by design** | Schema and UI must not hard-code one product or one parameter family |
| R2 | **Evidence first** | Every library object points at an immutable artifact (or durable public identifier + capture policy) |
| R3 | **Aboutness ≠ claim** | Keywords/topics catalog **what the source is about**; **approved extracts** are what PA asserts as usable knowledge |
| R4 | **Approved-first desk** | Default Research browse of **claims** = APPROVED extracts/packs; catalog-only sources may be listed as “source library” with explicit non-claim status |
| R5 | **Citation standard is law** | Bibliographic identity follows **§6** (ASA/CSSA/SSSA · APA 7th author–year + DOI) |
| R6 | **Trust tiers** | Peer-reviewed ≠ blog; ranking and default filters respect tier |
| R7 | **Product link optional** | Extract may set `productLane` / parameter keys; absence is valid |
| R8 | **No auto product write** | Index and library never update SOIL/CALC/FAST code or production parameters |
| R9 | **Place is careful** | Study region (from source) ≠ applicability region (human judgment) — never auto-equate soil class to country |
| R10 | **Deterministic rebuild** | Facet index rebuilds without ML; optional later AI assist is not authority |
| R11 | **Primary sources preferred** | Peer-reviewed, official surveys, weather reports over secondary blogs |
| R12 | **One intake spine** | All domains use the same document → artifact → record → (optional extract) path |

---

## 6. Citation and reference standard (LOCKED)

### 6.1 Primary standard

For **plant production, soil science, and environmental/weather science in agriculture**, FlahaINTEL Research desk locks:

| Item | Standard |
|------|----------|
| **Society practice** | **ASA / CSSA / SSSA** Publications Handbook and Style Manual |
| **Citation system** | **APA 7th edition** (author–year) as adopted by those societies |
| **In-text** | Author–year **only** — **never** numbered (Vancouver) for desk-native writing |
| **Reference list** | Alphabetical by first author’s surname |
| **DOI** | **Always include when available**; verify via Crossref (or journal checker) before treating as complete |
| **Journal titles** | Full title or **consistent** standard abbreviation — pick one policy per export profile and stick to it |

**Authoritative external guide:** ASA/CSSA/SSSA Publications Handbook and Style Manual (Science Societies).  
**Journal “Instructions for Authors” override** for any export aimed at a **specific journal**. Desk **default** remains APA 7th / ASA-CSSA-SSSA-compatible.

### 6.2 In-text patterns (desk default)

| Case | Form |
|------|------|
| One author | (Smith, 2023) or Smith (2023) |
| Two authors | (Smith & Jones, 2023) |
| Three or more | (Smith et al., 2023) |

### 6.3 Reference list example (journal article)

```text
Smith, J. A., & Jones, B. C. (2023). Effects of soil moisture and temperature
on maize yield under climate variability. Soil Science Society of America
Journal, 87(4), 1023–1035. https://doi.org/10.1002/saj2.XXXXX
```

### 6.4 Domain notes (style awareness, not competing defaults)

| Sub-area | Common styles | FlahaINTEL desk default |
|----------|---------------|-------------------------|
| Soil science (SSSAJ, etc.) | APA 7th (ASA/CSSA/SSSA) | **Default** |
| Crop / plant production (Agronomy Journal, Crop Science) | APA 7th / author–year | **Default** |
| Horticulture (ASHS) | CSE name-year | Export profile later if needed |
| Many European plant/soil journals | Harvard / Chicago author–date | Export profile per target |
| Medical-adjacent / some intl. | Vancouver numbered | **Not** desk default; only if target journal requires |

### 6.5 Bibliographic fields Research must be able to hold

Minimum identity for a **citable library record** (implementation later):

| Field | Requirement |
|-------|-------------|
| authors[] (ordered) | Required for journal-like works |
| year | Required when known |
| title | Required |
| container (journal/book) | When applicable |
| volume, issue, pages | When applicable |
| DOI | Required when exists |
| URL / accession | For reports, datasets, older bulletins without DOI |
| publisher / place | Books, reports |
| documentType | article, chapter, report, standard, bulletin, other |
| language | en / ar / … |
| keywords[] | From source and/or human |
| accessStatus | public resolvable preferred |

### 6.6 Field best practices (operations)

1. Prefer **primary peer-reviewed** and **official** sources.  
2. Cite **soil taxonomy** correctly on first mention in extracts (US Soil Taxonomy or WRB) when soils are named.  
3. DOIs always; older extension/weather data → **stable URL or accession**.  
4. Operators should use a **reference manager** (Zotero, EndNote, Mendeley, Paperpile) with **APA 7th** or society style; INTEL is not required to replace Zotero on day one but **exports must be APA-compatible**.  
5. Only cite **publicly accessible** material as formal references; unpublished data / personal communications stay in-text only.  
6. Before treating a record as “citation-complete,” confirm DOI resolves (Crossref or publisher).

### 6.7 How the scientific world indexes (context for quality)

Clean DOI + consistent author–year improve matching in the agricultural indexing pipeline:

```text
Publisher → Crossref (DOI + reference lists) → citation graph
     → CAB Abstracts / CAB Direct, Agricola, WoS/Scopus,
       Google Scholar / Dimensions / Semantic Scholar,
       domain repositories (soil / weather archives)
```

**Implication for FlahaINTEL:** sloppy titles, missing DOIs, and non-standard references make **external** and **internal** matching worse. Desk records must be **citation-grade**, not filename-grade.

### 6.8 What citation standard is not

| Not | Why |
|-----|-----|
| Auto-fetch of full-text from Sci-Hub or shadow libraries | Legal/ethics; out of scope |
| Replacing peer review with “we have a PDF” | Trust tier still applies |
| Numbered citation UI as default | Conflicts with ASA/CSSA/SSSA practice |
| Inventing DOIs or authors | Integrity failure |

---

## 7. Conceptual layers (architecture of meaning)

```text
┌─────────────────────────────────────────────────────────────────┐
│ L0  OPERATOR LIBRARY (external)                                 │
│     Local folders, Zotero, shared drives — many domains         │
└───────────────────────────────┬─────────────────────────────────┘
                                │ governed intake
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L1  EVIDENCE ARTIFACT (backbone)                                │
│     Immutable file/blob · hash · provenance · no “truth” claim  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L2  LITERATURE / SOURCE RECORD (citable identity)               │
│     APA-grade metadata · DOI · keywords · domain · trust tier   │
│     Status: catalogued | source-approved | rejected             │
└───────────────────────────────┬─────────────────────────────────┘
                                │ optional human depth
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L3  STRUCTURED EXTRACTS (claims)                                │
│     Pack items / extract cards: METHOD, THRESHOLD, NOTE,        │
│     REFERENCE, EQUATION, … · optional productLane + param keys  │
│     Review: DRAFT → APPROVED                                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L4  RESEARCH INDEX (finder)                                     │
│     Facets: domain, keywords, crop, place, climate, extractKind,│
│     productLane?, parameter?, trust, year                       │
│     4R-A.1 today: subset over APPROVED packs only               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L5  COLLECTIONS (writing / dossiers) — 4R-B                     │
│     Named sets for papers, internal reports, product tickets    │
│     Export bibliography in APA 7th / target journal profile     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ optional
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
     FlahaSOIL             FlahaCALC             FlahaFAST
     (handoff 4I-B)        (handoff 4I-B)        (handoff 4I-B)
          + Markets context · farm advice · PA reports
```

**Hard separation:** L2 answers “what source is this?” · L3 answers “what do we claim?” · L4 finds both · L5 assembles for output.

---

## 8. Facet model (desk-wide, not product-hardcoded)

### 8.1 Primary browse facets

| Facet | Role |
|-------|------|
| **Domain / theme** | Soil, irrigation, nutrition, market-context, plant production, weather, … |
| **Keywords / topics** | From source + human; free + controlled over time |
| **Crop** | When relevant |
| **Place** | Study region vs applicability (see R9) |
| **Climate / environment** | Optional |
| **Document type** | Article, report, book, standard, … |
| **Trust tier** | Peer-reviewed, institutional, extension, trade, … |
| **Year** | For currency filters |
| **Language** | en, ar, … |
| **Extract kind** | When L3 exists: METHOD, THRESHOLD, NOTE, REFERENCE, … |
| **Product lane** | Optional: FlahaSOIL \| FlahaCALC \| FlahaFAST \| Markets \| none |
| **Parameter / method key** | Optional closed vocab when linked to a product or pack template |

### 8.2 Product linkage (secondary)

| Sister | Example extract themes (not exclusive) |
|--------|------------------------------------------|
| **FlahaSOIL** | Soil chemistry/physics, methods, taxonomy context, lab interpretation literature |
| **FlahaCALC** | Irrigation, crop water, ETo/Kc literature, agrometeorology for water |
| **FlahaFAST** | Nutrient solution, fertigation, water quality for nutrition |
| **Markets** | Analyst narrative / market-context literature — **not** the price series DB |
| **None** | Valid for general agribusiness desk knowledge |

---

## 9. Relationship to what already exists

| Existing piece | Role under this scope |
|----------------|------------------------|
| **Phase 3 submit / jobs / artifacts** | L1 evidence path foundation |
| **Governance candidates** | May feed L2/L3; not auto Research “truth” |
| **Knowledge packs + review states** | L3 claim containers (product-oriented packs are a **subset**) |
| **4R-A.1 Research tab** | Early **L4** over APPROVED packs only — must **grow** to literature records + broader domains |
| **4I-B handoff** | Exit from approved extracts to product process |
| **Markets analytics** | Sibling eyes/muscles for **prices**; Research holds **literature about** markets when needed |
| **Sample seed packs** | Fixtures / demos — **not** the real library |
| **FKP** | Methodology authority outside INTEL ops library |

### 9.1 Honest gap (today vs this scope)

| Scope layer | Today |
|-------------|--------|
| L0 external library | Operator-owned; not fully wired |
| L1 artifacts | Exists for submit/ingest |
| L2 citable literature records (APA-grade) | **Not first-class** |
| L3 multi-domain extracts | Packs exist; content mostly samples + some market analyst packs |
| L4 full library index | **Partial** (packs only) |
| L5 collections + APA export | **Not built** (4R-B) |

---

## 10. Gate split (recommended program structure)

Do **not** implement this entire scope in one dump. Split:

| Gate | Name | Outcome |
|------|------|---------|
| **4R-A** | Topic index (started) | Facet finder; extend beyond packs over time |
| **4R-L** | Literature source records | L2: citable identity, DOI, keywords, trust, artifact link, multi-domain intake |
| **4R-X** | Extract depth at scale | L3 templates per domain family; human approve; optional product keys |
| **4R-B** | Research collections | L5: named dossiers + **APA 7th bibliography export** |
| **4R-E** | Evidence attach UX | One flow: source → extract → claim with citation |

Names **4R-L / 4R-X / 4R-E** are scope labels for planning; owner may rename at charter time.  
**4R-A** and **4R-B** remain the names already used in the product lock.

**Build order (recommended):**

1. Accept **this scope**.  
2. Charter **4R-L** (literature records + citation fields + intake from operator library / submit).  
3. Extend **4R-A** index to L2 + L3 (not packs-only).  
4. Scale **4R-X** extracts where PA needs claims.  
5. Charter **4R-B** when writing/export needs collections + APA lists.  
6. Handoff remains **4I-B** for product-bound extracts only.

---

## 11. User journeys (desk-scale)

### Journey A — Librarian / PA: register a source

1. Bring article/report (file or durable URL).  
2. System stores artifact; operator completes APA-grade metadata + keywords + domain + trust.  
3. Source is **catalogued** (findable as literature, not yet a claim).

### Journey B — Analyst: approve a claim

1. Open source; write extract (METHOD / THRESHOLD / NOTE / …).  
2. Link optional product lane / parameter.  
3. Human approve → appears in default Research claim browse.

### Journey C — Researcher: find what we hold

1. Filter domain + keyword + crop + place + year + trust.  
2. Open source record and/or approved extracts.  
3. Jump to artifact; copy APA citation.

### Journey D — Writer: collection for a paper or internal report

1. Create collection (4R-B).  
2. Add sources/extracts.  
3. Export reference list **APA 7th** (or journal profile).

### Journey E — Product improvement

1. Filter product lane + parameter.  
2. Review APPROVED extracts + evidence.  
3. Open comparison / 4I-B handoff / ticket — **never** silent engine change.

---

## 12. Boundaries (what Research is not)

| Not Research | Owner |
|--------------|--------|
| Public news website | Out |
| Unrestricted crawler | Forbidden without gate |
| Vector-only “semantic truth” without human claims | Future explicit gate only |
| FlahaSOIL/CALC/FAST application code | Sister products |
| Market price time-series database | Markets |
| Full enterprise document management for all of Flaha | Out of scope / FKP boundary |
| Auto-summarization as citable authority | Forbidden without gate |
| Numbered Vancouver desk default | Rejected (§6) |

---

## 13. Non-goals for this scope document

- No schema migration, API, or UI implementation in this file.  
- No commitment to bulk-import an entire operator drive in one gate.  
- No OCR / full-PDF AI classification as foundation.  
- No choice of a single “pilot paper” as architecture.  
- No merging CALC and FAST.  
- No reopening FKP freeze.

---

## 14. Acceptance criteria for **scope** (owner)

Scope is accepted when owner agrees:

- [x] Research is **multi-domain agribusiness / PA library + desk**, not one product or one parameter.  
- [x] Layers L0–L5 and **aboutness vs claim** are correct.  
- [x] **ASA/CSSA/SSSA · APA 7th author–year + DOI** is the desk citation default.  
- [x] Sister products are **optional links**, not the outer boundary.  
- [x] 4R-A.1 is acknowledged as **partial L4**, not the full Stage D.  
- [x] Gate split 4R-A / 4R-L / 4R-X / 4R-B / 4R-E is an acceptable planning map (names adjustable).  
- [x] FKP, Markets prices, and no-auto-product-write boundaries stand.  

**Owner accept:** 2026-08-01 · go ahead systemic 4R-L first.

---

## 15. Risks if scope is ignored

| Failure mode | Result |
|--------------|--------|
| Build only SOIL parameter modules | Desk unusable for CALC/FAST/agribusiness library |
| Treat keywords as approved science | False confidence in products and advice |
| Filename-only “references” | Cannot export, cite, or match Crossref/CAB/Agricola-quality work |
| Dump entire library without trust tiers | Noise; PA stops trusting Research |
| Skip L2 and only use sample packs | Research remains demo theater |
| Auto-write products from PDFs | Violates product lock and safety |

---

## 16. Related documents

| Doc | Role |
|-----|------|
| `docs/program/flahaintel-final-product-lock.md` | North star; Stage D |
| `docs/program/research-desk-frame.md` | Short pointer into Stage D |
| `docs/program/gates/gate-4r-a-research-topic-index.md` | 4R-A index charter + 4R-A.1 status |
| `docs/program/gates/gate-4s-b-structured-extract-template.md` | Extract shapes (soil/irrigation lineage) |
| `docs/program/gates/gate-4i-b-calc-fast-handoff.md` | Product exit envelope |
| `docs/program/flaha-system-vision-and-operate-lock.md` | INTEL-primary · FKP-frozen-thin |
| ASA/CSSA/SSSA Publications Handbook and Style Manual | External citation authority |
| APA 7th | Citation system adopted by those societies |

---

## 17. Owner decision

| Option | Meaning |
|--------|---------|
| **Accept scope** | Future 4R charters/code must fit this multi-domain + APA desk |
| **Amend** | Edit domains, gate names, or citation default explicitly |
| **Reject** | Do not expand beyond 4R-A packs index without a new scope |

**Recommendation:** **Accept** this scope, then charter **4R-L** (literature source records + APA-grade metadata) as the next design gate — still scope/design before large implementation.
