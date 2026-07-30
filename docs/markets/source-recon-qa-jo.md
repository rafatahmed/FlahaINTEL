<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Market Source Recon — Qatar Mahaseel and Jordan Amman
Introduction:
Operator recon of official vegetable/fruit price channels after live page and screenshot review.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Market source recon — QA Mahaseel & JO Amman

**Status:** Checked live + owner screenshots (2026-07-30).  
**Principle:** Worldwide model; these are first two countries. Mahaseel = simple; Amman = comprehensive.

---

## 1. Qatar — Mahaseel (simple)

| Field | Value |
|-------|--------|
| URL | https://mahaseel.qa/en/prices-of-vegetables/ |
| Publisher | Mahaseel (Marketing & Agri-Services, Qatar) |
| Language | English page |
| Delivery | **PDF download** linked on page |
| Date model | **Period** printed on PDF (e.g. from 05/01/2023 to 08/01/2023) |
| Freshness note | Linked PDF can lag; not always a same-day bulletin |
| Price shape | One **price per kg** + **grade** + **cultivation method** |
| Currency | QAR / kg |
| Origin | Local vegetables list |

### Harvest approach (later muscle)

1. Open prices page → find current PDF URL  
2. Download PDF as evidence artifact  
3. Parse rows → `MarketPriceObservation` with `periodFrom` / `periodTo`  
4. Human review before “official series”

---

## 2. Jordan — Greater Amman Municipality central market (comprehensive)

| Field | Value |
|-------|--------|
| URL | https://www.ammancity.gov.jo/ar/market/prices.aspx |
| Publisher | أمانة عمّان الكبرى (Greater Amman Municipality) |
| Language | **Arabic UI**; browser translate → English labels; print can become English PDF |
| Delivery | Interactive **web table** after search; **Price printing** → browser print / Adobe PDF |
| Tech | ASP.NET WebForms (`__VIEWSTATE`, postback) |

### Filters (required)

| UI (EN after translate) | UI (AR) | Meaning |
|------------------------|---------|---------|
| From date | من تاريخ | Range start |
| To date | الى تاريخ | Range end |
| **local** | محلي | Local produce |
| **imported** | مستورد | Imported (not “export”) |
| research / Search | بحث | Run query |
| Price printing | طباعة الأسعار | Print / save as PDF |

### Single product card (example from screenshots 2026-07-30)

| Field | Arabic example | English example | Notes |
|-------|----------------|-----------------|--------|
| Product name | اسود رفيع | thin black | Bilingual identity needed |
| Price date | 2026-07-30 | 30-07-2026 | Daily |
| Highest price | 50 قرش | 50 piasters | |
| Most common price | 25 قرش | 25 piasters | “Mode” / prevailing |
| Minimum price | 10 قرش | 10 piasters | |
| Quantity | 31.929 طن | 31.929 tons | Per product that day |
| Package | كيلو | 1 kg | Pack unit |

### Currency rule (Jordan)

```text
1 قرش (qrsh / piaster) = 0.01 JOD
50 قرش = 0.50 JOD
25 قرش = 0.25 JOD
10 قرش = 0.10 JOD
```

Always store:

- `priceNative` + `nativeUnit` = `QRSH` (or piaster)  
- `priceJod` = native × 0.01  
- `currency` = `JOD` for normalized series  

### Totals by type (page summary, same day)

Example from screenshot:

| Type | Quantity (tons) |
|------|-----------------|
| Vegetables | 2,103.424 |
| Fruit | 761.316 |
| Leafy greens | 169.974 |

These are **market-day aggregates**, not per-row prices — store as separate **daily summary** facts if needed for analysis.

### Print / PDF evidence path

1. Set filters (dates + local/imported)  
2. Search  
3. Optionally translate page to English in browser  
4. **Price printing** → Print → **Adobe PDF** / Save as PDF  
5. PDF columns (English print example): Category, Package, Higher price, Minimum price, Most common price, Quantity, Price history (date)  

PDF is excellent **evidence artifact** for governance.

### Harvest approach (later muscle)

1. Governed POST search (from/to + LOCAL|IMPORTED)  
2. Parse HTML cards/table **or** operator/PDF path  
3. Map AR name → stable `commodityCode` + keep `commodityNameAr` / `commodityNameEn`  
4. Convert قرش → JOD  
5. Human review  

---

## 3. Complexity comparison

