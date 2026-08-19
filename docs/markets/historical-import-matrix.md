<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Historical Market Import Matrix
Introduction:
Comprehensive architecture for backfilling market prices (Mahaseel PDF, Jordan Excel,
and future formats) with layered de-duplication and channel-safe ingestion.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-08-19
-->

# Historical market import — comprehensive matrix

## Purpose

Live harvest keeps **today forward** except where the publisher itself allows a short lookback (Amman from–to, **≤ 3 days** per query — `docs/markets/harvest-lookback-qa-jo.md`). Historical import fills **past years** so retention, trends, and analyst packs become useful **without waiting a calendar year**.

**Publisher lookback (2026-08-19):** MoCI JSON has **no** date filter — missed days are not recoverable from the live API. Amman has a date picker; months of gap = many 3-day harvest windows **or** Excel. Mahaseel live page is the current PDF only.

**Rules (LOCKED)**

1. One **store of record**: `MarketPriceObservation` (same as live harvest).  
2. **No duplicate bulletins** from 5 copies of the same file.  
3. **No double load** of the same channel + date (or period) already in DB.  
4. Row identity still **upserts** (commodity + day + unit + pack + origin).  
5. Never writes FlahaSOIL / CALC / FAST.  

---

## Capability matrix

| Profile | Country | Channel code | Input | Unit of uniqueness (bulletin) | CLI |
|---------|---------|--------------|-------|-------------------------------|-----|
| **qa-mahaseel-pdf** | QA | `qa-mahaseel-local-vegetables` | PDF (text layer) | `periodFrom`–`periodTo` + file SHA-256 | `markets:import-mahaseel-pdfs` |
| **jo-amman-excel** | JO | `jo-amman-central-market` | `.xlsx` / `.xls` / `.csv` | `observedOn` (calendar day) + file SHA-256 | `markets:import-jo-amman-excel` |
| qa-moci-* | QA | per MoCI channel | Live API is **today-only**; JSON dump / HTML archive if operator saved files | `observedOn` | *not built* — live `dailyPrice.php` ignores date params |
| amman-json (existing) | JO | Amman | harvest `--amman-json=` | per batch rows | `markets:harvest --amman-json=` |
| amman-live-range | JO | Amman | Official from–to picker | `observedOn` | `markets:harvest --from= --to=` (≤ 3 days). 2026-08-19: POST residual `errpage.aspx` |

---

## De-duplication stack (all historical profiles)

```text
Layer 0  File inventory
           └── recursive list of allowed extensions

Layer 1  Content hash (SHA-256 of file bytes)
           └── identical files in folder → keep FIRST only
               (e.g. 5 copies of same PDF/Excel → 1 import)

Layer 2  Bulletin key (format-specific)
           ├── Mahaseel: periodFrom|periodTo
           └── Amman Excel: observedOn (YYYY-MM-DD) per day in file
           └── same key twice in batch → keep FIRST only

Layer 3  Database presence
           ├── Mahaseel: period already has ≥1 row for channel → SKIP
           └── Amman: observedOn already has ≥1 row for channel → SKIP day
           └── override only with --force (re-upsert)

Layer 4  Row upsert (always)
           └── unique (channel, observedOn, commodity, unit, currency, pack, origin)
               + contentFingerprint  → no duplicate rows
```

| Scenario | Result |
|----------|--------|
| 5 identical Mahaseel PDFs | 1 import, 4 skip `duplicate_file_bytes` |
| 2 PDFs same from–to, different filenames | 1 import, 1 skip `duplicate_bulletin_period_in_batch` |
| PDF period already harvested live | skip `period_already_in_database` |
| Excel has 3 years of days | import only **new** days; skip days already in DB |
| Same Excel re-run | all days skip (already in DB) unless `--force` |
| Same tomato/day twice in one sheet | row upsert (one row) |

---

## Format contracts

### A. Mahaseel PDF (`qa-mahaseel-pdf`)

| Field | Source |
|-------|--------|
| periodFrom / periodTo | “from DD/MM/YYYY to DD/MM/YYYY” |
| commodity, grade, method, unitPrice | PDF text layout |
| currency | QAR |
| evidence | `file:///…` or live PDF URL |

**Requirement:** text-layer PDF (not scan-only).  

