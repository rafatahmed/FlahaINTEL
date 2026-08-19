<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Flaha Agri System — Vision and Operate Lock (INTEL-primary / FKP-frozen-thin)
Introduction:
Owner-approved dual-system vision, vault/door/engine frame, funding posture,
operate tasks, and freeze rules for FlahaINTEL and Flaha Knowledge Platform.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-08-19
-->

# Flaha Agri System — vision and operate lock

**Status:** **OWNER APPROVED / BINDING** (2026-07-31; vault/door/engine frame 2026-08-19)  
**Decision label:** `INTEL-primary · FKP-frozen-thin · MCP-on-named-consumer`  
**System metaphor (LOCKED):** **vault · door · engine** (§1.4)  
**Detail matrix:** `docs/program/flaha-intel-vs-knowledge-platform-matrix.md`  
**INTEL product lock (unchanged):** `docs/program/flahaintel-final-product-lock.md`  
**FKP lock (sister repo):** `flaha-knowledge-platform/docs/vision-and-operate-lock.md`  

This document **does not replace** the FlahaINTEL final product lock. It locks **how FlahaINTEL and FKP co-exist** so work is not duplicated and agri-business science value is maximized.

---

## 1. Locked vision (one page)

### 1.1 Flaha Agri System planes

```text
HUMAN BRAIN ── approve company truth and product changes
     │
     ├── FlahaINTEL (VAULT) ...... gather · collect · process · govern   [70–80%]
     ├── Knowledge Platform (DOOR)  authority + future MCP to PA apps    [0–10%]
     └── Product engines (ENGINE)  SOIL / CALC / FAST compute            [15–25%]
```

### 1.2 Mission statements (LOCKED)

| System | Metaphor | Mission |
|--------|----------|---------|
| **FlahaINTEL** | **Vault / bank** | Gather, collect, process, and **govern** operational intelligence: markets, RSS, documents, evidence, **packs**, handoff. Store of record for ops data. |
| **FKP** | **Door (MCP)** | Canonical **document authority** (policy / standard / methodology) and the **MCP serving plane** that later gives FlahaSOIL, FlahaCALC, FlahaFAST (and named consumers) **tailored, approved knowledge**. Not a second vault. |
| **SOIL / CALC / FAST** | **Engines** | Runtime science and farmer-facing compute. They consume; they are not the vault and not the MCP. Neither INTEL nor FKP auto-writes their engines. |

### 1.3 Strategic posture (LOCKED)

| Posture | Meaning |
|---------|---------|
| **INTEL-primary** | Default investment, demos, analyst daily use, agent implementation focus — **fill and govern the vault** |
| **FKP-frozen-thin** | Keep repo; no peer product; no packs/markets/jobs/UI shell; **door is schema+CLI today, MCP later** |
| **MCP later** | Unfreeze MCP only with a **named consumer** (PA app, IDE, or agent that will actually query weekly) |
| **Promote, don’t fork** | Mature pack extracts may become FKP standards; INTEL keeps thin cite + `fkpDocId` |
| **Serve, don’t copy** | FKP serves approved knowledge; it **does not store** INTEL prices, artifacts, jobs, or pack banks |

### 1.4 Vault / door / engine (LOCKED metaphor)

**One sentence:** FlahaINTEL is the governed vault. FKP is the MCP door that serves PA apps with tailored, approved knowledge. The apps compute. Nobody copies the vault into the door, and nobody lets the door write the engines.

```text
  WORLD (markets, papers, reports, RSS)
           │
           ▼
  ┌─────────────────────────────────────┐
  │  FlahaINTEL  =  VAULT / BANK        │
  │  gather → collect → process         │
  │  govern (human approve)             │
  │  evidence + operational packs       │
  │  hot path · Postgres · ArtifactStore│
  └─────────────────┬───────────────────┘
                    │
     IDs / approved extracts / 4I-B handoff
     (not a live dump of the vault)
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  FKP  =  DOOR  (authority + MCP)    │
  │  company methods / standards        │
  │  registry · inventory · lifecycle   │
  │  later: MCP tailored by product     │
  │  cold path · git corpus · read-only │
  └─────────────────┬───────────────────┘
                    │  read only
                    ▼
         FlahaSOIL · FlahaCALC · FlahaFAST
              (ENGINES — compute)
```

