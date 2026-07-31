<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: FlahaINTEL Whole Intelligence Map
Introduction:
Explains every product surface (Sources, Content, Governance, Artifacts, Markets,
Knowledge, Submit, Jobs) as one intelligence system and lists integration gaps.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# FlahaINTEL — whole intelligence map

**Purpose:** One mental model for operators and agents: what each screen is for, how data flows, and what is still disconnected.

**Status:** P0/P1 foundation **implemented** (2026-07-31) — Dashboard intelligence map · **Review inbox** nav · purpose headers on Sources/Content/Jobs.

**Related:** final product lock · evidence intake spine · knowledge product matrix · historical markets import.

---

## 1. One intelligence system (metaphor → UI)

```text
                         BRAIN (control)
                    ┌─────────────────────┐
                    │ Governance          │  decide: approve / reject / hold
                    │ Settings / roles    │  policy & ops control
                    └──────────▲──────────┘
                               │ candidates / packs / prices review
         EYES                  │                 MUSCLES
    ┌────────────┐     ┌───────┴───────┐     ┌────────────────┐
    │ Sources    │     │ Content       │     │ Jobs           │
    │ (RSS eyes) │────▶│ (candidates)  │◀────│ (pipeline)     │
    │ Submit     │     │ Knowledge     │     │ Markets harvest│
    │ Markets    │     │ packs         │     │ promote        │
    └─────┬──────┘     └───────▲───────┘     └───────▲────────┘
          │                    │                     │
          └────────────┬───────┴─────────────────────┘
                       ▼
                 BACKBONE (trust)
              ┌────────────────────┐
              │ Artifacts          │  immutable evidence blobs
              │ Provenance / audit │
              └────────────────────┘
                       │
                       ▼  (human handoff only)
              FlahaSOIL · FlahaCALC · FlahaFAST · farm advice
```

| Metaphor | UI surfaces |
|----------|-------------|
| **Eyes** | Sources, Submit, Markets (see the world) |
| **Muscles** | Jobs, harvest, promote, pack rebuild |
| **Backbone** | Artifacts, durable jobs, fingerprints |
| **Brain** | Governance, pack/case/price review, Settings |
| **Knowledge + feeds** | Knowledge hub (SOIL / CALC / FAST / Markets packs) |

---

## 2. Purpose of each surface (operator dictionary)

### 2.1 Sources

| | |
|--|--|
| **Purpose** | Register and manage **recurring RSS eyes** (feeds Flaha watches on a schedule). |
| **Owns** | Feed URL, enable/disable, ownership/verification metadata, collection accounting. |
| **Does not own** | One-shot PDFs, market price series, knowledge pack thresholds. |
| **Outputs** | Articles → may flow into collection → later governance paths. |
| **Cadence** | Continuous / scheduled. |

**Whole-intel role:** *“What channels do we watch every day?”*

---

### 2.2 Submit (Evidence Intake Spine)

| | |
|--|--|
| **Purpose** | **Central human intake door**: land evidence once → classify → promote. |
| **Owns** | `EvidenceIntake` records, landed files, promote routing. |
| **Promote targets** | Eyes pipeline (website/doc), Mahaseel PDF, Amman Excel, FlahaSOIL report; CALC/FAST reports reserved. |
| **Does not own** | Long-term price series model, pack authoring UI, RSS registry. |
| **Outputs** | Linked jobs/submissions, price rows, comparison cases, or governance candidates. |

**Whole-intel role:** *“I have something in my hand — put it into FlahaINTEL safely.”*

---

### 2.3 Jobs

| | |
|--|--|
| **Purpose** | Monitor **durable pipeline work** (acquire, extract, normalize, workers). |
| **Owns** | Job state, leases, errors, retries. |
| **Does not own** | Meaning of content (that is Content/Governance/Knowledge). |
| **Outputs** | Stage progress; fills Artifacts and candidates when stages succeed. |

**Whole-intel role:** *“Is the machinery running this intake?”*

---

### 2.4 Artifacts

| | |
|--|--|
| **Purpose** | Browse **immutable evidence blobs** (raw download, extracted text, normalized forms). |
| **Owns** | Metadata + safe escaped preview (no free download of secrets paths). |
| **Does not own** | Review decisions or pack structure. |
| **Rule** | Backbone of trust: “show me the original evidence.” |

