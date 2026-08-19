<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 5V YouTube Webinar Channel (Stage E)
Introduction:
Allowlisted YouTube webinar eyes: named channels, transcript/notes as
vault evidence, human review. HOLD until 5E-0 unfreeze.

Created by: Rafat Al Khashan
Created date: 2026-08-19
Last modified: 2026-08-19
-->

# Gate 5V — YouTube webinar channel

## Status

**HOLD** · Charter only (2026-08-19)  
Parent: `gate-5e-extended-eyes-scope.md` · Policy: **5E-0** first  

## One sentence

Watch **named** YouTube channels Flaha trusts (institutional webinars, method talks), land **transcript or operator notes** as artifacts in the INTEL vault, and let humans decide — not a video platform inside FlahaINTEL.

## Maps to final product

- Eye **E-Video** · Stage E · LAT-VID-01  
- Outcomes O1 (awareness) · O2 (science notes when reviewed) · O4 · O5  

## Sub-gates (implement only after 5E-0)

| Slice | Outcome |
|-------|---------|
| **5V-A** | Channel registry: channel id, title, owner, topic tags, enable flag |
| **5V-B** | Bounded fetch of **captions/transcript or human notes** → ArtifactStore (not full media library) |
| **5V-C** | Content/Governance candidate; optional pack cite after APPROVED |

## Scope (in)

- Allowlisted channel IDs only  
- Webinar / institutional talk use-case (soil, irrigation, nutrition, markets context)  
- Transcript, description, or operator-written notes as evidence  
- Dedup by video id  

## Scope (out)

- Storing full video files as the product  
- Comments, live chat, recommendations, “related videos”  
- Auto-summary, auto-translate as authority  
- Auto-apply into SOIL/CALC/FAST  
- FKP CMS for videos  

## Acceptance (when implemented)

- [ ] At least one named channel in allowlist with ownership note  
- [ ] One video lands notes/transcript artifact with provenance  
- [ ] Second collect of same video adds **0** duplicates  
- [ ] Governance can approve/reject/hold  
- [ ] Disabled channel does not collect  

## Depends on

5E-0 implemented · Stage E unfreeze · ArtifactStore + Governance baseline (already built)

## Approval record

| Role | Action | Date |
|------|--------|------|
| Product owner | Charter HOLD | 2026-08-19 |