| | Mahaseel (QA) | Amman (JO) |
|--|---------------|------------|
| Complexity | **Simple** | **Big / comprehensive** |
| Medium | Period PDF | Daily interactive + print PDF |
| Dimensions | commodity, grade, method, price/kg | commodity, pack, high/mode/low, qty tons, date, local/imported |
| Language | English | Arabic-first + EN translate/print |
| Currency | QAR/kg | قرش → JOD |
| Aggregates | No | Yes (veg/fruit/leafy totals) |
| Evidence | PDF file | HTML result + optional print PDF |

---

## 4. Model implications (global, still one product)

Extend market observations (when implementing harvest) to support:

| Field | Mahaseel | Amman |
|-------|----------|-------|
| periodFrom / periodTo | Yes | Optional (query range) |
| observedOn | Period end or each day | Price date |
| priceHigh / priceMode / priceLow | — | Yes (قرش + JOD) |
| unitPrice | Yes (QAR/kg) | Derive from mode/high/low as needed |
| grade | Yes | — |
| cultivationMethod | Yes | — |
| packDescription / packageUnit | — | Yes (kg) |
| quantityTons | — | Yes |
| originLabel LOCAL / IMPORTED | Local list | Filter |
| commodityNameAr / commodityNameEn | EN | Both |
| evidence PDF/HTML | PDF | Print PDF preferred |

Country remains `QA` / `JO` only — **no separate Jordan product**.

---

## 5. Decision

| Channel | Register | Priority for harvest muscle |
|---------|----------|------------------------------|
| `qa-mahaseel-local-vegetables` | Yes | Medium (simple PDF; check update cadence) |
| `jo-amman-central-market` | Yes | **High** (daily, rich, farm-advice value) |
| MoCI QA daily | Optional second QA channel | If true daily government bulletin needed |

**Owner insight accepted:** Mahaseel context is simple; Jordan context is large and comprehensive — both feed the **same** worldwide FlahaINTEL market model.

---

## 6. Harvest cadence (owner rule — locked)

| Country | Channel | Harvest interval | Product filter window |
|---------|---------|------------------|------------------------|
| **Jordan** | `jo-amman-central-market` | **Daily** | from–to **≤ 3 days** |
| **Qatar MoCI** | daily vegetables, imported vegetables, daily fish, imported fruits | **Daily** (like Jordan) | from–to **≤ 3 days** |
| **Qatar Mahaseel** | `qa-mahaseel-local-vegetables` | **Every 3 days** (period PDF) | ≤ 3 days |

```text
Jordan:           harvest daily; filter products in ≤ 3-day windows.
Qatar MoCI port:  harvest daily (4 lists under one portal).
Qatar Mahaseel:   harvest every 3 days (period PDF).
```

Stored on `MarketChannel.harvestIntervalDays` and `MarketChannel.filterMaxSpanDays`.

---

## 7. Qatar MoCI commodities daily portal (beside Mahaseel)

**Portal:** https://www.moci.gov.qa/en/our-services/consumer/commodities-daily-prices/

| List | Channel code | URL slug |
|------|--------------|----------|
| Daily vegetable prices | `qa-moci-daily-vegetables` | `.../%e2%80%8b%e2%80%8bdaily-vegetable-prices/` (site uses zero-width chars in slug; plain `daily-vegetable-prices/` returns 404) |
| Imported Vegetable Prices | `qa-moci-imported-vegetables` | `.../imported-vegetable-prices/` |
| Daily fish prices | `qa-moci-daily-fish` | `.../daily-fish-prices/` |
| Imported Fruits Prices | `qa-moci-imported-fruits` | `.../imported-fruits-prices/` |

Same ministry, **four channels**, daily cadence. Distinct from simple Mahaseel period PDF.

### MoCI live API (for harvest muscle)

Page scripts call:

`https://www.moci.gov.qa/wp-content/themes/2018_mec_v1/api/dailyPrice.php?id={N}&lang=en`

| Channel | apiId |
|---------|------:|
| Local daily vegetables | 12 |
| Imported vegetables | 13 |
| Imported fruits | 16 |
| Daily fish | 17 |

JSON fields: `name`, `Source`, `Size`, `Unit`, `PackPrice`, `price`, `date` (DD/MM/YYYY).

### Harvest CLI

```text
npm run markets:seed-channels
npm run markets:harvest -- --force
npm run markets:harvest -- --country=QA --force
npm run markets:harvest -- --channel=qa-moci-daily-vegetables --force
npm run markets:harvest -- --channel=jo-amman-central-market --amman-json=apps/api/fixtures/markets/amman-sample-2026-07-30.json --force
```

Cadence is enforced unless `--force`:
- MoCI + Jordan: daily
- Mahaseel: every 3 days
- Product query filters: max 3-day span
