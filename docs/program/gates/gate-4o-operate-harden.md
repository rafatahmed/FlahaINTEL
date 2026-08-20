<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4O Operate Harden (v0.6 residual / v0.7)
Introduction:
Numbered residual gates to make the v0.6 product surface operable as a
vault: evidence honesty, PDF aboutness, eyes workers, host hygiene.
Not Stage E. Not 4M-N. Not FKP MCP.

Created by: Rafat Al Khashan
Created date: 2026-08-19
Last modified: 2026-08-19
-->

# Gate 4O — Operate harden (v0.6 residual → v0.7)

## Status

**APPROVED TO START** (2026-08-19) · In progress  
Milestone: `docs/program/milestone-v0.7-operate-harden.md`  
Parent program: post-3N product surface is tagged; this is **operate-harden**, not new eyes.

**Rule:** Finish 4O before Stage E (5E/5V/5X) or 4M-N.

---

## 1. One sentence

Make the **vault** honest and runnable: real evidence on packs, literature aboutness from PDFs, eyes jobs that complete, host disk/cadence — so Flaha can operate Stages B–D without demo seeds or CLI folklore.

---

## 2. Maps to lock

| Dimension | Mapping |
|-----------|---------|
| Stage | Residual of B/C/D + backbone ops — **not** E |
| Metaphor | Vault muscles + brain honesty |
| Outcomes | O2 (usable packs) · O4 (evidence) · O5 (human control) |
| Vault / door / engine | Vault only. Do not build FKP MCP. Do not auto-write engines. |

---

## 3. Gate map

| Gate | Outcome | Status |
|------|---------|--------|
| **4O-0** | This charter + scoreboard language (OPEN / CLOSED / BLOCKED_PUBLISHER / OPEN_HOST) | **DONE** (scoreboard shipped; charter now) |
| **4O-A** | Evidence honesty: demo purge, hard reference+landed correlation on pack submit/approve | **IN PROGRESS** (branch) |
| **4O-B** | PDF KEY WORDS → literature aboutness (from extracted text; no OCR) | **IN PROGRESS** (parser + CLI + API; artifact auto-read is 4O-B.2) |
| **4O-C** | Eyes PDF path documented + `ops:pipeline-once`; always-on workers = **host** residual | **FOUNDATION** (pdf-lite shipped) |
| **4O-D** | Host hygiene: free space toward ≥15%; volume layout; no invented disk miracles in code | **OPEN_HOST** |
| **4O-E** | 4R-A.2 optional: topics for pack, cases on index (enrichment) | **BACKLOG** (after 4O-A/B) |
| **4O-F** | CALC/FAST report promote beyond DRAFT (intake classes exist) | **BACKLOG** (after real report in vault) |

MoCI 365d is **operate + publisher**, not a 4O code gate (`BLOCKED_PUBLISHER`). Keep daily harvest.

---

## 4. 4O-B acceptance (this start slice)

- [x] Pure parser: KEY WORDS / Keywords / Index terms from extracted PDF text  
- [x] Merge into `LiteratureSource.keywords` without wiping operator tags  
- [x] Never auto `SOURCE_APPROVED`  
- [x] CLI + API: text file / `{ text, apply }` (`knowledge:literature-pdf-keywords`, `POST .../pdf-keywords`)  
- [x] Unit tests (McLean-style KEY WORDS block)  
- [ ] Optional later: pull text from `evidenceArtifactId` automatically (4O-B.2)

Out: OCR, Docling (rejected; do not restore), MinerU until a dedicated gate, Arabic PDF as a supported path, AI keyword invent.

---

## 5. Non-goals

YouTube/X · 4M-N · FKP MCP · embeddings · auto-apply to engines · seed-samples as operate proof.

---

## 6. Approval record

| Role | Action | Date |
|------|--------|------|
| Product owner (Rafat Al Khashan) | Start 4O operate-harden; 4O-B first code slice | 2026-08-19 |
