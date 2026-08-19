<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Systemic Operate Checklist (Conjugated Real Proof)
Introduction:
One-page operate day for FlahaINTEL as a single intelligence system — real data
through eyes → muscles → backbone → brain → feeds. Not demo seeds; not silo checks.

Created by: Rafat Al Khashan
Created date: 2026-08-01
Last modified: 2026-08-01
-->

# Systemic operate checklist — conjugated real proof

**Status:** BINDING operate discipline (post–v0.6 product surface)  
**Posture:** `INTEL-primary · FKP-frozen-thin`  
**Rule:** Prove the **whole body** once with **real** sources. Do not use `knowledge:seed-samples` as operate proof. Do not approve content you would not stand behind as Flaha.

**Related:**  
`flahaintel-final-product-lock.md` · `flaha-system-vision-and-operate-lock.md` ·  
`flahaintel-whole-intelligence-map.md` · `evidence-intake-spine.md` ·  
`milestone-v0.6-product-surface-release-readiness.md` · `operate-gap-audit-2026-08.md`

**One-command residual:** `npm run ops:operate-scoreboard`

---

## 0. What “pass” means

```text
PASS (systemic operate day) =
  real eyes saw something
  → muscles stored it on the spine
  → backbone kept proof
  → brain decided with human judgment
  → feeds/handoff only use what brain allowed
```

| Fail if… | Why |
|----------|-----|
| Only samples / DRAFT seeds | Not company truth |
| One silo green, rest untouched | Not conjugated |
| Collect success, never open Articles | Eyes without inspection |
| Approve to “fill the UI” | Pollutes brain |
| Handoff export of untrusted packs | False product proof |

**Minimum bar for one operate day:** complete **Loops A + B + C** below. Loop D is strong when science content exists; do not fake it.

---

## 1. Preconditions (pipes, not content)

Do once per host if not already true. These are **infrastructure**, not operate proof.

| Step | Action | Pass |
|------|--------|------|
| 1.1 | API + web runnable (`npm run ops:start` or your host start) | Login works |
| 1.2 | Tenant + admin exist (`bootstrap:local` if needed) | Role can review |
| 1.3 | Market channels registered (`markets:seed-channels`) | QA/JO channels listed under **Markets** |
| 1.4 | At least one enabled RSS source (accepted or agri batch) | **Sources** shows enabled feed |
| 1.5 | Disk not critical for the day | Prefer free-space check; DEGRADED is residual, not a green light |

**Do not run for operate:** `knowledge:seed-samples` / bank / comparison sample seeds  
(blocked unless `--for-tests`; fixtures live under `apps/api/test/fixtures/knowledge/`).  
If the DB still has demos: `npm run knowledge:purge-demo -- --confirm`

---

## 2. Conjugated loops (real data)

Work **in order**. Each loop touches multiple metaphor layers.

### Loop A — Markets (Eyes + Muscles + Brain)

| # | Layer | Operator action | Pass criteria |
|---|--------|-----------------|---------------|
| A1 | Eyes | Open **Markets** · pick one live channel (e.g. MoCI daily or Amman) | Channel exists and is the real publisher path |
| A2 | Muscles | Run harvest (scheduled task or `npm run markets:harvest`) | New or refreshed observations for a real market day |
| A3 | Backbone | Confirm retention / series path (`markets:retention` or Markets retention UI) | Counts/dates move; no silent zero when harvest claimed success |
| A4 | Brain | Open **Review inbox** (or Markets review) · act only on real rows | Approve official rows only if policy says auto/human OK; hold/reject junk |
| A5 | Conjugate | Spot-check **1–2 commodities** against the official web/PDF/list | Numbers match enough to trust the chain |

**Record:** channel · market date · rows added · review action · spot-check note.

---

### Loop B — RSS / Articles (Eyes + Muscles + inspect)

| # | Layer | Operator action | Pass criteria |
|---|--------|-----------------|---------------|
| B1 | Eyes | **Sources** · choose one real feed you keep | Source enabled |
| B2 | Muscles | **Collect now** (or collect all enabled) | Status SUCCESS; note found / added / skipped |
| B3 | Inspect | Open **Articles** · filter by that source | Titles visible; open publisher link for one item |
| B4 | Muscles | Collect **same source again** | Second run: **0 new** (or only true new items); dedupe works |
| B5 | Brain (process) | If agri batch still PENDING: start two-run acceptance notes for feeds you keep | Do not claim ACCEPTED until process done |

**Record:** source name · itemsFound · itemsAdded · second-run added · article URL checked.

---

### Loop C — Evidence intake (Spine conjugating domains)

Pick **one real file or URL** Flaha actually cares about (market bulletin, soil report, institutional PDF — not a random test blob).

