<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: FlahaINTEL Program Frame, Audit, Plan, and Backlog
Introduction:
Systemic post-Phase-3N framing, maturity audit, forward plan, and task backlog
for governed local-first intelligence operations.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# FlahaINTEL — Program Frame, Audit, Plan & Backlog

**Baseline release:** `v0.5.0-phase-3n-windows-production-like` (`016ed47` on `main`)  
**Program state:** Platform (backbone) complete through 3N; **final product locked** — next work must follow the lock  
**Owner:** Flaha Agri Tech · Precision Agriculture Division  

**Final product constitution (LOCKED):**  
[`docs/program/flahaintel-final-product-lock.md`](flahaintel-final-product-lock.md)

This document is the **operating charter** after Phase 3N. It does not expand product
scope by itself. Implementation still requires a numbered gate, branch, and evidence.
Any gate that conflicts with the final product lock is **direction drift** and must stop.

---

## 0. Direction lock (read first)

| Label | Meaning |
|-------|---------|
| **Platform complete** | Backbone built (Phases 1–3N). Trust, evidence, human review, ops. |
| **Product complete** | Eyes + muscles + product brain for PA outcomes (markets, soil, irrigation packs, sister-product handoff). **Not done yet.** |

Metaphor (owner-aligned):

```text
Backbone = trust / audit / safe collect / human gate     → STRONG today
Eyes     = markets, science, news, web, later video/X    → PARTIAL today
Muscles  = daily jobs, extract, trends, knowledge packs  → EARLY today
Brain    = admin + human control + product handoff rules → REVIEW yes; HANDOFF no
```

Do not treat “Phase 3N ACCEPT” as “FlahaINTEL finished.” Treat it as **spine ready to grow eyes and muscles in the locked direction**.

---

## 1. Frame (what we are building)

### 1.1 Mission

Build and operate Flaha’s **private Precision Agriculture intelligence system**:
watch trusted external sources, structure knowledge for markets and agronomy,
keep a full evidence trail, keep humans in charge, and feed governed context into
**FlahaSOIL, FlahaCALC, FlahaFAST**, farm advice, and internal research — not a public news site.

### 1.2 Product definition

#### Final product (LOCKED) — see final-product-lock.md

Outcomes O1–O5: markets & world context · PA knowledge packs · product improvement trails · safe governed sources · human/admin control.  
Channels: news, official market lists (**worldwide**; implement **Qatar then Jordan** first), science docs/web, later video/social.  
Geography: one farmer/soil/water/earth; borders only change names and rules — see final-product-lock §0.  
Muscles: schedules, price extract, science extract, trends, packs, handoff to sister products.

#### Platform delivered (Phase 3N) — not the full final product

| Dimension | Definition |
|-----------|------------|
| **Name** | FlahaINTEL (platform layer) |
| **Form** | Single-host (Windows production-like proven) internal application |
| **Users** | Analysts / reviewers / governance admins (tenant-scoped roles) |
| **Inputs today** | Authoritative RSS; allowlisted websites; PDF/DOCX/RTF/TXT uploads |
| **Pipeline today** | Acquire → extract → normalize → governance candidate → human decision → **promotion eligibility** |
| **Evidence** | Immutable ArtifactStore + PostgreSQL jobs, provenance, decisions |
| **Platform non-goals** | Public SaaS, open crawl, auto-publish, AI auto-approve |

### 1.3 Architecture invariants (non-negotiable)

1. TypeScript API is the **sole database writer**.
2. Workers are **subprocess JSONL**, no TCP listeners, **no approval authority**.
3. Artifacts are **immutable** (promote / quarantine); corrections create versions.
4. **Worker success ≠ approved intelligence.**
5. RSS fingerprint / collection accounting remains **compatibility-frozen** until a dedicated parity gate.
6. Production API binds **loopback**; secrets never in git.
7. Scope expands only via **approved numbered gates** with evidence.

### 1.4 Value streams

