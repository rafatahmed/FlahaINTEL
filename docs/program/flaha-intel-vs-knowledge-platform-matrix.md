<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: FlahaINTEL ↔ Flaha Knowledge Platform — Ownership Matrix and Orchestration
Introduction:
Disciplined non-duplication matrix, integration contracts, MCP role, performance
boundaries, and keep/fold recommendation for maximum Flaha Agri System purpose.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# FlahaINTEL ↔ Flaha Knowledge Platform — ownership matrix & orchestration

**Status:** **OWNER APPROVED / BINDING** (2026-07-31)  
**Operate lock:** `docs/program/flaha-system-vision-and-operate-lock.md`  
**Decision label:** `INTEL-primary · FKP-frozen-thin · MCP-on-named-consumer`  
**Repos:** FlahaINTEL (`FlahaINTEL`) · Knowledge Platform (`flaha-knowledge-platform`)  
**Audience:** product owner, agents, engineers on either repo  

---

## 0. Executive decision (read this first)

| Decision | Verdict |
|----------|---------|
| Keep both systems? | **YES — with hard boundaries** |
| Investment posture | **INTEL-primary** (70–80%) · **FKP-frozen-thin** (0–10%) |
| Is KP “like FlahaINTEL”? | **NO** |
| Is KP the MCP framework for Flaha? | **YES long-term** · **MCP frozen** until named consumer |
| Is KP worth continuing? | **YES thin** (corpus + CLI + later MCP). **NO** as peer product |
| Primary anti-goal | **No dual ownership of the same artifact type** |

**One sentence each (LOCKED)**

| System | Mission |
|--------|---------|
| **FlahaINTEL** | Private **operations intelligence**: watch external world, durable evidence, human review, **operational packs** and **product handoff** for PA outcomes. |
| **Flaha Knowledge Platform (FKP)** | Private **canonical document authority**: policies, standards, methodologies, registries, lifecycle/authority — **served to humans and machines via MCP**. |

They are **complementary**. INTEL *uses* authority; FKP *is* authority storage + retrieval. Neither replaces SOIL / CALC / FAST product engines.

---

## 1. Flaha Agri System — layered map (no twins)

```text
                         ┌──────────────────────────────────────┐
                         │     HUMAN BRAIN (owner / PA)         │
                         │  approve, reject, product tickets    │
                         └──────────────────┬───────────────────┘
                                            │
          ┌─────────────────────────────────┼─────────────────────────────────┐
          │                                 │                                 │
          ▼                                 ▼                                 ▼
 ┌─────────────────────┐      ┌──────────────────────────┐      ┌─────────────────────┐
 │   FlahaINTEL        │      │  Knowledge Platform      │      │ Product engines     │
 │   EYES + MUSCLES    │      │  DOCUMENT AUTHORITY      │      │ SOIL / CALC / FAST  │
 │                     │      │  + MCP FRAMEWORK         │      │ (algorithms, UX)    │
 │ · RSS / web / docs  │      │ · policy/standard/meth.  │      │                     │
 │ · markets harvest   │◄────►│ · inventory / registry   │◄────►│ · runtime calc      │
 │ · jobs + artifacts  │ cite │ · authority + lifecycle  │ cite │ · reports           │
 │ · knowledge PACKS   │  IDs │ · MCP tools/resources    │  IDs │ · farmer-facing     │
 │ · handoff envelopes │      │ · NO markets / NO packs  │      │                     │
 └─────────────────────┘      └──────────────────────────┘      └─────────────────────┘
          │                                 │                                 │
          └──────────────── write never ────┴─────── auto-apply never ────────┘
```

**Performance principle:** cold path (documents, authority) is **FKP**; hot path (daily harvest, jobs, UI ops) is **INTEL**. Do not put hot-path load on MCP.

---

## 2. Exclusive ownership matrix (HARD)

Legend: **O** = sole owner · **C** = consumer (read/cite only) · **X** = forbidden

### 2.1 Capability ownership

