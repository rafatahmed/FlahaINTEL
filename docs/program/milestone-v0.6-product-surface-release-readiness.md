<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Milestone v0.6 Product Surface — Release Readiness
Introduction:
Systemic go/no-go for an intermediate product-surface release after Phase 3N
(backbone) and the post-3N eyes/muscles/brain package (markets, knowledge, research, RSS).

Created by: Rafat Al Khashan
Created date: 2026-08-01
Last modified: 2026-08-01
-->

# Milestone v0.6 — Product surface release readiness

## Decision summary

| Question | Answer |
|----------|--------|
| Is this a **big milestone**? | **Yes** — largest product-surface step since Phase 3N |
| Ready for **full product-complete** release? | **No** |
| Ready for **intermediate tagged release** (v0.6.x)? | **Yes — recommended** when owner accepts this note |
| Recommended tag | `v0.6.0-post-3n-product-surface` |
| Base platform tag | `v0.5.0-phase-3n-windows-production-like` |

---

## 1. What this milestone is

```text
v0.5.0  Phase 3N   = Backbone (trust, ingest, governance shell, Windows ops)
v0.6.0  (this)     = Eyes + Muscles + Brain product surface ON that backbone
                     markets · knowledge · research desk · handoff · RSS expand
```

Not a greenfield product. Not Stage D “full library filled.”  
It is a **governed product surface** that can be operated and filled.

---

## 2. Delivered scope (systemic package)

### Eyes

| Capability | Status |
|------------|--------|
| QA/JO market harvest (MoCI, Mahaseel, Amman) | Done |
| Historical market import paths | Done |
| Multi-year market analytics | Done |
| RSS baseline + agribusiness news batch | Done (new sources PENDING acceptance) |
| Price vs news separation (register) | Done / locked |

### Muscles

| Capability | Status |
|------------|--------|
| Knowledge packs + review states | Done |
| Soil threshold bank / comparison / report bridge | Done (foundation) |
| Product handoff 4I-B | Done |
| Feed policies 4B | Done |
| Research index 4R-A | Done |
| Literature L2 + Crossref | Done |
| Collections + APA export 4R-B | Done |
| Literature claims 4R-X | Done |

### Brain

| Capability | Status |
|------------|--------|
| Human review on packs / markets / literature | Done |
| No auto product engine write | Locked |
| APA / ASA–CSSA–SSSA citation default | Locked |
| Stage D research desk scope | Accepted |

### Backbone (unchanged contract)

TypeScript sole DB writer · ArtifactStore · workers JSONL · loopback API · Phase 3N ACCEPT.

---

## 3. Hardening already applied this package

- Research tab crash fix (lane ≠ product)  
- Mahaseel date/period expand; Amman bulk Excel  
- PA dashboard recursion fix  
- DOI unique per tenant; literature reindex on review  
- Crossref polite pool + cache + bulk  
- Extract template validation on literature claims  
- RSS agribusiness practical register (news ≠ prices)  
- Key unit tests green (literature, research, market analytics)

---

## 4. Release blockers vs non-blockers

### Blockers for **product-complete** (Stage B–D full)

| Item | Severity |
|------|----------|
| Host disk free space ≪ 15% (ops DEGRADED) | Host ops |
| Market channels not yet MEETS_TARGET 365d span | Operate |
| Knowledge content still largely sample / DRAFT | Operate |
| New RSS batch still **PENDING** (not full two-run ACCEPTED) | Process |
| Real multi-domain literature library not bulk-filled | Operate |
| Qatar weather / AMS / World Bank price tracks not integrated | Future gates |

### Non-blockers for **v0.6 intermediate tag**

| Item | Why OK for v0.6 |
|------|-----------------|
| Sample packs | Fixtures expected at surface ship |
| PENDING RSS | Enabled + collected; ACCEPTED is process follow-up |
| Disk DEGRADED | Documented residual; same as post-3N host reality |
| Empty research if few APPROVED packs | Correct empty-state behavior |

---

## 5. Recommendation

### A. Tag intermediate release **NOW** (recommended)

**Tag:** `v0.6.0-post-3n-product-surface`  
**Meaning:** Product surface is real and operable on the Phase 3N backbone.  
**Do:**

1. Owner accept this readiness note  
2. Fast-forward / merge branch → `main` (if that is your release line)  
3. `git tag -a v0.6.0-post-3n-product-surface -m "Post-3N product surface: markets, knowledge, research desk, RSS batch"`  
4. Push tag  
5. Operator checklist below on each host  

### B. Delay tag (if owner wants only “full green” ops)

Wait until:

- Disk ≥15% free sustained  
- At least one market channel MEETS_TARGET  
- New RSS two-run ACCEPTED for top 4 agri feeds  
- ≥N APPROVED real literature sources in collections  

That is a **v0.6.1 ops-harden** or **v0.7 operate** story, not a reason to deny intermediate surface ship.

---

## 6. Operator checklist after tag

```powershell
npm install
npm run prisma:generate
npm run prisma:status --workspace=@flaha-intel/api
# apply pending migrations if any
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

npm run bootstrap:local --workspace=@flaha-intel/api
npm run bootstrap:rss-accepted --workspace=@flaha-intel/api
npm run bootstrap:rss-agribusiness-batch --workspace=@flaha-intel/api
npm run markets:seed-channels --workspace=@flaha-intel/api
npm run knowledge:seed-samples --workspace=@flaha-intel/api
npm run knowledge:rebuild-research-index --workspace=@flaha-intel/api

# Collect new RSS (scheduler or manual)
# Approve packs / literature as content is real
# Markets harvest via scheduled task
```

---

## 7. What “harden enough” means for v0.6

| Layer | Hard enough? |
|-------|----------------|
| Architecture invariants | Yes |
| Markets path (QA/JO) | Yes for surface |
| Research desk spine L2–L5 | Yes for surface |
| Citation standard | Yes |
| News vs price separation | Yes |
| Host production ops | **No** — disk residual |
| Content completeness | **No** — operate phase |

**Verdict:** Harden **code/product surface** = enough for v0.6.  
Harden **host + content fill** = next operate milestone, not a soft silent continue forever.

---

## 8. Owner choices

| Choice | Action |
|--------|--------|
| **Release v0.6 now** | Accept this doc → merge/tag/push |
| **Release after ops green** | Keep building operate; tag later as v0.6.1 |
| **Keep as branch only** | No tag; continue feature work (not recommended — surface is already large) |

**Engineering recommendation:** **Release intermediate v0.6.0**, then operate hard (content, disk, RSS ACCEPTED, market span) as a **separate** milestone.