**Whole-intel role:** *“What exact bytes/text did we store as proof?”*

---

### 2.5 Content

| | |
|--|--|
| **Purpose** | Browse **normalized content / governance candidates** waiting for or after pipeline (article-like units). |
| **Owns** | List/search of candidates with bounded preview. |
| **Does not own** | Final approve authority (opens **Governance**), market price tables, pack bank. |
| **Outputs** | Navigation into Governance for a specific candidate. |

**Whole-intel role:** *“What structured content units are in the review queue?”*

---

### 2.6 Governance

| | |
|--|--|
| **Purpose** | **Brain for pipeline candidates**: assign, decide (approve/reject/hold/correct), promotion eligibility. |
| **Owns** | Decision history, eligibility — not product engine code. |
| **Does not own** | Market row review UI (that is Markets policies + batch review), Knowledge pack review (on Knowledge), soil cases (on Knowledge SOIL). |
| **Rule** | Worker success ≠ governance approval. |

**Whole-intel role:** *“Should this pipeline content become company-usable evidence?”*

---

### 2.7 Markets

| | |
|--|--|
| **Purpose** | **E-Market eye + series**: channels, harvest, historical import, prices, trends, retention, analyst packs. |
| **Owns** | `MarketChannel`, `MarketPriceObservation`, review policy, retention. |
| **Does not own** | General research PDFs, soil comparison cases, RSS. |
| **Outputs** | Price series + optional `MARKET_CONTEXT` packs (reviewed in Knowledge). |

**Whole-intel role:** *“What do official markets say over time?”*

---

### 2.8 Knowledge

| | |
|--|--|
| **Purpose** | **Structured PA knowledge packs** for three products + markets context. |
| **Lanes** | FlahaSOIL · FlahaCALC (irrigation/weather) · FlahaFAST (nutrients) · Markets packs. |
| **Owns** | Packs, threshold bank (soil), comparison cases (soil), human pack review. |
| **Does not own** | Live harvest, RSS registry, raw artifact browser. |

**Whole-intel role:** *“What governed notes inform SOIL / CALC / FAST / market advice?”*

---

### 2.9 Dashboard / Settings / Jobs (support)

| Surface | Role |
|---------|------|
| **Dashboard** | Counts and readiness glance |
| **Settings** | System health, operational config |
| **Jobs** | Pipeline execution (above) |

---

## 3. End-to-end flows (how pieces connect)

### A. Recurring news eye

```text
Sources (register RSS) → collection Jobs → Artifacts → Content candidates → Governance → (optional later) Knowledge packs
```

### B. Human document / URL

```text
Submit land → classify → promote
  · Eyes: ProductSubmission → Jobs → Artifacts → Content → Governance
  · Markets file: price rows (Markets hub)
  · Soil report: comparison cases (Knowledge SOIL)
```

### C. Official markets

```text
Markets harvest / historical import → price rows → trends / retention
  → optional analyst pack rebuild → Knowledge Markets lane (review)
```

### D. Science packs (manual / seed)

```text
Knowledge seed or create pack → human review on Knowledge
  → future handoff envelope to SOIL | CALC | FAST (separate targets)
```

---

## 4. Gap analysis (one whole intelligence)

### 4.1 Gaps: navigation & mental model

| Gap | Severity | Note |
|-----|----------|------|
| **G1** Nav feels like 10 apps | High | Sources/Content/Governance/Artifacts are backbone; Markets/Knowledge/Submit are product eyes — not labeled as one story on Dashboard |
| **G2** Dual review brains | High | Governance (candidates) vs Knowledge pack review vs Markets price review vs soil cases — four review UIs, no unified “inbox” |
| **G3** Submit vs Sources vs Markets | Medium | Partially fixed by intake spine; operator still may use old mental model “upload under Markets only” |

### 4.2 Gaps: data not linked

| Gap | Severity | Note |
|-----|----------|------|
| **G4** Market rows rarely linked to Artifacts | High | Historical import uses `file://` / intake ids; not always ArtifactStore + Content candidate |
| **G5** Knowledge packs rarely cite pipeline candidates | High | Packs often lack `governanceCandidateId` / artifact evidence links |
| **G6** Soil cases not linked to Submit intakes | Medium | SOIL import works on Knowledge; Submit promote creates cases but UI deep-link weak |
| **G7** Analyst MARKET_CONTEXT packs not auto-refreshed from harvest | Medium | Manual rebuild |
| **G8** CALC/FAST report promote reserved | Medium | Intake classes exist; promoters not built |

