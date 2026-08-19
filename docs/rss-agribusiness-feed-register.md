<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Agribusiness RSS / Data-Feed Practical Register
Introduction:
Classification and operational status of candidate news, regulatory, fertilizer,
seed, weather, and price sources for FlahaINTEL monitoring — with hard separation
of RSS (news/alerts) vs Markets/API (prices).

Created by: Rafat Al Khashan
Created date: 2026-08-01
Last modified: 2026-08-01
-->

# Agribusiness RSS / data-feed practical register

**Policy (LOCKED for this register):**

| Channel type | Use for | Not for |
|--------------|---------|---------|
| **RSS** | News, announcements, regulatory alerts, industry bulletins | Unit prices of vegetables, fertilizer, seeds, pesticides |
| **Markets / API / CSV / official reports** | Structured prices (QA MoCI, Mahaseel, Amman, AMS, World Bank, FAOSTAT…) | Replacing official market harvest with scraped headlines |

Existing RSS baseline: `docs/rss-source-registry.json` + `docs/rss-source-onboarding.md`.  
Markets: `docs/markets/market-channel-registry.json`.

---

## 1. Already in FlahaINTEL feed (operational)

| Source | URL | Status |
|--------|-----|--------|
| FAO Global Newsroom | `https://www.fao.org/feeds/fao-newsroom-rss` | **ACCEPTED** · enabled |
| USDA News Releases | `https://www.usda.gov/rss/latest-releases.xml` | **ACCEPTED** · enabled (403 observed from some networks; re-check if collection fails) |
| UN News Global | UN feed | **ACCEPTED** |
| ReliefWeb Updates | ReliefWeb RSS | **ACCEPTED** |
| EC Agriculture News | EC RSS | **ACCEPTED** |
| Al Jazeera English | Al Jazeera RSS | **ACCEPTED** |
| BBC News | BBC RSS | **ACCEPTED** |
| USDA NASS News | `http://www.nass.usda.gov/rss/news.xml` | **DEGRADED** in registry (stale risk) |
| USDA NASS Today’s Reports | NASS reports RSS | **DEGRADED** (thin sample historically) |

---

## 2. Batch review results (2026-08-01 probe)

### 2.1 RSS candidates — **ONBOARD to feed** (parseable XML + useful agri news/alerts)

| Category | Source | Verified endpoint | Probe | Action |
|----------|--------|-------------------|-------|--------|
| Ag news | Brownfield Ag News | `https://www.brownfieldagnews.com/feed/` | 200 · RSS · ~20 items | **ACCEPTED** (two-run 2026-08-01) |
| Agribusiness/policy | Agri-Pulse News | `https://www.agri-pulse.com/rss/topic/71-news` | 200 · RSS | **ACCEPTED** (two-run 2026-08-01) |
| Agribusiness/economy | Agri-Pulse Economy | `https://www.agri-pulse.com/rss/topic/21767-economy` | 200 · RSS | **ACCEPTED** (two-run 2026-08-01) |
| Regulatory | Agri-Pulse Regulatory | `https://www.agri-pulse.com/rss/topic/21766-regulatory` | 200 · RSS | **ACCEPTED** (two-run 2026-08-01) |
| Fertilizer **news** | FertilizerWorks News | `https://fertilizerworks.com/news.xml` | 200 · RSS · ~10 items | **ACCEPTED** (two-run 2026-08-01) |
| Grain business | World Grain Trade | `https://www.world-grain.com/rss/topic/1034-trade` | 200 · RSS | **ACCEPTED** (two-run 2026-08-01) |
| Grain / FAO-related | World Grain FAO topic | `https://www.world-grain.com/rss/topic/1054-fao` | 200 · RSS | **ACCEPTED** (two-run 2026-08-01) |
| Pesticide/food safety science | EFSA Journal | `https://www.efsa.europa.eu/en/efsajournal/rss` | 200 · RSS · ~20 items | **ACCEPTED** (two-run 2026-08-01) |

**Wave D CLI:** `npm run rss:accept-two-run -- --confirm` · then `npm run bootstrap:source-policies`

Bootstrap: `npm run bootstrap:rss-agribusiness-batch` (API workspace).  
Preflight audit: `docs/rss-agribusiness-batch-preflight.json`.

### 2.2 RSS candidates — **NOT onboarded** (broken endpoint, portal-only, or blocked)