**Two repos, three layers, no mix.**

| Layer | Repo | Store of record | Talks to others by |
|-------|------|-----------------|--------------------|
| Vault | `FlahaINTEL` | Prices, artifacts, jobs, packs, review | Pack code, extract id, 4I-B envelope, optional `fkpDocId` |
| Door | `flaha-knowledge-platform` | Methodology / policy / standard + registry | `docId` / version; later MCP tools scoped by product |
| Engine | FlahaSOIL · FlahaCALC · FlahaFAST (separate products) | Algorithms, crop tables, farmer UX | Human tickets + read-only consume |

**Tailoring (why the door exists):** PA apps do not all want the same slice.

| Consumer | From the vault (INTEL) | Through the door (FKP) |
|----------|------------------------|-------------------------|
| **FlahaSOIL** | `SOIL` packs, comparison notes, threshold extracts | Soil methodology (physics, CEC, salinity…) |
| **FlahaCALC** | `IRRIGATION` packs, Kc/ETo notes | Irrigation / weather methods |
| **FlahaFAST** | `NUTRITION` packs, EC/pH notes | Nutrient methods |
| **Later named app** | Only what **4B feed policy** allows | Only docs in that product/domain/authority slice |

INTEL already tailors on the vault side (`ProductFeedPolicy` + 4I-B handoff, `autoApplyBlocked`). FKP later tailors on the door: MCP returns **that product’s** approved docs — never market rows, never jobs, never the whole corpus as one blob.

**Anti-mix rules (HARD)**

1. **FKP serves. It does not store the INTEL bank.** No packs, prices, ArtifactStore, or harvest in FKP.  
2. **INTEL collects and governs. It does not host Flaha-wide MCP** and does not become a methodology wiki.  
3. **Engines compute. Nothing auto-applies** literature or MCP results into SOIL / CALC / FAST.  
4. **Citations are IDs, not bodies.** Promote a method into FKP; INTEL keeps a short extract + `fkpDocId`.  
5. **INTEL must run if FKP is down.** `fkpDocId` is optional; harvest and packs must not wait on MCP.  
6. **No shared database, no git submodule, no monorepo merge.** Integrate by contract + stable IDs.  
7. **MCP v1 is read-only** and FKP-owned. MCP does not write INTEL Postgres or product engines.

**Development cycle under this metaphor**

| Now | Later (after unfreeze + named consumer) |
|-----|------------------------------------------|
| Fill and govern the **vault** (operate INTEL) | MCP door: `get` / `list` / limited search **per product** |
| FKP = git corpus + CLI validate (frozen-thin) | Analyst/app copies `docId`; INTEL may deep-link “open authority” |
| Handoff to engines is human + 4I-B JSON | Same handoff; MCP never replaces INTEL REST for hot ops |
| One agent session = one repo | Same: never one PR across vault and door |

---

## 2. What each system may / may not do (operate rules)

### 2.1 FlahaINTEL (vault) — DO

- Markets harvest, retention, trends, analyst packs (4M)  
- Soil/irrigation/nutrition **packs**, threshold bank, comparison, report bridge (4S / 4I)  
- Ingest jobs, artifacts, RSS, governance candidates  
- Handoff envelopes toward SOIL/CALC/FAST (human only)  
- Ops: Windows run, start scripts, backup, readiness  
- Optional later: `fkpDocId` on extracts when citing FKP  

### 2.2 FlahaINTEL (vault) — DO NOT

- Host Flaha-wide MCP for science corpus (that is the **door**)  
- Become long-form methodology CMS / second FKP  
- Auto-apply literature into product engines  
- Block on FKP availability  

### 2.3 FKP (door) — DO (thin allowlist)

- Maintain schema + CLI validation + registry/inventory integrity  
- Accept **promoted** standards when PA explicitly elevates a method  
- Inventory product science sources (SOIL first)  
- Keep HTTP health / localhost hygiene  
- Document freeze status in README / AGENTS  
- After unfreeze only: read-only MCP **tailored by product** for named consumers  

### 2.4 FKP (door) — DO NOT (freeze list)

