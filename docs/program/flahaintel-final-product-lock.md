<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: FlahaINTEL Final Product Lock
Introduction:
Locks the end-state product vision, system metaphor, and implementation direction
so engineering never drifts away from Precision Agriculture outcomes.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-08-19
-->

# FlahaINTEL — Final Product Lock

**Status: LOCKED (product north star)**  
**Owner:** Flaha Agri Tech · Precision Agriculture Division  
**Baseline platform:** Phase 1–3N complete (`v0.5.0-phase-3n-windows-production-like`)  
**Rule:** Every future gate must move toward this final product — or be rejected as drift.

This document is the answer to: *“Are we building the right FlahaINTEL, or only a desk?”*

---

## 0. Geographic principle (LOCKED)

**The farmer is one. Crops and vegetables are one. Soil is one. Fertilizers are one. Water is one. The Earth is one.**

What changes by place is only:

- borders and names  
- languages and markets  
- rules, regulations, taxes, and institutions  
- how prices and knowledge are published  

**Final product geography:** FlahaINTEL is **worldwide**. Wherever Flaha Agri Tech invests, benchmarks, partners, or can help the farmer — **we need to be able to be there** (Canada, MENA, Europe, anywhere the mission leads).

**Implementation order (not product limit):**

| Order | Role |
|-------|------|
| **Start** | **Qatar** and **Jordan** — first market-price and local-ops paths (prove the model) |
| **Next** | Any region Flaha prioritizes for investment or farmer impact |
| **Never** | Treat Qatar/Jordan (or any single country) as the ceiling of FlahaINTEL |

Every market or knowledge channel is onboarded the same way: **documented source → governance → evidence → human approval → structured use** — only the local rules and publishers change.

---

## 1. You are right — the simple picture

| Part | Meaning | Role |
|------|---------|------|
| **Backbone** | Trust, sources, evidence, audit, safe collection, human control | Hold the body upright |
| **Eyes** | Watch the outside world: markets, science, news, selected web, later video/social | See what matters |
| **Muscles** | Daily/regular collection jobs, extractors, structured stores, trend builders | Do the work repeatedly |
| **Brain** | Human + admin governance, rules, priorities, link knowledge into Flaha products | Steer and decide |

**Assessment:**  
- **Backbone = strong and healthy today** (this is a success, not a deviation).  
- **Eyes = partly open** (RSS + controlled web/docs; not yet markets/science packs/social/video).  
- **Muscles = early** (pipeline can fetch and process; not yet price series, threshold banks, product feeds).  
- **Brain = present for review** (approve/reject/admin); **not yet** full “steer the PA knowledge factory + sister products.”

Without eyes and muscles, a strong backbone feels like a **clerk**.  
Without backbone, eyes and muscles become a **reckless scraper**.  
**Final FlahaINTEL needs all four.** You are right.

---

## 2. Locked final product (one sentence)

**FlahaINTEL is Flaha’s private agri-intelligence system for the Precision Agriculture division: it watches trusted external sources anywhere Flaha serves farmers, collects and structures knowledge (markets, soil, irrigation, nutrition, digital agri), keeps a full evidence trail, keeps humans in charge, and feeds governed context into FlahaSOIL, FlahaCALC, FlahaFAST and farm advice — not a public news site, not unsupervised scraping, and not limited to one country.**

**System co-existence (owner locked):** FlahaINTEL is the **vault** (gather, collect, process, govern). The separate **Flaha Knowledge Platform** is the **door** — frozen-thin document authority + future MCP that serves PA apps with tailored approved knowledge. FlahaSOIL / FlahaCALC / FlahaFAST are **engines**. See `docs/program/flaha-system-vision-and-operate-lock.md` §1.4. Do not re-implement FKP or MCP inside FlahaINTEL; do not copy the vault into FKP.

---

## 3. Locked outcomes (what success looks like for Flaha)

### O1 — Stay current on the world that affects farmers and markets

- Official and institutional news (global + local)  
- **Market price lists** wherever Flaha needs them (start: Qatar central market / Mahaseel-type notes, Jordan daily central-market lists; later: any country of investment including Canada and beyond)  
- Weather, logistics, fertilizer context (from **approved** channels over time)  
- Enough history (e.g. **one year+** price series **per market**) for trend and advice  

### O2 — Build real PA knowledge context (not only FAO headlines)