```text
VS1  RSS intelligence feed     Registry → collect → dedupe → search UI
VS2  Document / website chain  Submit → durable jobs → artifacts → review
VS3  Governance control        Policy → decisions → eligibility (not publish)
VS4  Operate safely            Provision → workers → backup → runbooks
```

### 1.5 Stakeholders & roles

| Role | Responsibility |
|------|----------------|
| Product / program owner | Approve gates; set non-goals |
| Operator | Run provision, backup, residual, deploy |
| Analyst / reviewer | Submit, review, decide |
| Engineering agent | Implement only approved gate scope |

### 1.6 Explicit non-goals (still in force)

Unrestricted crawl · automatic publication · embeddings / semantic search · AI summarization or classification · OCR (3E-I deferred) · PPTX · cloud object store as primary · public self-service · multi-host HA · silent scope renumbering

---

## 2. Audit (where we are)

### 2.1 Gate maturity matrix

| Gate | Intent | Code | Docs | Runtime evidence | Status |
|------|--------|:----:|:----:|:----------------:|--------|
| RSS MVP | Collect / search | ✓ | ✓ | ✓ | **Closed** |
| 1.1 Hardening | Safe RSS transport | ✓ | ✓ | ✓ | **Closed** |
| 1.2 Registry | Authoritative sources | ✓ | ✓ | ✓ | **Closed** |
| 2 Foundation | Taxonomy / org types | ✓ | ✓ | ✓ seed | **Closed** |
| 3A–3E | Architecture + benchmarks | ✓ | ✓ | ✓ reports | **Closed** |
| 3F–3K | Providers → governance | ✓ | ✓ | ✓ tests | **Closed** |
| 3L | Product API + UI | ✓ | ✓ | ✓ tests | **Closed** |
| 3M | Production hardening | ✓ | ✓ | ✓ residual | **Closed** |
| **3N** | **Windows production-like** | ✓ | ✓ | ✓ **ACCEPT** | **Closed** |

### 2.2 Capability audit (product)

| Capability | Maturity | Notes |
|------------|----------|-------|
| RSS sources + collect + search | Production-capable | Registry-mapped bootstrap available |
| Hardened RSS transport | Production-capable | Defense-in-depth SSRF controls |
| Durable jobs / leases / cancel | Production-capable | PostgreSQL queue |
| Website acquisition (Scrapy/Playwright) | Production-capable | Policy-bound; residual passed |
| Document extraction routing | Production-capable | Arabic PDF unsupported by design |
| Normalization | Production-capable | Deterministic profiles |
| Governance review | Production-capable | Immutable decisions |
| Promotion eligibility | Partial | Requires source policy; residual documents block |
| Product web shell | Production-capable | Auth + nav surfaces |
| Production auth / CSRF | Production-capable | Residual PASS |
| Workers as OS processes | Production-capable | 5 families residual PASS |
| Backup / restore path | Proven on Windows | Residual PASS; schedule not automated |
| Windows production-like | **Accepted** | Tag `v0.5.0-…` |
| Linux systemd path | Documented only | Units present; not 3N evidence host |
| OCR | Out of scope | Deferred 3E-I |
| Intelligence auto-inference | Out of scope | Empty tables by design |
| AI / embeddings | Out of scope | Explicit non-goal |

### 2.3 Quality & ops audit

| Area | Assessment | Evidence / gap |
|------|------------|----------------|
| Automated tests | Strong unit/integration; heavy E2E often skipped without runtimes | API ~199 pass; packages green |
| CI | Build/test/validate on Ubuntu | No deploy secrets on PRs |
| Docs drift | Largely corrected at 3N | README/AGENTS updated |
| Secrets hygiene | Good | gitignore + residual no leakage |
| Disk capacity | **Risk** | C: hit 0 free during 3N; operator must monitor |
| Dependency pins | Mixed | Some `latest` in API package.json |
| Residual suite reliability | Fixed for Windows | Chromium probe, logs, PGPASSWORD |
| Source coverage | English / institutional heavy | MENA / Arabic gaps in registry |
| Host ops automation | Partial | Scripts yes; Task Scheduler not installed by gate |

### 2.4 Risk register (active)

