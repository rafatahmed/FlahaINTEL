<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Market Price Analytics
Introduction:
Channel-agnostic multi-year, monthly, annual, histogram, and deviation analytics
for Amman, Mahaseel, MoCI, and future market channels.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Market price analytics

## Purpose

Snap market trends for PA: multi-year curves, seasonality, distribution, and simple deviation flags — **one engine for all channels**.

## API

`GET /api/markets/prices/analytics`

| Query | Notes |
|-------|--------|
| `channelCode` | Required |
| `commodityCode` | Required |
| `seriesKey` | Optional `code\|grade\|method` |
| `grade`, `cultivationMethod` | Optional series filters |
| `from`, `to` | Optional; span up to ~10 years |
| `preferValue` | `auto` \| `priceMode` \| `unitPrice` (Amman defaults mode) |
| `onlyApproved` | `true` to exclude pending rows |
| `limit` | Max observations (default 5000) |

## Response highlights

- **daily** — day-deduped series  
- **byYear** — one series per calendar year (`x` = `MM-DD` for overlay)  
- **monthly** — 12-bucket seasonal means  
- **annual** — year stats  
- **yearMonth** — year × month matrix  
- **histogram** — price bins  
- **stats** — n, mean, median, min, max, σ, p25, p75  
- **deviation** — latest vs 30d/90d and same month prior year; flag elevated/depressed  
- **recommendedView** — `daily` \| `by_year` \| `monthly` when span ≥ 1 year  

## UI

Markets → Prices → select commodity (and grade/method for full analytics):

- Modes: Daily · By year · Monthly · Annual · Histogram  
- Stats strip + deviation alert  
- Annual snapshot table  

## Governance

Analytics is **read-only**. Does not write sister products. Optional `onlyApproved` for policy-clean charts.
