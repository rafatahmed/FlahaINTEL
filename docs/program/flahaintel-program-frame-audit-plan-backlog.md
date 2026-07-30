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
**Program state:** Phase 1–3N closed; next work requires **explicit gate approval**  
**Owner:** Flaha Agri Tech · Precision Agriculture Division  

This document is the **operating charter** after Phase 3N. It does not expand product
scope by itself. Implementation still requires a numbered gate, branch, and evidence.

---

## 1. Frame (what we are building)

### 1.1 Mission

Build and operate a **local-first, governed OSINT and news intelligence workstation**
for agricultural and institutional context — trustworthy evidence in, human decisions
on the record, controlled collection only.

### 1.2 Product definition (v1 after Phase 3N)

| Dimension | Definition |
|-----------|------------|
| **Name** | FlahaINTEL |
| **Form** | Single-host (Windows production-like proven) internal application |
| **Users** | Analysts / reviewers / governance admins (tenant-scoped roles) |
| **Inputs** | Authoritative RSS; allowlisted websites; PDF/DOCX/RTF/TXT uploads |
| **Pipeline** | Acquire → extract → normalize → governance candidate → human decision → **promotion eligibility** |
| **Evidence** | Immutable ArtifactStore + PostgreSQL jobs, provenance, decisions |
| **Not** | Public SaaS, open crawl, auto-publish, AI classification, OCR, embeddings |

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

### 3.3 Recommended program tracks

| Track | Purpose | Default priority |
|-------|---------|------------------|
| **T-OPS** | Backup schedule, disk, residual cadence, Windows services | **P0** |
| **T-SEC** | Dependency pins, secret rotation drill, egress notes | **P1** |
| **T-GOV** | Source policies for operational RSS/web; eligibility path | **P1** |
| **T-PROD** | Analyst UX polish, smoke pack, readiness polish | **P2** |
| **T-DATA** | Registry coverage (MENA/Arabic feeds) without transport regressions | **P2** |
| **T-FUT** | OCR / AI assist / publish / multi-host — **not started** without charter | Hold |

### 3.4 Proposed next gates (names reserved; require approval)

Do **not** implement until approved. Suggested numbering after 3N:

| Proposed gate | Scope | Entry criteria |
|---------------|--------|----------------|
| **3O** Ops automation | Task Scheduler backup, residual nightly, free-space alerts | 3N ACCEPT |
| **3P** Dependency & supply-chain hygiene | Pin Fastify/rss-parser/etc.; SBOM note | 3N ACCEPT |
| **3Q** Source governance operationalization | Policies for accepted RSS + residual sources; eligibility green path | 3K/3N |
| **4A** Intelligence workflow (manual-first) | Governed assignment of taxonomy to approved content only | Explicit product approval |
| **4B** OCR (former 3E-I) | Offline OCR benchmark + optional path | Explicit approval |
| **4C** AI-assisted review (no auto-approve) | Draft notes for analysts | Explicit approval + threat model delta |

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
| E1-T1 | Move ArtifactStore + backups off full system volume (config + runbook) | P0 | READY | — | Paths documented; free space ≥ 15% |
| E1-T2 | Install Windows Task Scheduler job for `backup.ps1` + off-host copy | P0 | READY | E1-T1 | Dry-run log + last-backup.json |
| E1-T3 | Document weekly `ops:provision-verify` + monthly residual cadence | P0 | READY | — | Runbook section |
| E1-T4 | Free-space alert rule + operator response | P0 | READY | E1-T1 | Alert rule entry + runbook |
| E1-T5 | Smoke pack: start API/web, login, list sources, submit fixture TXT | P1 | READY | Bootstrap | Smoke script or checklist |

#### Epic E2 — Security & supply chain (P1)

| ID | Task | Priority | Status | Depends | DoD |
|----|------|----------|--------|---------|-----|
| E2-T1 | Pin Fastify / @fastify/* / rss-parser versions (no `latest`) | P1 | READY | — | Lockfile + CI green |
| E2-T2 | Session secret rotation drill (runbook dry-run) | P1 | READY | — | Runbook steps verified |
| E2-T3 | Confirm production bind loopback + Caddy-only exposure checklist | P1 | READY | — | Checklist in ops |
| E2-T4 | Review residual threat-model items still open | P1 | BACKLOG | — | Annotated threat-model section |

#### Epic E3 — Governance operationalization (P1)

| ID | Task | Priority | Status | Depends | DoD |
|----|------|----------|--------|---------|-----|
| E3-T1 | Create source governance policies for 7 ACCEPTED RSS sources | P1 | READY | Bootstrap | Eligibility path not blocked for RSS-linked candidates |
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

**Goal:** Host is boringly operable.

1. **E1-T1** Artifact/backup volume placement  
2. **E1-T2** Scheduled backup  
3. **E1-T3** Cadence runbook  
4. **E1-T4** Free-space alert  
5. **E3-T1** Source policies for accepted RSS  
6. **E2-T1** Pin runtime npm deps  

**Exit criteria:** Scheduled backup succeeds twice; free space healthy; residual still ACCEPT on demand; RSS policies in place.

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

**Frame:** Local-first governed intelligence workstation; evidence + humans; no open crawl/AI auto-publish.  

**Audit:** Phases 1–3N closed and accepted; main risks are disk, backup scheduling, source policies, and dependency pins.  

**Plan:** Stabilize ops (P0) → security/governance (P1) → polish/coverage (P2) → future product only with new charter.  

**Tasks:** Execute E1 then E2/E3; keep E6 blocked until explicit approval.

---

*End of program charter. Update this file when a new gate is approved or a P0/P1 task closes.*