| Capability | INTEL | FKP | SOIL/CALC/FAST |
|------------|:-----:|:---:|:--------------:|
| External source watch (RSS, markets, allowlisted web) | **O** | X | X |
| Durable ingestion jobs / workers / ArtifactStore | **O** | X | X |
| Session auth, multi-tenant ops UI | **O** | X* | product-own |
| Market prices + analyst MARKET_CONTEXT packs | **O** | X | C (advice only) |
| Operational knowledge **packs** (THRESHOLD extract, DRAFT→APPROVED) | **O** | X | C (handoff only) |
| Comparison cases / tickets vs product observations | **O** | X | C |
| Product handoff export envelopes (4I-B style) | **O** | X | C |
| Canonical methodology / standard / policy documents | C | **O** | C |
| Document lifecycle (draft→review→approved→superseded) | X | **O** | X |
| Authority levels + confidentiality classification | X | **O** | X |
| Source **inventory** of product science files (where docs live) | X | **O** | C (origin) |
| Document registry + supersession graph | X | **O** | X |
| MCP server (tools/resources/prompts for AI clients) | X** | **O** | X |
| Search over **governed corpus** (methodologies) | C | **O** | C |
| Search over **ops evidence** (articles, artifacts, prices) | **O** | X | X |
| Algorithm / crop table / salt matrix code | X | X | **O** |
| Auto-apply literature into product engines | X | X | X (always human) |

\* FKP may later have its own admin for corpus; not INTEL product shell.  
\*\* INTEL agents may **call** FKP MCP as clients; INTEL does not host the Flaha MCP.

### 2.2 Artifact type ownership (anti-duplication core)

| Artifact | Store of record | May also appear as |
|----------|-----------------|--------------------|
| RSS article, market row, job, immutable blob | **INTEL** | Never in FKP |
| Knowledge pack + extract items (4S/4I/4M-E) | **INTEL** | Pack may **cite** FKP `docId` |
| Literature threshold bank (ops, human-approved numbers for packs) | **INTEL** | Bank entry should cite FKP standard when one exists |
| Comparison case / SOIL report import | **INTEL** | Cite FKP method doc for method identity |
| Methodology markdown (e.g. soil-physics-methodology) | **FKP** | Copy in product repo is **source inventory**, not second authority |
| Product engine code / defaults | **Product repo** | FKP inventories; INTEL never edits |
| Policy: “how Flaha governs knowledge” | **FKP** | INTEL AGENTS.md points to product lock; do not fork policy text |

**Rule R1 — Single store of record:** every durable fact has **one** owner system. Others only **reference by stable ID**.

**Rule R2 — No parallel packs:** FKP never grows “THRESHOLD packs” or market series. INTEL never grows a second methodology CMS.

**Rule R3 — Cite upward, operate sideways:** INTEL cites FKP documents; products cite both for tickets; nothing writes product code from either automatically.

---

## 3. Role of each system (max purpose)

### 3.1 FlahaINTEL — max purpose

| Purpose | How it wins for Flaha |
|---------|------------------------|
| **O1 Currency** | Markets, news, logistics context live and retained |
| **O2 Operational science** | Packs that PA can use this week for advice discussions |
| **O3 Product improvement loop** | Compare, ticket, handoff — not rewrite engines |
| **O4 Safe collection** | Hardened transport, jobs, audit of *operations* |
| **O5 Human control** | Analyst review states on packs and governance candidates |

**INTEL must stay:** ops system + evidence + packs + handoff.  
**INTEL must not become:** Flaha’s long-form methodology wiki or global MCP host.

### 3.2 FKP — max purpose

| Purpose | How it wins for Flaha |
|---------|------------------------|
| **Single science truth** | One approved methodology version for SOIL/CALC/FAST teams and AI |
| **Governance language** | Authority, confidentiality, supersession — same for all products |
| **MCP surface** | Any approved agent (Grok, Codex, IDE) queries **one** corpus API |
| **Inventory honesty** | Knows which product file is source vs copy vs historical |
| **No ops burden** | No daily harvest, no multi-tenant farmer ops |

**FKP must stay:** document authority + MCP.  
**FKP must not become:** second INTEL (ingest, markets, packs, PA web shell).

### 3.3 Product engines — max purpose

| Product | Owns |
|---------|------|
| FlahaSOIL | Soil physics/chemistry engines, reports, test levels |
| FlahaCALC | ETo, Kc, irrigation depth, water balance |
| FlahaFAST | Formulations, water quality, stoichiometry |

They **consume** INTEL handoffs and FKP standards; they **own** runtime truth.

---

## 4. Integration contract (how they talk without duplicating)

### 4.1 Stable identifiers

