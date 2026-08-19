<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 5X X/Twitter Allowlisted Accounts (Stage E)
Introduction:
Allowlisted X eyes for logistics, weather, fertilizer, and official
accounts. Bounded collect into the vault. HOLD until 5E-0 unfreeze.

Created by: Rafat Al Khashan
Created date: 2026-08-19
Last modified: 2026-08-19
-->

# Gate 5X — X / Twitter allowlisted accounts

## Status

**HOLD** · Charter only (2026-08-19)  
Parent: `gate-5e-extended-eyes-scope.md` · Policy: **5E-0** first  

## One sentence

Watch **named** X accounts that matter to farmers (official markets/weather, fertilizer logistics, institutional alerts), land **posts as evidence** in the INTEL vault, and let humans decide — not a firehose and not a public social feed.

## Maps to final product

- Eye **E-Social** · Stage E · LAT-SOC-01  
- Outcomes O1 · O4 · O5  
- Prices still belong to **Markets (4M)**; X is context/alerts, not the price series store  

## Sub-gates (implement only after 5E-0)

| Slice | Outcome |
|-------|---------|
| **5X-A** | Account registry: handle, account id, owner, topic tags, enable flag |
| **5X-B** | Bounded collect of that account’s posts (rate-limited; no graph / no search-all) |
| **5X-C** | Content/Governance; optional cite into a pack after APPROVED |

## Scope (in)

- Explicit handle/id allowlist  
- Topics: logistics, weather alerts, fertilizer, official ministry/market notices  
- Post text + permalink + timestamp as artifact/metadata  
- Dedup by post id  

## Scope (out)

- Following followers, hashtag scrape, “agriculture Twitter”  
- DMs, lists, communities as sources  
- Auto-trading or auto-price rows from tweets  
- Replacing RSS agribusiness batch  
- FKP storing social posts  

## Acceptance (when implemented)

- [ ] At least one named account with ownership/verification note  
- [ ] One collect lands items with permalink + artifact/provenance  
- [ ] Second collect: **0** duplicate posts  
- [ ] Governance path works  
- [ ] Unknown handle rejected by policy  

## Depends on

5E-0 implemented · Stage E unfreeze · RSS-hardening lessons (timeouts, size, public destination)

## Approval record

| Role | Action | Date |
|------|--------|------|
| Product owner | Charter HOLD | 2026-08-19 |