**Guide:** `docs/markets/mahaseel-historical-pdf-import.md`

### B. Jordan Amman Excel (`jo-amman-excel`)

Maps into existing `AmmanRawRow` → `mapAmmanRow` (qrsh → JOD).

| Logical field | Accepted column headers (any case; EN/AR aliases) |
|---------------|-----------------------------------------------------|
| priceDate | `priceDate`, `date`, `Date`, `Price Date`, `التاريخ`, `price_date` |
| commodityNameAr | `commodityNameAr`, `ar`, `Arabic`, `name_ar`, `اسم`, `الصنف`, `اسم الصنف` |
| commodityNameEn | `commodityNameEn`, `en`, `English`, `name_en`, `name` |
| highestQrsh | `highestQrsh`, `high`, `Highest`, `max`, `أعلى` |
| mostCommonQrsh | `mostCommonQrsh`, `mode`, `most_common`, `common`, `السائد` |
| minimumQrsh | `minimumQrsh`, `low`, `min`, `Lowest`, `أدنى` |
| quantityTons | `quantityTons`, `tons`, `qty`, `quantity`, `الكمية` |
| packageUnit | `packageUnit`, `unit`, `pack` (default `kg`) |
| origin | `origin`, `LOCAL` / `IMPORTED` (default LOCAL) |

**Price unit:** default **qrsh** (1 qrsh = 0.01 JOD).  
If headers clearly say **JOD** (`priceHighJod`, etc.), importer multiplies ×100 to qrsh before `mapAmmanRow`.

**Multi-sheet:** first sheet by default; `--sheet=Name` to pick.

**CSV:** same headers; use `--file=export.csv`.

---

## Operator workflows

### Qatar Mahaseel archive

```powershell
npm run markets:import-mahaseel-pdfs -- --dir=C:\archive\mahaseel --dry-run
npm run markets:import-mahaseel-pdfs -- --dir=C:\archive\mahaseel
```

### Jordan Amman Excel (~3 years)

Verified against `C:\Users\rafat\Downloads\2021.xlsx` (Arabic headers, monthly sheets, D/M/YY).

```powershell
# Check only (recommended first)
npm run markets:import-jo-amman-excel -- --file=C:\Users\rafat\Downloads\2021.xlsx --dry-run

# Import into jo-amman-central-market
npm run markets:import-jo-amman-excel -- --file=C:\Users\rafat\Downloads\2021.xlsx

# Folder of yearly workbooks (2021.xlsx, 2022.xlsx, …)
npm run markets:import-jo-amman-excel -- --dir=C:\Users\rafat\Downloads\amman-years
```

Notes: default `--date-order=dmy` (Jordan). Empty months (e.g. oct–dec empty) are skipped. `Master` sheet skipped.

### After any historical import

1. Markets hub → **Retention 365d** (span should jump)  
2. Markets hub → **Prices** → channel  
3. Optional: **Analyst packs** rebuild for that channel  

---

## Decision matrix (when to use what)

| You have… | Use |
|-----------|-----|
| Mahaseel PDF folder (past years) | `qa-mahaseel-pdf` |
| Jordan Excel / CSV of Amman daily prices | `jo-amman-excel` |
| One-off Amman JSON (live format) | `markets:harvest --amman-json=… --force` |
| Only live site | scheduled / manual `markets:harvest` |
| Scanned PDF no text | OCR outside INTEL first, then Mahaseel import |
| Unknown Excel columns | `--dry-run` prints detected headers; adjust sheet or rename columns |

---

## Non-goals

- OCR  
- Auto-merge conflicting prices for same day without fingerprint upsert  
- Changing product engines  
- FKP document store for prices (prices stay in INTEL only)  

---

## Extension checklist (new format)

1. Add row to capability matrix  
2. Define **bulletin key** (day vs period)  
3. Implement parser → `PriceRowInput[]`  
4. Reuse Layer 1–4 dedupe pattern  
5. CLI + dry-run + tests  
6. Operator doc section  

---

## Related

- Mahaseel PDF guide: `docs/markets/mahaseel-historical-pdf-import.md`  
- Channel registry: `docs/markets/market-channel-registry.json`  
- Amman sample JSON: `apps/api/fixtures/markets/amman-sample-2026-07-30.json`  
