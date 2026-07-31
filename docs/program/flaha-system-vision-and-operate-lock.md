<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Flaha Agri System — Vision and Operate Lock (INTEL-primary / FKP-frozen-thin)
Introduction:
Owner-approved dual-system vision, funding posture, operate tasks, and freeze
rules for FlahaINTEL and Flaha Knowledge Platform.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Flaha Agri System — vision and operate lock

**Status:** **OWNER APPROVED / BINDING** (2026-07-31)  
**Decision label:** `INTEL-primary · FKP-frozen-thin · MCP-on-named-consumer`  
**Detail matrix:** `docs/program/flaha-intel-vs-knowledge-platform-matrix.md`  
**INTEL product lock (unchanged):** `docs/program/flahaintel-final-product-lock.md`  

This document **does not replace** the FlahaINTEL final product lock. It locks **how FlahaINTEL and FKP co-exist** so work is not duplicated and agri-business science value is maximized.

---

## 1. Locked vision (one page)

### 1.1 Flaha Agri System planes

```text
HUMAN BRAIN ── approve company truth and product changes
     │
     ├── FlahaINTEL .............. PRIMARY (ops intelligence)     [70–80% effort]
     ├── Product engines ......... SOIL / CALC / FAST compute     [15–25% effort]
     └── Knowledge Platform ...... FROZEN-THIN authority + future MCP  [0–10% effort]
```

### 1.2 Mission statements (LOCKED)

| System | Mission |
|--------|---------|
| **FlahaINTEL** | Private PA **operations intelligence**: external eyes, durable evidence, human review, **operational knowledge packs**, product **handoff** — maximum near-term agri-business usefulness. |
| **FKP** | Private **document authority** (policy / standard / methodology) + **future MCP** for humans and AI — **not** a second intelligence product. |
| **SOIL / CALC / FAST** | Runtime science and farmer-facing compute. Neither INTEL nor FKP auto-writes their engines. |

### 1.3 Strategic posture (LOCKED)

| Posture | Meaning |
|---------|---------|
| **INTEL-primary** | Default investment, demos, analyst daily use, agent implementation focus |
| **FKP-frozen-thin** | Keep repo; no peer product build; no packs/markets/jobs/UI shell |
| **MCP later** | Unfreeze MCP only with a **named consumer** (e.g. IDE/agent weekly use) |
| **Promote, don’t fork** | Mature pack extracts may become FKP standards; INTEL keeps thin cite + `fkpDocId` |

---

## 2. What each system may / may not do (operate rules)

### 2.1 FlahaINTEL — DO

- Markets harvest, retention, trends, analyst packs (4M)  
- Soil/irrigation/nutrition **packs**, threshold bank, comparison, report bridge (4S / 4I)  
- Ingest jobs, artifacts, RSS, governance candidates  
- Handoff envelopes toward SOIL/CALC/FAST (human only)  
- Ops: Windows run, start scripts, backup, readiness  
- Optional later: `fkpDocId` on extracts when citing FKP  

### 2.2 FlahaINTEL — DO NOT

- Host Flaha-wide MCP for science corpus  
- Become long-form methodology CMS / second FKP  
- Auto-apply literature into product engines  
- Block on FKP availability  

### 2.3 FKP — DO (thin allowlist)

- Maintain schema + CLI validation + registry/inventory integrity  
- Accept **promoted** standards when PA explicitly elevates a method  
- Inventory product science sources (SOIL first)  
- Keep HTTP health / localhost hygiene  
- Document freeze status in README / AGENTS  

### 2.4 FKP — DO NOT (freeze list)

- Markets, RSS, harvest, ArtifactStore, multi-tenant PA shell  
- Knowledge **packs** / threshold banks / comparison cases  
- Full MCP tools/search/auth **until unfreeze criteria**  
- Expand stub engines (search/authority/citation/access/audit) without owner approval  
- Compete with INTEL for agent attention by default  

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
| YouTube / X eyes | INTEL B/C prove model (product lock) |
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
[ ] Is this INTEL ops/packs/markets/handoff? → INTEL repo
[ ] Is this long-form standard/methodology/MCP? → FKP only if unfrozen or thin allowlist
[ ] Am I duplicating store of record? → stop
[ ] Auto-apply to product engines? → never
[ ] Does INTEL still work if FKP is down? → must yes
```

---

## 8. Approval record

| Role | Action | Date |
|------|--------|------|
| Product owner (Rafat Al Khashan) | Approved INTEL-primary / FKP-frozen-thin | 2026-07-31 |
| Agents (both repos) | Must operate per this lock + matrix | 2026-07-31 |
