<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 5E-0 Extended Eyes Policy and Allowlist Model
Introduction:
Foundation gate for Stage E: allowlist, intake class, rate limits, and
review path shared by YouTube (5V) and X (5X). HOLD — no code until unfreeze.

Created by: Rafat Al Khashan
Created date: 2026-08-19
Last modified: 2026-08-19
-->

# Gate 5E-0 — Extended eyes policy (allowlist model)

## Status

**HOLD** · Charter only (2026-08-19)  
Parent: `gate-5e-extended-eyes-scope.md`  
Depends on: Stage E unfreeze (§6 of parent). **Do not implement now.**

## Purpose

Give Stage E one **policy spine** so 5V and 5X do not invent two social products.

## Maps to final product

- Stage E foundation · Eyes E-Video / E-Social · O4 / O5  
- Track `LAT-VID-*` / `LAT-SOC-*` in program charter  

## Scope (in) — when unfrozen

- Machine-readable **allowlist** of named sources (channel id / handle / URL)  
- Publisher ownership + verification state (same spirit as RSS 1.2)  
- Intake class(es) on the Submit spine (e.g. `EYES_YOUTUBE_NOTES`, `EYES_X_POST`) — **no parallel silo**  
- Rate limit, payload size, and overlap-prevention rules  
- Enable/disable without deleting audit  
- Human review required by default (`HUMAN_REQUIRED`)

## Scope (out)

- 5V/5X collectors themselves (child gates)  
- OCR of video frames  
- AI summary  
- Firehose / graph crawl  
- FKP documents or MCP tools for social content  

## Acceptance (when implemented)

- [ ] Allowlist schema + seed path for **zero** default channels (operator adds names)  
- [ ] Disabled source cannot collect  
- [ ] Submit/promote class documented on evidence intake spine  
- [ ] Policy rejects unknown hosts/accounts  
- [ ] Tests: allow / deny / overlap  

## Human governance

Admin names every source. Collector has no approval authority.

## Approval record

| Role | Action | Date |
|------|--------|------|
| Product owner | Charter HOLD | 2026-08-19 |
