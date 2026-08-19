<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 5E Extended Eyes — Comprehensive Scope (Stage E)
Introduction:
Frames Stage E (YouTube + X and later named networks) as allowlisted
extended eyes into the FlahaINTEL vault. HOLD until Stages B/C prove in
operate. Not implementation and not unrestricted crawl.

Created by: Rafat Al Khashan
Created date: 2026-08-19
Last modified: 2026-08-19
-->

# Gate 5E — Extended eyes comprehensive scope (Stage E)

## Status

**SCOPE FRAMED · HOLD** (2026-08-19)  
**Do not implement** until owner unfreeze (§6) after Stages B/C prove in operate.  
This document is the Stage E constitution. Child gates:

| Gate | File | Status |
|------|------|--------|
| **5E-0** | `gate-5e-0-extended-eyes-policy.md` | HOLD — policy + allowlist model |
| **5V** | `gate-5v-youtube-webinar-channel.md` | HOLD — YouTube webinars |
| **5X** | `gate-5x-x-allowlist.md` | HOLD — X/Twitter allowlisted accounts |
| **5E-N** | (not opened) | HOLD — any later named network uses the same 5E-0 pattern |

**Not Stage E:** OCR, embeddings, AI classify/summarize, FKP MCP, 4M-N new countries, public social listening.

---

## 1. One sentence

**Stage E** is FlahaINTEL’s **allowlisted video and social eyes**: named YouTube channels and named X accounts (and later only other **named** networks) enter the **vault** as governed evidence — transcript/notes or bounded posts — so PA can see logistics, weather, fertilizer, and webinar science **without** becoming a crawler, a public news site, or an auto-publisher.

---

## 2. Why this stage exists (and why it waits)

Final product lock: Eyes include **E-Video** and **E-Social** as **P3 later**. Markets (Stage B) and science packs (Stage C) must work end-to-end first, or video/social becomes ungoverned noise on an empty vault.

| Intent | Meaning |
|--------|---------|
| **Eyes, not entertainment** | Webinars and allowlisted accounts that affect farmers, markets, or methods |
| **Named sources only** | Channel ID / handle on a written allowlist — never “follow the graph” |
| **Same vault** | Land → artifact → Content/Governance — not a parallel social product |
| **Human brain** | Collect success ≠ approved knowledge; no auto-pack, no auto-handoff |
| **Door stays FKP** | Stage E does **not** live in FKP. FKP MCP does not serve tweets or videos |

**Metaphor:** Stage E opens **more eyes** into the **INTEL vault**. It does not open a second vault and does not use the FKP **door**.

---

## 3. Maps to final product lock

| Dimension | Mapping |
|-----------|---------|
| **Stage** | **E — Extended eyes** (after B/C prove the model) |
| **Eyes** | **E-Video** (5V) · **E-Social** (5X) · later **5E-N** |
| **Muscles** | Bounded collect + transcript/notes extract + schedule |
| **Backbone** | ArtifactStore, jobs, provenance, allowlist policy |
| **Brain** | Governance review; optional pack cite only after APPROVED |
| **Outcomes** | O1 (currency) · O4 (safe collect) · O5 (human control) |
| **Geography** | Worldwide mission; **implement allowlists Flaha actually watches** (not a country wall) |
| **Vault / door / engine** | Vault only. Door (FKP) unchanged. Engines never auto-written. |

---

## 4. Gate map (Stage E)

```text
5E-0  Policy + allowlist + intake class          HOLD (charter now)
  │
  ├── 5V  YouTube webinar channel
  │     5V-A  Named channel registry + ownership
  │     5V-B  Bounded fetch of transcript/notes as artifact
  │     5V-C  Governance candidate; optional pack cite
  │
  ├── 5X  X / Twitter allowlist
  │     5X-A  Named account registry + ownership
  │     5X-B  Bounded collect (no firehose, no graph crawl)
  │     5X-C  Governance; optional knowledge cite
  │
  └── 5E-N  Later named network (only if owner names it)
            Same 5E-0 pattern — do not invent Instagram/TikTok now
```

Each child gate must declare: **allowlist, rate limits, artifact type, review path, non-goals.**

---

## 5. What Stage E is / is not

### 5.1 Is

- Named YouTube **channels** (webinars, institutional talks) under policy  
- Named **X accounts** (logistics, weather, fertilizer, official ministries) under policy  
- Transcript or operator notes as **immutable artifacts**  
- Deduped items → Content → **human** Governance  
- Optional later: APPROVED notes cited from a knowledge pack (`literatureSourceId` / artifact id)

### 5.2 Is not

| Reject | Why |
|--------|-----|
| Unrestricted crawl / “listen to agriculture Twitter” | Violates O4 |
| Download every video as the product | Vault is evidence, not a media CDN |
| Auto-summarize with AI | Non-goal until a separate gate |
| Auto-approve or auto-handoff to SOIL/CALC/FAST | Brain + engines lock |
| FKP storing tweets/videos | Door ≠ vault |
| Replacing RSS or Markets | News prices stay 4M; news RSS stays Sources |
| Comments, DMs, private lists as sources | Out of scope |

---

## 6. Entry / unfreeze (HARD)

Owner may unfreeze Stage E (start **5E-0** code) only when **all** of the following hold:

1. **Operate:** at least one conjugated systemic operate day (Loops A+B+C) recorded.  
2. **Stage B:** at least one market channel **MEETS_TARGET** **or** honest `BLOCKED_PUBLISHER` plus another channel MEETS_TARGET.  
3. **Stage C:** real APPROVED science packs exist (not demo seeds) and 4I-B handoff can export one of them.  
4. **Vault health:** disk not CRITICAL; RSS agri feeds not a PENDING pile.  
5. **Written unfreeze:** this file’s approval table + sprint note naming **5E-0** as the first code gate.

Until then: **HOLD**. Agents must **reject** YouTube/X implementation requests.

---

## 7. Architecture (when unfrozen)

```text
Allowlist (5E-0)
    → bounded collector (5V-B / 5X-B)
    → ArtifactStore (transcript, notes, or post payload)
    → Jobs + EvidenceIntake / ProductSubmission
    → Content candidate
    → Governance (human)
    → optional pack extract cite (vault)
```

**Rules**

- TypeScript API remains sole DB writer.  
- Collectors are supervised workers or CLI, JSONL, no approval authority.  
- Production bind loopback; no public scrape farm.  
- Rate limits and response-size bounds like RSS hardening.  
- Worker success ≠ approved intelligence.

---

## 8. Relationship to v0.7

**v0.7 operate-harden (4O) is in front of Stage E.** Fill and govern the vault; do not open new eyes while residuals are OPEN_HOST / publisher-limited / evidence-thin.

See `docs/program/gates/gate-4o-operate-harden.md` and `docs/program/milestone-v0.7-operate-harden.md`.

---

## 9. Approval record

| Role | Action | Date |
|------|--------|------|
| Product owner (Rafat Al Khashan) | Frame Stage E with gates 5E-0 / 5V / 5X; **HOLD** until §6 | 2026-08-19 |