| ID | Risk | Likelihood | Impact | Mitigation / residual |
|----|------|------------|--------|------------------------|
| R1 | Disk full breaks residual/backup | High on small C: | High | Monitor free space; move artifacts/backups off system volume |
| R2 | SSRF residual via DNS/infra | Medium | High | Keep pinning + host egress policy; never claim complete SSRF immunity |
| R3 | Promotion without source policy | Certain for ad-hoc URLs | Medium | Expected; create source policies for operational sources |
| R4 | Worker/runtime drift | Medium | High | Pin versions; re-run provision-verify + residual after changes |
| R5 | Scope creep into AI/OCR/publish | Medium | High | Gate approval only; stop conditions in AGENTS.md |
| R6 | `latest` dependency float | Medium | Medium | Pin Fastify stack in a dedicated hygiene gate |
| R7 | Restore needs superuser password | Medium | Medium | Document PGPASSWORD / migrator role; 3N fixed residual path |
| R8 | Unscheduled backup | High | High | P0 task: Task Scheduler + off-host path |
| R9 | Skipped heavy integration tests in CI | Medium | Medium | Optional nightly residual job; keep unit suite in PR CI |
| R10 | Registry/source ID coupling | Low | Medium | Bootstrap preserves registry UUIDs; no ad-hoc ID rewrites |

### 2.5 Audit scorecard (summary)

| Domain | Score (1–5) | Comment |
|--------|:-----------:|---------|
| Product completeness (v1 goals) | 5 | Pipeline + UI + governance delivered |
| Operational readiness (Windows) | 4 | Accepted; schedule + disk discipline remain |
| Security posture | 4 | Fail-closed prod auth; residual risks documented |
| Documentation truthfulness | 5 | Post-3N aligned |
| Test confidence | 4 | Strong with runtimes; CI lighter |
| Sustainability (pins, disk, ops) | 3 | Hygiene tasks recommended next |

**Overall:** FlahaINTEL **v1 program (Phases 1–3N) is complete and accepted**. Next work is **operate + harden + optional Phase 4+ product expansion** under new gates.

---

## 3. Plan (what we do next)

### 3.1 Planning principles

1. **Protect the baseline** — no destructive migrations; no silent non-goal breaks.
2. **One concern per gate/branch** — phase-number protection from 3A still applies.
3. **Evidence over claims** — residual, tests, or runbook dry-run before “done.”
4. **Operate before invent** — production discipline before AI/OCR features.
5. **Prioritize by risk × value** — disk/backup/policy before nice-to-have intelligence.

### 3.2 Horizon plan

```text
NOW (0–2 weeks)     Stabilize ops on accepted Windows baseline
NEXT (2–6 weeks)    Operator experience + source governance depth
LATER (approval)    Optional Phase 4+ product gates only if chartered
```

### 3.3 Recommended program tracks (aligned to final product lock)

| Track | Metaphor | Purpose | Default priority |
|-------|----------|---------|------------------|
| **T-BB / T-OPS** | Backbone | Backup, disk, residual cadence, keep spine healthy | **P0** |
| **T-SEC** | Backbone | Dependency pins, secret rotation, bind checklist | **P1** |
| **T-GOV** | Brain | Source policies; admin control depth | **P1** |
| **T-MKT** | Eyes + Muscles | Global market model; **start Qatar → Jordan**; any country next | **P1 product** |
| **T-SCI** | Eyes + Muscles | Soil/irrigation knowledge packs → FlahaSOIL/CALC/FAST path | **P1 product** |
| **T-RES** | Muscles | Research index for scientific writing | **P2** |
| **T-UX** | Brain UX | Analyst polish, smoke pack | **P2** |
| **T-VID / T-SOC** | Eyes later | YouTube / X allowlists | **P3 Hold** until MKT+SCI prove model |
| **T-FUT** | — | OCR / AI assist / publish / multi-host | Hold without charter |

### 3.4 Proposed next gates (names reserved; require approval)

Do **not** implement until approved. Must map to final-product-lock stages.