- Irrigation, water saving, nutrition, soil, digital platforms — **universal agronomy**, tagged by place only where rules or climate differ  
- From **many resource types**: articles, reports, web explainers, equations/methods, cross-references  
- Packaged as **internal knowledge packs**, not random bookmarks  
- Comparable across regions so Flaha can benchmark and invest with one scientific backbone  

### O3 — Internal knowledge trail that improves Flaha products

- For irrigation: full package to support better formulas and water-saving advice **for the farmer, wherever they farm**  
- For **FlahaCALC / FlahaFAST / FlahaSOIL**: governed inputs and comparison artifacts  
- Example: soil literature thresholds → controlled artifact → compare deviation vs FlahaSOIL → improve product  
- Example: scientific writing support (e.g. soil moisture × tomato in a given country) via **indexed, governed** library — country is a **tag**, not a product wall

### O4 — Safer collection, source governance, audit

- Reliable sources only (documented, owned, reviewed)  
- Collection rules, limits, audit history  
- Never “scrape the whole internet” as the product identity  

### O5 — Human judgment and admin control stay in charge

- Person + admin govern architecture and decisions  
- Software organizes and executes; **people approve** what becomes company knowledge or product input  

---

## 4. Locked system architecture (metaphor → product layers)

```text
                         ┌─────────────────────────┐
                         │   BRAIN (control)       │
                         │  Human + Admin + Policy │
                         │  Priorities · Approve   │
                         │  Product handoff rules  │
                         └───────────▲─────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
     ┌────────┴────────┐    ┌────────┴────────┐    ┌────────┴────────┐
     │  EYES (see)     │    │ MUSCLES (act)   │    │ BACKBONE (trust)│
     │ Channels &      │───▶│ Jobs · Extract  │───▶│ Evidence · Audit│
     │ Sources         │    │ Structure·Trend │    │ Safe collect    │
     └─────────────────┘    └────────┬────────┘    └─────────────────┘
                                     │
                                     ▼
                         ┌─────────────────────────┐
                         │  PA KNOWLEDGE + FEEDS   │
                         │  Market · Soil · Irrig. │
                         │  → SOIL / CALC / FAST   │
                         │  → Advice & research    │
                         └─────────────────────────┘
```

### 4.1 Backbone (LOCKED — protect and extend, do not replace)

Already largely delivered (Phases 1–3N):

- Source registry and governance  
- Controlled acquisition (not open wild crawl)  
- Durable jobs, artifacts, provenance  
- Human review workflow  
- Production-like ops on Windows  

**Rule:** Future work **uses** this spine. It must not bypass human approval or drop evidence.

### 4.2 Eyes (LOCKED target channels)

| Eye | Purpose | Priority order |
|-----|---------|----------------|
| **E-Market** | Official market price pages/PDFs **worldwide** (onboard per country; **start Qatar + Jordan**) | **P1 product** |
| **E-Science** | Soil / irrigation / nutrition literature and reports (global science, local context tags) | **P1 product** |
| **E-News** | Institutional + agri news RSS (global + regional) | Live today — keep |
| **E-Web** | Allowlisted explainers for product R&D (e.g. soil analysis pages) | P2 |
| **E-Video** | YouTube webinars (transcript/notes under governance) | P3 later |
| **E-Social** | X/Twitter allowlisted accounts (logistics, weather, fert prices) | P3 later |

**Rule:** New eyes = **named sources + policy + place metadata**, not anonymous mass scrape.  
**Rule:** Adding Canada, Europe, or any new country is a **source-onboarding gate**, not a new product identity.

### 4.3 Muscles (LOCKED target capabilities)

| Muscle | What it does |
|--------|----------------|
| **M-Schedule** | Daily/weekly harvest for prices and priority sources **per market** |
| **M-Extract-Price** | Turn market lists into clean price rows (crop, date, **country/market**, unit, price, currency) |
| **M-Extract-Science** | Structured notes: thresholds, methods, crops, **region tags** (human-reviewed) |
| **M-Trend** | Year-scale history and simple trend views **per market**; compare markets when useful |
| **M-Pack** | Build “knowledge packs” (irrigation, soil, nutrition…) from approved items — universal themes, local overlays |
| **M-Handoff** | Export/link packs to FlahaSOIL / CALC / FAST under rules |

### 4.4 Brain (LOCKED control model)

| Brain function | Owner |
|----------------|--------|
| Which sources are allowed | Governance admin |
| What is approved company knowledge | Reviewer / analyst |
| What may enter FlahaSOIL/CALC/FAST | Explicit product policy + human |
| What is blocked / rejected | Same people + immutable history |
| Architecture changes | Program owner + gates only |