### 4.3 Gaps: coverage of final product outcomes

| Outcome | Status | Gap |
|---------|--------|-----|
| **O1 Markets** | Strong foundation | Historical backfill tools exist; 365d grows over time / imports |
| **O2 Science packs** | Foundation | Need real PA use + APPROVED packs; CALC vs FAST separation locked |
| **O3 Product handoff** | Partial | SOIL comparison path live; **4I-B** CALC-only and FAST-only envelopes not built |
| **O4 Safe collection** | Strong | Sources + Submit + jobs + artifacts |
| **O5 Human control** | Strong but fragmented | Multiple review surfaces (G2) |

### 4.4 Gaps: backbone completeness

| Gap | Severity | Note |
|-----|----------|------|
| **G9** Jobs not always visible for market CLI imports | Medium | CLI imports bypass ProductSubmission stages |
| **G10** Artifacts orphan previews | Known | Test/orphan links; UI clarified but cleanup optional |
| **G11** Dashboard does not show intake + pack + market health as one intelligence scorecard | High | Misses “whole intel” glance |

---

## 5. Target whole-intelligence picture (recommended)

```text
1) EYES enter only via:
   · Sources (recurring RSS)
   · Submit spine (everything human-handed)
   · Markets scheduled harvest (automated official prices)

2) BACKBONE always:
   · Artifacts for binary/text evidence where applicable
   · Jobs when pipeline stages run
   · EvidenceIntake row for every human land

3) STRUCTURE:
   · Content/Governance for general pipeline units
   · Markets tables for prices
   · Knowledge packs for SOIL | CALC | FAST | market context

4) BRAIN:
   · Unified “Review inbox” (future): candidates + packs + prices pending + soil cases
   · Today: use each surface with clear purpose above

5) FEEDS:
   · Separate handoff to FlahaSOIL, FlahaCALC, FlahaFAST (never one blob)
```

---

## 6. Prioritized gap closure (systemic order)

| Priority | Gap | Action |
|----------|-----|--------|
| **P0** | G1, G11 | **DONE** — Dashboard intelligence map + attention counters + nav groups |
| **P1** | G2 | **DONE foundation** — Review inbox (candidates · packs · prices · soil · intakes) |
| **P1** | G5 | **DONE** — pack items show evidenceArtifactId / governanceCandidateId chips |
| **P2** | G4, G9 | **DONE** — market promote seals ArtifactStore + evidenceArtifactId on price rows |
| **P2** | G6 | **DONE** — soil promote deepLink → Knowledge SOIL cases |
| **P2** | G7 | **DONE** — `markets:harvest --rebuild-analyst-packs` |
| **P3** | G8 | **DONE foundation** — CALC/FAST report promote → separate DRAFT packs (never merge) |
| **P3** | G10 | **DONE** — `npm run ops:artifact-hygiene` report-only |

---

## 7. One-page cheat sheet

| Screen | Question it answers |
|--------|---------------------|
| **Sources** | What do we watch repeatedly (RSS)? |
| **Submit** | What did a human just bring in, and where did it promote? |
| **Jobs** | Is processing running / stuck / failed? |
| **Artifacts** | What is the raw evidence? |
| **Content** | What normalized units are waiting for review? |
| **Governance** | Do we approve this pipeline unit as company evidence? |
| **Review inbox** | What needs a human decision across all queues? |
| **Markets** | What are official prices over time? |
| **Knowledge** | What structured notes inform SOIL / CALC / FAST / market advice? |
| **Dashboard** | Is the whole intelligence system healthy and busy? |
| **Settings** | Ops readiness and config |

---

## 8. Bottom line

FlahaINTEL is already **one intelligence system** in architecture (eyes → muscles → backbone → brain → product feeds).  

**Product UI growth** (Markets, Knowledge, Submit) is ahead of **integration glue** (unified review, evidence links, dashboard story).  

Closing gaps **P0–P1** makes the whole feel coherent without rewriting the backbone.