- Markets, RSS, harvest, ArtifactStore, multi-tenant PA shell  
- Knowledge **packs** / threshold banks / comparison cases (those stay in the **vault**)  
- Copy INTEL ops data into this git corpus (“tailored dump” of the vault)  
- Full MCP tools/search/auth **until unfreeze criteria**  
- Expand stub engines (search/authority/citation/access/audit) without owner approval  
- Compete with INTEL for agent attention by default  
- Write INTEL Postgres, ArtifactStore, or SOIL/CALC/FAST engines  

---

## 3. Operate task board (binding priority)

### P0 — Always (INTEL)

| ID | Task | Owner system |
|----|------|--------------|
| OP-I1 | Keep API+web runnable (`start-flahaintel.ps1`) | INTEL |
| OP-I2 | Scheduled market harvest + retention path | INTEL |
| OP-I3 | Human review of packs / bank / cases as needed | INTEL + PA |
| OP-I4 | Never open unrestricted crawl / social until lock stages allow | INTEL |

### P1 — Next product value (INTEL-primary)

| ID | Task | Notes |
|----|------|-------|
| OP-I5 | **4I-B** handoff export envelope (CALC/FAST) | After packs used |
| OP-I6 | Use 4S/4I packs in real PA workflow | Evidence before more eyes |
| OP-I7 | Grow market series toward 365d | Ops continuity |
| OP-I8 | Product tickets from comparison notes | Human; engines separate |

### P2 — FKP frozen-thin only

| ID | Task | Notes |
|----|------|-------|
| OP-F1 | No new feature work unless owner names it | Default deny |
| OP-F2 | Keep `npm run verify` green on security/deps if touched | Maintenance |
| OP-F3 | Inventory / registry only when promoting a real standard | Thin |
| OP-F4 | Add product enum `flahaintel` when next FKP schema touch | Small |
| OP-F5 | MCP v1 **blocked** until unfreeze (§4) | |

### P3 — Explicitly deferred

| Item | Until |
|------|-------|
| YouTube / X eyes (Stage E: 5E-0 / 5V / 5X) | After **4O operate-harden** + B/C prove in operate (`gate-5e-extended-eyes-scope.md`) |
| FKP search/embeddings | After MCP unfreeze + consumer |
| Merge INTEL ↔ FKP repos | Never (architecture) |
| Unified app shell | Never in this phase |

---

## 4. FKP unfreeze criteria (MCP / expansion)

Unfreeze **only if two or more** hold:

1. ≥5 **approved** standards that PA/products actually cite  
2. Named AI/IDE client needs weekly corpus query  
3. Product teams conflict on method versions (cost of no authority is real)  
4. INTEL packs bloating into mini-wikis (promotion ladder broken)  

**Unfreeze process:** product owner written note in this file + FKP operate lock; then MCP read-only tools only.

---

## 5. Effort split (guidance)

```text
Rolling 6 months
  FlahaINTEL .............. 70–80%
  Product engines ......... 15–25%
  FKP .....................  0–10%  (frozen-thin)
```

Agents default to **INTEL** work unless the user explicitly tasks FKP thin work.

---

## 6. Kill / fold criteria (FKP)

If **90 days** after this lock with zero real science promotion **and** no consumer need: fold to corpus-only or `flaha-standards` git. Do **not** merge into INTEL.

---

## 7. Agent compliance checklist

```text
[ ] Is this gather/collect/process/govern (vault)? → INTEL repo
[ ] Is this long-form standard/methodology/MCP door? → FKP only if unfrozen or thin allowlist
[ ] Am I copying vault data into FKP or methods into INTEL wiki? → stop
[ ] Auto-apply to product engines? → never
[ ] Does the vault still work if the door is down? → must yes
[ ] One PR / one agent session spanning both repos? → split
```

---

## 8. Approval record

| Role | Action | Date |
|------|--------|------|
| Product owner (Rafat Al Khashan) | Approved INTEL-primary / FKP-frozen-thin | 2026-07-31 |
| Agents (both repos) | Must operate per this lock + matrix | 2026-07-31 |
| Product owner (Rafat Al Khashan) | Approved vault / door / engine frame (§1.4); FKP serves, does not copy the vault | 2026-08-19 |