**Rule:** Automation may **propose** structure; **never silently become** product truth.

---

## 5. What is NOT the final product

These are **rejected as the destination** (even if someone builds a demo):

- Public farmer news website  
- Unrestricted web crawler  
- Auto-publish without human  
- AI that classifies/approves alone  
- FlahaINTEL **replacing** FlahaSOIL / CALC / FAST  
- Social/YouTube **before** market + soil packs (unless owner reorders — see plan)  
- “Clerk-only forever” with no domain muscles  

---

## 6. Current position vs final product (honest lock map)

| Final element | Status now | Label |
|---------------|------------|--------|
| Backbone | Strong | **BUILT** |
| Eyes — news RSS | Working | **BUILT** |
| Eyes — controlled web/docs | Working (limited) | **PARTIAL** |
| Eyes — multi-country market prices (start QA + JO) | Global model + QA channel seeded; JO pending; daily harvest muscle next | **IN PROGRESS** |
| Eyes — science depth packs | Pack schema + API (4S-A); content packs next | **IN PROGRESS** |
| Eyes — YouTube / social | Not built | **LATER** |
| Muscles — daily price harvest + trends | Not built | **PLANNED** |
| Muscles — soil threshold artifacts vs FlahaSOIL | Not built | **PLANNED** |
| Muscles — irrigation packs → CALC/FAST | Not built | **PLANNED** |
| Muscles — research index for papers | Weak search only | **PLANNED** |
| Brain — review UI & roles | Working | **BUILT** |
| Brain — product handoff policies | Not built | **PLANNED** |

**Assessment sentence:**  
We locked the **right final product**. We finished the **backbone program**. We have **not** finished the **eyes + muscles + product-brain** program. Feeling of “direction vs product” is valid — this lock removes that ambiguity.

---

## 7. Implementation plan aligned only to the lock

No gate may claim “FlahaINTEL complete” until the **Minimum Final Product (MFP)** below is met.  
Phases 1–3N remain **Platform Complete (backbone)**, not **Product Complete (full PA intelligence)**.

### Stage A — Platform Complete (DONE)

- Backbone + ops + human review  
- Tag: `v0.5.0-phase-3n-windows-production-like`  

### Stage B — Eyes & Muscles: Markets (NEXT product track)

**Goal:** Official prices → history → trends → advice support — **model works for any country**; **first implementations: Qatar, then Jordan**.

Suggested gates (names reserved):

| Gate | Outcome |
|------|---------|
| **4M-0** | Global market data model (country, market, crop, unit, currency, evidence) — not country-specific code walls |
| **4M-A** | Source onboarding: **Qatar** market price channel (documented, governed) — **first** |
| **4M-B** | Source onboarding: **Jordan** central market daily list — **second** |
| **4M-C** | Price extraction + storage using the global model |
| **4M-D** | Schedule + 1-year retention + trend view (per market) |
| **4M-E** | Analyst pack: market context for farm advice |
| **4M-N** | Repeat onboarding pattern for **any new country** (e.g. Canada or elsewhere) when Flaha invests or needs to help farmers there |

### Stage C — Eyes & Muscles: Soil & irrigation knowledge (PARALLEL or after B)

| Gate | Outcome |
|------|---------|
| **4S-A** | Curated soil/irrigation source set + document intake pack |
| **4S-B** | Structured extract template (thresholds, methods, crop, region) |
| **4S-C** | Controlled artifact: literature threshold bank (human approved) |
| **4S-D** | FlahaSOIL comparison workflow (deviation notes — not auto-change product) |
| **4I-A** | Irrigation / water-saving knowledge pack template |
| **4I-B** | Handoff rules toward FlahaCALC / FlahaFAST (export/link only) |

### Stage D — Research desk

| Gate | Outcome |
|------|---------|
| **4R-A** | Topic index (crop, country, theme, method) on approved content |
| **4R-B** | Research collection for scientific writing (e.g. Qatar tomato × moisture) |

### Stage E — Extended eyes (ONLY after B/C prove the model)

**Status: HOLD.** Scope: `docs/program/gates/gate-5e-extended-eyes-scope.md`.  
Do **not** code until unfreeze (operate proof + owner note). **v0.7 (4O) is in front of Stage E.**