| Proposed gate | Metaphor | Scope | Entry |
|---------------|----------|--------|-------|
| **3O** | Backbone | Task Scheduler backup, residual cadence, free-space alerts | 3N ACCEPT |
| **3P** | Backbone | Pin dependencies | 3N ACCEPT |
| **3Q** | Brain | Source policies for accepted RSS | 3K/3N |
| **4M-0…E + 4M-N** | Eyes+Muscles | Market prices: global model; start QA+JO; any country via 4M-N | Product owner |
| **4S-A…D** | Eyes+Muscles | Soil knowledge + FlahaSOIL comparison path | Product owner |
| **4I-A…B** | Muscles | Irrigation packs + CALC/FAST handoff rules | After/with 4S |
| **4R-A…B** | Muscles | Research index | After packs start |
| **5V / 5X** | Eyes | YouTube / X | After 4M+4S value proven |
| **4B-A…B** | Brain | Product handoff policies + PA dashboard | With 4M/4S |

Detail and status table: `flahaintel-final-product-lock.md` §6–§7.

---

## 4. Tasks (work breakdown)

### 4.1 Task status legend

| Status | Meaning |
|--------|---------|
| `DONE` | Accepted / shipped |
| `READY` | Can start without further design |
| `BLOCKED` | Needs decision or resource |
| `BACKLOG` | Defined; not started |

### 4.2 Definition of Done (global)

A task is done only when:

1. Scope matches the approved gate (or is pure ops/docs under this charter).
2. No secrets committed; ignore rules respected.
3. Tests or residual/smoke evidence recorded when behavior changes.
4. Docs updated if operator-facing behavior changes.
5. Stop conditions honored (no non-goal expansion).

### 4.3 Epic → task backlog

#### Epic E0 — Baseline closed (DONE)

| ID | Task | Priority | Status | Owner hint | DoD |
|----|------|----------|--------|------------|-----|
| E0-T1 | Phase 3N residual ACCEPT | P0 | **DONE** | Ops | Evidence doc |
| E0-T2 | Bootstrap seed/tenant/RSS | P0 | **DONE** | Ops | Commands succeed |
| E0-T3 | README/AGENTS truth | P0 | **DONE** | Docs | Matches product |
| E0-T4 | Tag `v0.5.0-…` + main | P0 | **DONE** | Git | Remote tag/release |

#### Epic E1 — Operate the accepted host (P0)

| ID | Task | Priority | Status | Depends | DoD |
|----|------|----------|--------|---------|-----|
| E1-T1 | Move ArtifactStore + backups off full system volume (config + runbook) | P0 | **DONE** (runbook) / host move pending | — | Paths documented; free space ≥ 15% on host still **LOW** |
| E1-T2 | Install Windows Task Scheduler job for `backup.ps1` + off-host copy | P0 | **DONE** (scripts) / register pending on host | E1-T1 | `register-backup-task.ps1` shipped |
| E1-T3 | Document weekly `ops:provision-verify` + monthly residual cadence | P0 | **DONE** | — | `ops-cadence.md` |
| E1-T4 | Free-space alert rule + operator response | P0 | **DONE** | E1-T1 | `check-free-space.ps1` + alert-rules |
| E1-T5 | Smoke pack: start API/web, login, list sources, submit fixture TXT | P1 | READY | Bootstrap | Smoke script or checklist |

#### Epic E2 — Security & supply chain (P1)