| System | ID | Example |
|--------|-----|---------|
| FKP document | `docId` (schema-stable) | `flahasoil.soil-physics-methodology@v3` |
| FKP inventory record | `inventoryId` / path hash | per inventory YAML |
| INTEL pack | `tenantId + pack.code` | `irrigation-calc-kc-etc-backbone-v1` |
| INTEL extract item | pack item id / sequence | UUID or sequence |
| INTEL bank entry | bank entry id | threshold bank row |
| Product | engine key | `kcMid`, `ecDsM`, `targetElementPpm` |

**Rule R4:** When an INTEL extract is derived from a governed standard, structured JSON **must** include:

```json
{
  "fkpDocId": "…",
  "fkpDocVersion": "…",
  "parameter": "kcMid",
  "doesNotAutoUpdateFlahaCALC": true,
  "doesNotAutoUpdateFlahaSOIL": true
}
```

If no FKP doc exists yet, `fkpDocId` is null and `confidence` stays `literature-note` / `product-default-note` — not `internal-approved`.

### 4.2 Allowed flows (only these)

| Flow | Direction | Mechanism | Frequency |
|------|-----------|-----------|-----------|
| **F1** PA / agent needs methodology | Client → FKP MCP | `resources/read`, `tools/search_docs` | Interactive |
| **F2** INTEL pack author cites standard | Human / agent → FKP then INTEL | Copy **ID only** into pack structured | On pack edit |
| **F3** Product change request | INTEL handoff + FKP doc IDs → ticket | Export envelope + links | On approval |
| **F4** Inventory refresh | Product repo → FKP inventory | CLI / CI inventory validate | On product doc change |
| **F5** INTEL never bulk-imports FKP body into packs | — | Forbidden as auto-sync | Always |

| Flow | Forbidden |
|------|-----------|
| FKP scrapes markets | Yes forbidden |
| INTEL hosts full methodology text as second wiki | Yes forbidden |
| Bidirectional auto-sync pack ↔ document | Yes forbidden |
| MCP writes INTEL DB or product DB | Yes forbidden (read-only MCP for v1) |

### 4.3 MCP surface (FKP owns) — target v1 (disciplined)

Expose **only** what machines need for authority; not INTEL ops.

| MCP capability | Purpose | Not for |
|----------------|---------|---------|
| `list_documents` / `get_document` | Fetch approved (or scoped) docs by id/domain/product | Market prices |
| `search_corpus` | Keyword/metadata over governed docs | ArtifactStore full-text |
| `get_registry` | Valid approved registry slice | Tenant secrets |
| `get_inventory` | Where product science sources live | Live engine state |
| `resolve_authority` | Authority + lifecycle of a docId | Approval of INTEL packs |

**INTEL-side MCP (optional later, separate):** job status, pack list — **only if** needed; default is web/API already exists. Prefer **one MCP host (FKP)** for knowledge; keep INTEL as REST product API for ops.

### 4.4 Auth boundary

| Concern | INTEL | FKP |
|---------|-------|-----|
| Tenant/user sessions | Yes | Later, separate |
| Corpus confidentiality (internal/restricted) | N/A for FKP docs | FKP must enforce on MCP |
| Loopback default | Yes (API) | Yes (MCP HTTP) |
| Internet exposure | Reverse proxy only | Reverse proxy + auth before public MCP |

---

## 5. Work routing matrix (where new work goes)

When someone proposes work, route with this table. **Do not start in both repos.**

| Incoming request | Goes to | Why |
|------------------|---------|-----|
| “Add Jordan market series” | **INTEL** | Ops / eyes |
| “Harvest MoCI daily” | **INTEL** | Schedule + retention |
| “Approve threshold pack for tomato EC” | **INTEL** | Operational pack |
| “Compare lab report vs FlahaSOIL” | **INTEL** | Comparison workflow |
| “Document Saxton–Rawls methodology as company standard” | **FKP** | Canonical methodology |
| “Authority level for soil-physics doc” | **FKP** | Lifecycle |
| “Inventory all FlahaSOIL science markdown” | **FKP** | Inventory |
| “MCP tool so Cursor can read soil standards” | **FKP** | MCP framework |
| “Kc mid for tomato in FAO table as pack note” | **INTEL** pack + cite FAO; promote to **FKP** only if it becomes Flaha **standard** |
| “Change FlahaCalc cropDatabase” | **FlahaCalc** product process; INTEL handoff + optional FKP method cite |
| “AI summarization of all news” | **Neither** (out of lock until approved phase) |
| “Second knowledge pack UI in FKP” | **Reject** | Duplication |