| Gate | Outcome |
|------|---------|
| **5E-0** | Allowlist policy + intake class + rate limits (shared spine) |
| **5V** | YouTube webinar channel — **5V-A** registry · **5V-B** transcript/notes artifact · **5V-C** governance |
| **5X** | X/Twitter allowlisted accounts — **5X-A** registry · **5X-B** bounded collect · **5X-C** governance |
| **5E-N** | Later named network (same 5E-0 pattern) — not opened |

Charters: `gate-5e-0-extended-eyes-policy.md` · `gate-5v-youtube-webinar-channel.md` · `gate-5x-x-allowlist.md`

### Stage F — Brain completes product control

| Gate | Outcome |
|------|---------|
| **4B-A** | Admin policies: what may feed SOIL / CALC / FAST |
| **4B-B** | Dashboard: pack health, market freshness, review queue for PA |

---

## 8. Tracking rules (so product and plan stay the same)

1. **North star = this document.**  
   If a task does not map to Backbone / Eyes / Muscles / Brain → O1–O5, it is drift.

2. **Two completion labels (never confuse them):**  
   - **Platform complete** = Stage A (DONE)  
   - **Product complete** = Stages B–D minimum (markets + soil/irrigation packs + research index + handoff rules)

3. **Every gate proposal must answer:**  
   - Which final outcome (O1–O5)?  
   - Backbone / Eyes / Muscles / Brain?  
   - Which Flaha product benefits (SOIL / CALC / FAST / advice / research)?  
   - What evidence closes the gate?

4. **Backlog IDs** for tracking:

| ID prefix | Track |
|-----------|--------|
| `BB-*` | Backbone protect/ops |
| `EYE-MKT-*` | Market eyes |
| `EYE-SCI-*` | Science/soil/irrigation eyes |
| `MUS-MKT-*` | Market muscles |
| `MUS-SCI-*` | Science muscles |
| `MUS-HND-*` | Product handoff muscles |
| `BRN-*` | Brain / policy / admin |
| `LAT-VID-*` / `LAT-SOC-*` | Later video/social |

5. **Update cadence:** When a gate closes, update §6 status table and program backlog. Do not change §2–§3 (locked final product) without owner signature.

---

## 9. Recommendation (owner decision support)

### Assessment

| Question | Answer |
|----------|--------|
| Is the final product clear? | **Yes — locked above.** |
| Did backbone work waste time? | **No — required.** Without it, market/soil scrapes would be ungoverned and unusable for Flaha products. |
| Is there direction risk? | **There was**, while “Phase 3 complete” sounded like full product. **This lock ends that.** |
| Are you “only a clerk”? | **Platform is clerk-spine. Final product is PA intelligence factory.** Both stages are intentional. |
| What to build next? | **Global market model + first countries Qatar then Jordan + soil knowledge packs** — same farmer/soil/water science everywhere. |
| What to delay? | YouTube + Twitter until markets and soil packs work end-to-end. |
| What never to sacrifice? | Human control, source audit, evidence trail; **global mission** (no single-country product box). |

### Recommended immediate program order

```text
1) Keep backbone healthy (ops, backup, disk)              — BB-*
2) Global market data model, then Qatar, then Jordan    — EYE-MKT + MUS-MKT
3) Soil / irrigation knowledge packs (universal + place tags) — EYE-SCI + MUS-SCI
4) Handoff to FlahaSOIL / CALC / FAST                   — MUS-HND + BRN
5) Research index (crop × place as tags)                — Stage D
6) Any new country (Canada, etc.) via same onboarding   — 4M-N pattern
7) Video + social eyes                                  — Stage E
```

### Owner checkpoint

Approve this lock by treating §2–§5 as **final product constitution**.  
Next implementation work must open a gate under Stage B or C (or BB ops), not invent a parallel product.

---

## 10. One page for the team

**Final FlahaINTEL** = Eyes + Muscles + Brain on a strong Backbone, serving Precision Agriculture and Flaha sister products **anywhere Flaha helps the farmer**.

**One Earth:** farmer, soil, water, fertilizer, crops — universal. Borders change names and rules only.  

**Today** = Backbone strong; eyes half-open; muscles early; brain for review only.  

**Next** = Global market model; **start Qatar + Jordan**; soil/irrigation knowledge packs.  

**Whenever Flaha invests elsewhere** = same pattern, new country sources (Canada or any region).  

**Later** = Video, social, richer research tools.  

**Always** = Human and admin in charge; safe, documented sources; evidence kept.

---

*Locked 2026-07-30. Changes to final product require Flaha Agri Tech program owner update of this file.*