| Source | Claimed / guessed link | Result | Disposition |
|--------|------------------------|--------|-------------|
| Agri-Pulse “News RSS” generic | `/rss/news` | 404 | Use **topic** feed above |
| Farms.com portal | `/rss` | 404 / thin dummy | **Directory only** — pick specific Farms.com feeds later |
| FertilizerWorks generic | `/rss/news` | 404 | Use `news.xml` |
| FertilizerWorks Events | `events.xml` | 200 but **0 items** | Hold until populated |
| FertilizerPrice.com | `/feed/` | 404 | Reject as RSS; treat as **price analysis site** not feed |
| Seed Today | `/rss` | 404 | **No verified endpoint** — hold |
| NCAP blog | `/feed` | 404 | Hold |
| No-Till Farmer | crop protection RSS | 403 | Blocked; hold |
| World Grain root | `/rss` | HTML topic directory | Use **topic** feeds only |
| USDA NASS (registry) | already degraded | — | Keep DEGRADED until freshness review |
| Health Canada pesticides | guessed XML | timeout/fail | Hold — find official PMRA feed page |
| NWS CAP US | `alerts.weather.gov` | DNS fail from this host | US-only; **not Qatar** |
| CME Group | `/rss` | 403 | Hold; futures prices ≠ free RSS |

### 2.3 **Not RSS** — route to Markets / data tracks (do not put on RSS collector)

| Category | Source | Channel | FlahaINTEL home |
|----------|--------|---------|-----------------|
| Vegetable prices | USDA AMS My Market News | **API** | Future market channel (US), not RSS |
| Global fertilizer prices | World Bank commodity prices | **Excel/API** | Markets historical / commodity data gate |
| FAO Food Price Index | FAO report/data | **Data** | Markets / research literature context |
| FAO GIEWS FPMA | Tool | **Data** | Country food-price comparison (eyes later) |
| FAOSTAT producer prices | API | **API** | Markets model extension |
| Commodity futures | CME | Data service | Not free RSS prices |
| Weather (Qatar) | Qatar Meteorology (QWeather) | Website/app | **No public RSS found** — manual/API later |
| Weather international | WMO WWIS | Website | Later weather channel |
| Weather US | NWS API / alerts | API/RSS US | Low priority for QA/JO ops |

---

## 3. Recommended operating set (agribusiness monitoring)

### Eyes — news & alerts (RSS collector)

1. FAO Global Newsroom *(already)*  
2. USDA releases *(already)*  
3. EC Agriculture *(already)*  
4. ReliefWeb / UN *(already — food security / crisis)*  
5. **Brownfield** · **Agri-Pulse (News + Economy + Regulatory)** · **FertilizerWorks News** · **World Grain Trade** · **EFSA Journal** *(this batch)*  

### Eyes — prices (Markets spine — **not RSS**)

| Priority | Source | Notes |
|----------|--------|-------|
| P0 | QA MoCI / Mahaseel · JO Amman | Already in market channels |
| P1 | World Bank fertilizer series | Monthly commodity, Excel/API |
| P1 | USDA AMS (if US veg relevant) | API — separate gate |
| P2 | FAOSTAT / FPMA | Country comparison, not farm retail QA |

### Weather

| Source | Status |
|--------|--------|
| Qatar Met / QWeather | **Primary for Qatar** — no RSS; integrate later under weather gate |
| NWS | US-only; optional later |
| WMO WWIS | Directory/service, not RSS |

---

## 4. Hard rules for this register

1. **Never** treat fertilizer/seed/pesticide **news RSS** as local unit-price truth.  
2. **Never** invent feed URLs; only publisher-declared or probe-verified endpoints.  
3. New operational sources start as **PENDING** until Phase 1.2 two-run acceptance (zero dups on second collect).  
4. Commercial media is allowed for **desk awareness**, not as sole authority for governance claims.  
5. Qatar/JO market prices stay on **Markets harvest**, not global US wholesale feeds.

---

## 5. Operator commands

```powershell
# Create PENDING enabled sources that parse cleanly
npm run bootstrap:rss-agribusiness-batch --workspace=@flaha-intel/api

# Collect (scheduler or manual API collect per source)
# After two clean runs with content review → promote registry entry to ACCEPTED

# Prices remain Markets:
npm run markets:harvest
```

---

## 6. Acceptance follow-up (per new source)

For each PENDING source before registry **ACCEPTED**:

1. Manual review ≥3 items for suitability  
2. First collection succeeds  
3. Second collection adds **0** duplicates  
4. Update `docs/rss-source-registry.json` + `databaseSourceId`  

Until then, feeds may still collect for monitoring under PENDING.
