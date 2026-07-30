<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4M-A Qatar Market Price Source
Introduction:
First country market onboarding charter for official Qatar price publications.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Gate 4M-A — Qatar market price source (first country)

## Status

**APPROVED** by product owner (2026-07-30) · **IMPLEMENTED** (source registry + channel seed; live daily scrape is next muscle)

## Purpose

Onboard **official Qatar** market price publication(s) (e.g. central market / Mahaseel-type notes) under FlahaINTEL governance so daily prices can feed the global model (4M-0).

## Maps to final product

- **EYE-MKT-01**, Stage B first country  
- Outcomes O1, O4, O5  

## Scope (in)

- Identify publisher-owned URL(s) or document channels  
- Ownership evidence and source registry-style record  
- Crawl/allowlist policy entries if web  
- Link to 4M-0 schema  
- Human review path for each harvest  

## Scope (out)

- Jordan (4M-B)  
- Multi-year backfill automation (may be separate)  
- Social or unofficial price chat  

## Acceptance (when implemented)

- [x] Source documented with ownership evidence (`docs/markets/market-channel-registry.json` → MoCI daily vegetables)  
- [x] Safe collection path verified (crawl-policy allowlist for `www.moci.gov.qa` commodities-daily-prices)  
- [ ] At least one successful governed harvest with evidence artifact (**next: scheduled HTML extract muscle**)  
- [x] Channel seeded in DB as `qa-moci-daily-vegetables` (`countryCode=QA`); API accepts price batch into global model

## Depends on

4M-0 charter approved (or implemented); backbone residual healthy.