| ID | Task | Priority | Status | Depends | DoD |
|----|------|----------|--------|---------|-----|
| E2-T1 | Pin Fastify / @fastify/* / rss-parser versions (no `latest`) | P1 | **DONE** | — | package.json pinned |
| E2-T2 | Session secret rotation drill (runbook dry-run) | P1 | READY | — | Runbook steps verified |
| E2-T3 | Confirm production bind loopback + Caddy-only exposure checklist | P1 | READY | — | Checklist in ops |
| E2-T4 | Review residual threat-model items still open | P1 | BACKLOG | — | Annotated threat-model section |

#### Epic E3 — Governance operationalization (P1)

| ID | Task | Priority | Status | Depends | DoD |
|----|------|----------|--------|---------|-----|
| E3-T1 | Create source governance policies for 7 ACCEPTED RSS sources | P1 | **DONE** | Bootstrap | `bootstrap:source-policies` (7 policies created on local host) |
| E3-T2 | Operator guide: when promotion is blocked vs ready | P1 | READY | E3-T1 | Docs page |
| E3-T3 | Residual enhancement: optional policy seed for acceptance hosts | P2 | BACKLOG | E3-T1 | Residual still ACCEPT |
| E3-T4 | Reviewer assignment workflow dry-run in UI | P2 | READY | Bootstrap user | Screenshot or checklist |

#### Epic E4 — Product polish (P2)

| ID | Task | Priority | Status | Depends | DoD |
|----|------|----------|--------|---------|-----|
| E4-T1 | Dashboard readiness clarity when workers NOT_CONFIGURED | P2 | BACKLOG | — | UX copy + test |
| E4-T2 | Document upload size/error messages vs production limits | P2 | BACKLOG | — | Matches config |
| E4-T3 | Settings page: show bootstrap tenant/user guidance in dev only | P2 | BACKLOG | — | No secret leakage |
| E4-T4 | Brand/screenshot refresh for post-3L shell | P2 | BACKLOG | — | Brand docs |

#### Epic E5 — Data / coverage (P2)

| ID | Task | Priority | Status | Depends | DoD |
|----|------|----------|--------|---------|-----|
| E5-T1 | Revisit NASA Earth Observatory destination false positive | P2 | BACKLOG | Safety review | Registry update only if safe |
| E5-T2 | Identify 1–2 MENA/Arabic authoritative RSS candidates | P2 | BACKLOG | 1.2 method | Preflight only first |
| E5-T3 | Collect enabled sources once; verify zero-dupe second run | P2 | READY | Bootstrap RSS | Counts recorded |

#### Epic E6 — Future product (HOLD — approval required)

| ID | Task | Priority | Status | Gate proposal |
|----|------|----------|--------|---------------|
| E6-T1 | Charter OCR path (3E-I / 4B) | Hold | BLOCKED | Product owner |
| E6-T2 | Charter AI-assisted review (no auto-approve) | Hold | BLOCKED | Product owner + threat model |
| E6-T3 | Charter publish/export channel | Hold | BLOCKED | Product owner |
| E6-T4 | Charter multi-host / HA | Hold | BLOCKED | Ops owner |

### 4.4 Suggested first sprint (2 weeks)

**Goal:** Backbone stays healthy **and** final-product direction is visible in the backlog (no drift).

1. **E1-T1…T4** Ops: disk, scheduled backup, cadence, free-space alert (`BB-*`)  
2. **E3-T1** Source policies for accepted RSS (`BRN-*`)  
3. **E2-T1** Pin npm deps (`BB-*`)  
4. **Charter only (no code until approved):** **4M-0** global market model + **4M-A** Qatar first  
5. **Charter only:** **4M-B** Jordan second; **4S-A** soil/irrigation pack (universal + place tags)  

**Exit criteria:** Ops P0 green; residual still ACCEPT; **4M-0 / 4M-A / 4S-A written and owner-approved** before implementation starts.

### 4.4b Product track backlog seeds (LOCKED direction)

| ID | Task | Track | Status |
|----|------|-------|--------|
| EYE-MKT-00 | Global market model (country/market/crop/unit/currency/evidence) — any country | T-MKT | READY (charter) |
| EYE-MKT-01 | Document **Qatar** market price source(s) + ownership (**first**) | T-MKT | READY (charter) |
| EYE-MKT-02 | Document **Jordan** central market daily list + ownership (**second**) | T-MKT | READY (charter) |
| EYE-MKT-N | Template to onboard **any new country** when Flaha invests or helps farmers there | T-MKT | BACKLOG |
| MUS-MKT-01 | Price row schema (date, country, market, crop, unit, price, currency, evidence) | T-MKT | BACKLOG |
| MUS-MKT-02 | Daily harvest job + 365d retention **per market** | T-MKT | BACKLOG |
| MUS-MKT-03 | Trend view for analysts (filter by country/market) | T-MKT | BACKLOG |
| EYE-SCI-01 | Curated soil/irrigation source list (governed; global science + place tags) | T-SCI | READY (charter) |
| MUS-SCI-01 | Threshold/method extract template + human review | T-SCI | BACKLOG |
| MUS-SCI-02 | FlahaSOIL comparison artifact workflow (no auto-change of SOIL) | T-SCI | BACKLOG |
| MUS-HND-01 | Handoff rules SOIL/CALC/FAST | T-SCI | BACKLOG |
| LAT-VID-01 | YouTube channel policy (later) | T-VID | HOLD |
| LAT-SOC-01 | X/Twitter allowlist policy (later) | T-SOC | HOLD |

### 4.5 Branch & evidence workflow (best practice)

```text
1. Approve gate scope in writing (this charter + short gate note)
2. Branch: phase-<id>-<short-scope> from main
3. Implement one concern; keep commits reviewable
4. Evidence: tests and/or residual/smoke + short evidence section
5. Update AGENTS.md verified status only when gate closes
6. Merge to main; tag if release-worthy
7. Never commit .env, runtimes, artifacts, residual JSON reports
```

### 4.6 Stop conditions (agents and humans)

Stop and escalate if asked to:

- Expand into AI, OCR, publish, unrestricted crawl without a new gate  
- Reset/destroy production or acceptance databases without explicit approval  
- Commit secrets or disable security controls “temporarily”  
- Renumber/repurpose historical phase IDs  

---

## 5. Metrics (how we know the system is healthy)

| Metric | Target | How to check |
|--------|--------|--------------|
| Residual verdict | ACCEPT on demand | `npm run ops:residual-acceptance` |
| Provision probes | allReady=true | `npm run ops:provision-verify` |
| Free disk (artifact volume) | ≥ 15% free | Host monitoring / readiness |
| Backup age | ≤ 24 h (RPO) | `last-backup.json` |
| Migrations | All applied | `prisma migrate status` |
| Taxonomy seed | 186 + 20 | Seed command / counts |
| API unit tests | Green | `npm test` |
| Open P0 tasks | 0 for >7 days | This backlog |

---

## 6. Document map

| Document | Role |
|----------|------|
| This file | Program frame, audit, plan, backlog |
| `AGENTS.md` | Agent rules + verified gates |
| `README.md` | Operator setup |
| `docs/ingestion/phase-3n-evidence.md` | 3N acceptance evidence |
| `docs/ingestion/phase-3a-…md` §31 | Historical Phase 3 gate sequence |
| `ops/runbooks/` | Incident / deploy / backup procedures |
| ADRs `docs/ingestion/decisions/` | Architecture decisions |

---

## 7. Decision log (program)

| Date | Decision | Outcome |
|------|----------|---------|
| 2026-07-30 | Close Phase 3N on Windows residual ACCEPT | Tag `v0.5.0-phase-3n-windows-production-like` |
| 2026-07-30 | Post-3N priority = operate before new product features | This charter |
| Pending | Approve 3O/3P/3Q or hold | Product owner |

---

## 8. One-page summary

**Frame:** Final FlahaINTEL = Backbone + Eyes + Muscles + Brain serving PA and FlahaSOIL/CALC/FAST (see final-product-lock).  

**Audit:** Backbone **BUILT**; eyes/muscles for markets & soil **PLANNED**; platform 1–3N closed.  

**Plan:** Keep spine healthy (P0) → Global market model + **Qatar then Jordan** + Soil packs (P1) → any country via same pattern → Research index → Video/social later.  

**Tasks:** E1 ops + BRN policies + charter 4M-A / 4S-A; HOLD YouTube/Twitter until packs prove value.  

**Direction rule:** If it does not serve the locked final product, do not build it.

---

*End of program charter. Update this file when a new gate is approved or a P0/P1 task closes. Do not edit final-product-lock outcomes without owner approval.*