### 5.1 Promotion ladder (external literature → company truth)

```text
External literature / product default note
        │
        ▼
  INTEL pack extract (DRAFT)     ← operational, fast, human review
        │ APPROVED for PA use
        ▼
  Optional: elevate durable method/standard into FKP document
        │ FKP approved + registry
        ▼
  INTEL extracts update citation to fkpDocId (not re-copy body)
        │
        ▼
  Product ticket (human) uses FKP doc + INTEL handoff envelope
```

**Rule R5 — Promote, don’t fork:** when a pack extract becomes company methodology, **write the document in FKP** and leave INTEL pack as a thin, cited operational view — do not keep two full texts.

---

## 6. Duplication kill list (discipline)

| If you see this | Action |
|-----------------|--------|
| Same methodology prose in product repo + FKP + INTEL pack body | FKP = authority; product = working source inventoried; INTEL = short extract + `fkpDocId` |
| FKP “threshold bank” tables mirroring INTEL bank | Delete FKP bank idea; FKP stores **method standards**; numbers for ops stay INTEL |
| INTEL “document CMS” for long standards | Stop; put long form in FKP |
| FKP market or RSS collectors | Stop immediately |
| Two MCP servers both serving science docs | One: FKP only |
| Auto-apply from either system into product code | Forbidden forever without separate product process |
| Embeddings in both | Only after approved phase; pick **one** retrieval owner (prefer FKP for corpus, INTEL for ops evidence) |

---

## 7. Performance & architecture best practices

### 7.1 Hot path vs cold path

| Path | Latency budget | System | Storage |
|------|----------------|--------|---------|
| Market harvest, health, pack list API | Seconds | INTEL + Postgres | Hot |
| Analyst UI interactions | Sub-second list/filter | INTEL | Hot |
| Methodology read via MCP | 100ms–1s local | FKP | Cold (git/files → later index) |
| Full corpus reindex | Minutes, batch | FKP | Offline job |
| Product calculation | Product-owned | SOIL/CALC/FAST | N/A |

**Rule R6:** Never block INTEL harvest or API on FKP availability. Citations are soft dependencies; packs work with `fkpDocId: null`.

### 7.2 Architecture practices

1. **Separate deployables** — independent release trains; pin integration by **schema version** (`flaha-intel-product-handoff-v1`, FKP doc schema version).  
2. **Read-only MCP v1** — tools that mutate INTEL or products are out of scope until a Brain gate.  
3. **Idempotent validation** — FKP CLI in CI on `knowledge/`; INTEL tests on packs; no shared database.  
4. **No shared monorepo required** — integrate by **contract docs + IDs**, not code merge.  
5. **Observability** — INTEL: jobs/metrics/readiness; FKP: MCP request logs + validation CI. Do not unify metrics stores prematurely.  
6. **Security** — least privilege: MCP tokens scope to domain/product; INTEL sessions stay tenant-scoped.

### 7.3 Engineering practice (agents)

| Agent working in… | Allowed | Forbidden |
|-------------------|---------|-----------|
| INTEL | Packs, markets, jobs, handoff, UI | Re-home methodology wiki into `docs/` as second FKP |
| FKP | Schema, inventory, corpus, MCP | Markets, packs, ArtifactStore, product engine PRs “from knowledge” |
| Product repos | Engines, UX | Invent parallel threshold banks without INTEL |

---

## 8. Orchestration roadmap (phased, no thrash)

### Phase A — Boundary lock (now)

| Work | Owner | Done when |
|------|-------|-----------|
| This matrix accepted by product owner | Brain | Status APPROVED in this doc header |
| Product enum + registry: add `flahaintel` as consumer product | FKP | Schema + tests |
| INTEL pack structured optional `fkpDocId` | INTEL | Template + docs (no hard require yet) |
| Agent instructions cross-link | Both | AGENTS.md one paragraph each |

### Phase B — FKP becomes useful MCP (before heavy dual use)

| Work | Owner |
|------|-------|
| MCP tools: get/list/search approved docs | FKP |
| Auth for non-localhost | FKP |
| Complete SOIL science inventory + approved standards set | FKP |
| INTEL 4I-B handoff envelope includes optional FKP citations | INTEL |

### Phase C — Tight loop (after packs in real PA use)