| # | Layer | Operator action | Pass criteria |
|---|--------|-----------------|---------------|
| C1 | Eyes | **Submit** · land once (file or website) | Intake status LANDED (or equivalent) |
| C2 | Muscles | Classify + promote to the correct class | Promotes to markets **or** soil case **or** eyes pipeline — one path |
| C3 | Backbone | Open linked **Jobs** / **Artifacts** / intake detail | Provenance path exists (job id, artifact, or price/case link) |
| C4 | Brain | If a governance/review candidate or case appears: decide | Approve only if real and usable; else hold/reject |
| C5 | Conjugate | Confirm result in the **domain surface** (Markets **or** Knowledge soil cases **or** Content) | Same evidence visible where the promoter sent it |

**Classes (reminder):**  
`MARKET_MAHASEEL_PDF` · `MARKET_JO_AMMAN_EXCEL` · `PRODUCT_SOIL_REPORT` · `EYES_DOCUMENT` / `EYES_WEBSITE` · (CALC/FAST reserved).

**Record:** intake id · class · promote target · domain object id · decision.

---

### Loop D — Knowledge / handoff (Muscles + Brain + Feeds) — when real science exists

Skip if you have no real literature or method yet. **Empty is better than fake APPROVED.**

| # | Layer | Operator action | Pass criteria |
|---|--------|-----------------|---------------|
| D1 | Eyes | Land reference via **Submit** (doc/URL) and/or register literature; open **Knowledge → New pack** | Source you would stand behind |
| D2 | Muscles | **Add extract** with **HTTPS reference URL** (+ optional intake/artifact id) — real text only | Hard gate: reference + landed correlation on every item |
| D3 | Brain | **Submit for review** → **Approve (human)** only if trusted | API **rejects** orphan extracts (EVIDENCE_REFERENCE_REQUIRED) |
| D4 | Feeds | Rebuild research index if needed · open Knowledge Research | Topic/item appears only for allowed states |
| D5 | Handoff | Export handoff **only** for APPROVED content (UI or CLI) | Envelope non-empty for that pack; no DRAFT export as product truth |

**Record:** literature/pack id · review state · handoff yes/no.

---

## 3. Whole-system sign-off (same day)

After A–C (and D if done), check conjugation — not silo scores.

| Check | Question | Pass |
|-------|----------|------|
| One brain | Did **Review inbox** (or Governance) see at least one **real** decision today? | Yes |
| One spine | Did Submit or harvest leave a trace you can re-open (artifact / intake / price row)? | Yes |
| One map | Can Dashboard still describe Eyes / Muscles / Brain without contradiction? | Yes |
| No demo pollution | Did you avoid approving seed-samples as production knowledge? | Yes |
| Sister products | Did you **not** auto-write SOIL/CALC/FAST engines? | Yes |

**Day result:**

- [ ] **SYSTEMIC PASS** — Loops A+B+C pass; D honest (done or skipped empty)  
- [ ] **PARTIAL** — list which loop failed and why (host, source, process)  
- [ ] **NO-GO** — only seeds/UI smoke; operate day not claimed  

---

## 4. Operator log template (copy per day)

```text
Date:
Host / tenant:
Operator:

Loop A Markets: channel=  date=  rows=  review=  spot-check=
Loop B RSS:     source=   found=  added=  2nd-added=  article-url=
Loop C Intake:  id=       class=  promote= domain-id= decision=
Loop D Knowledge: skipped | pack/lit=  state=  handoff=

Systemic result: PASS | PARTIAL | NO-GO
Notes (disk, scheduler, failures):
```

---

## 5. Cadence (after first PASS)

| Cadence | What |
|---------|------|
| **Daily** | Market harvest on schedule · skim Review inbox · RSS collect if scheduler off |
| **Weekly** | Retention toward 365d · RSS acceptance progress · free-space check |
| **When content ready** | Real literature → APPROVED packs → handoff only then |
| **Never by default** | New eyes (YouTube/X), OCR, AI auto-classify — needs gate |

---

## 6. Explicit non-goals for this checklist

- Filling every screen with sample data  
- Treating **Content** as RSS Articles (Content = pipeline/governance candidates)  
- Treating FKP as a second intelligence product  
- Declaring product-complete without market span + real approved knowledge depth  

---

## 7. After first systemic PASS — next operate priorities

1. Repeat A on schedule until ≥1 channel approaches **MEETS_TARGET** (365d span).  
2. Finish RSS **two-run ACCEPTED** for feeds you keep.  
3. Grow **real** APPROVED packs / literature (Loop D becomes normal).  
4. Host disk toward ≥15% free when practical.  
5. Only then charter new country/weather/social gates.

---

**Engineering recommendation:** Run this checklist **once fully**, keep the log, then run abbreviated A+B daily. That is operate. Feature invention waits for owner gates.