| Work | Owner |
|------|-------|
| Promote mature pack notes → FKP standards (human) | PA + FKP |
| Research desk (4R) indexes INTEL approved content; FKP remains methodology | INTEL / FKP split |
| Optional: INTEL UI “open authority doc” deep link to FKP id | INTEL |

### Phase D — Do not do until A–C prove value

- Shared embeddings platform  
- Unified multi-tenant FKP+INTEL app shell  
- FKP writing tickets into GitHub for products automatically  
- Merging the two repositories  

---

## 9. Worth recommendation (hard)

### 9.1 Is FKP worth it?

**YES — keep and fund FKP** under these conditions:

1. It remains **document authority + MCP**, not a second intelligence product.  
2. First corpus ROI is **FlahaSOIL science** (already started) then **CALC/FAST methodology** — shared across teams and AI agents.  
3. INTEL keeps **all operational velocity** (markets, packs, harvest) without waiting on FKP.  
4. MCP v1 is delivered within a **bounded** phase (tools for read/search), not infinite schema polish only.

**Value case for Flaha Agri System**

| Without FKP | Risk |
|-------------|------|
| Methodology only in product repos + chat | Agents and PA re-litigate “which file is truth” |
| INTEL packs become the only science store | Packs bloat into unmaintainable wiki; no supersession graph |
| Each product invents authority levels | Inconsistent governance language |

| With FKP (disciplined) | Gain |
|------------------------|------|
| One MCP for AI + humans | Max leverage of governed science |
| Clear supersession | Old methods do not silently stay “truth” |
| INTEL stays fast | Ops not blocked by corpus process |

### 9.2 When FKP is **not** worth it (kill / fold criteria)

Fold FKP into something smaller (or archive) if **any** of these become true for 90 days:

| Kill signal | Meaning |
|-------------|---------|
| K1 | FKP work repeatedly duplicates INTEL packs or markets |
| K2 | No MCP client actually consumes FKP (zero agent/IDE usage) after MCP v1 ships |
| K3 | Corpus never leaves draft inventory; no APPROVED standards in registry |
| K4 | Team capacity cannot staff **both** INTEL product gates and FKP MCP — and INTEL O1–O3 are at risk |

**Fold options (prefer in order):**

1. **Keep FKP repo, freeze features** — validation CLI + git corpus only; MCP later.  
2. **Corpus-only mode** — drop unused engine package stubs until needed.  
3. **Archive FKP** — move approved markdown into a single `flaha-standards` git repo; INTEL cites git paths (worse for MCP, acceptable emergency).

### 9.3 Recommendation summary

| Option | Recommendation |
|--------|----------------|
| Merge FKP into INTEL | **No** — wrong coupling (hot ops + cold authority) |
| Kill FKP now | **No** — SOIL inventory + governance schema already have value; MCP intent is correct |
| Keep both with this matrix | **Yes — default** |
| Build MCP inside INTEL instead | **No** for science corpus; **optional thin** INTEL tools later for ops only |

---

## 10. Operating checklist (use every PR / agent task)

```text
[ ] Which system owns this artifact type? (matrix §2)
[ ] Am I creating a second store of record? (R1)
[ ] If science long-form → FKP; if ops extract/series → INTEL
[ ] Citations use stable IDs, not copy-paste of full methodology
[ ] No auto-apply into SOIL/CALC/FAST
[ ] INTEL still works if FKP is down
[ ] MCP changes only in FKP
[ ] Markets/jobs/packs only in INTEL
```

---

## 11. Cross-links

| Doc | Role |
|------|------|
| `docs/program/flahaintel-final-product-lock.md` | INTEL product lock |
| `docs/knowledge/knowledge-pack-schema.md` | INTEL packs |
| `docs/knowledge/flahasoil-recon-webapp-and-report.md` | SOIL keys (INTEL 4S) |
| `docs/knowledge/flahacalc-flahafast-recon.md` | CALC/FAST keys (INTEL 4I) |
| FKP `README.md` / `AGENTS.md` | FKP baseline |
| FKP `packages/knowledge-schema` | Authority enums |

---

## 12. Approval

| Role | Decision |
|------|----------|
| Product owner | Approve matrix as BINDING / request edits |
| INTEL agents | Follow §2 and §5 for all new work |
| FKP agents | Follow §2 and §4.3; refuse INTEL-scope tasks |

**End state:** Flaha Agri System has **one ops intelligence plane (INTEL)**, **one document authority + MCP plane (FKP)**, and **three product engines** — maximum purpose, zero twin products.
