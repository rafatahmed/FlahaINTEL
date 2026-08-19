<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Market Harvest Lookback — Qatar MoCI vs Jordan Amman
Introduction:
Locks how far live harvest can look back: MoCI is today-only; Amman has a
from–to date picker but product queries stay in 3-day windows.

Created by: Rafat Al Khashan
Created date: 2026-08-19
Last modified: 2026-08-19
-->

# Market harvest lookback — MoCI vs Amman

**Status:** LOCKED from live publisher check **2026-08-19** (operator screenshot + API/HTML probe).  
**Related:** `docs/markets/source-recon-qa-jo.md` · `docs/markets/historical-import-matrix.md`

## Operator rule (one page)

| Channel | Must harvest going forward | Can fill missed / old days from the live site? |
|---------|----------------------------|------------------------------------------------|
| **Qatar MoCI** (4 lists) | **Daily** | **No.** API returns one current table. No from–to. Missed days are usually gone. |
| **Jordan Amman** | **Daily** (so the series does not stall again) | **Yes, in 3-day windows** via من تاريخ / الى تاريخ. Months = many windows, or Excel. |
| **Qatar Mahaseel** | Every **3 days** | **No** from the live page. Only the PDF currently linked. Keep files for `markets:import-mahaseel-pdfs`. |

Local development: the **web UI does not collect**. Collection is `markets:harvest` (or Windows task `FlahaINTEL-MarketHarvest`) while this PC is on. If the machine is off, eyes are closed.

---

## Qatar MoCI — today-only

**Portal:** https://www.moci.gov.qa/en/our-services/consumer/commodities-daily-prices/

Page scripts call only:

```text
GET https://www.moci.gov.qa/wp-content/themes/2018_mec_v1/api/dailyPrice.php?id={N}&lang=en
```

| Channel | apiId |
|---------|------:|
| `qa-moci-daily-vegetables` | 12 |
| `qa-moci-imported-vegetables` | 13 |
| `qa-moci-imported-fruits` | 16 |
| `qa-moci-daily-fish` | 17 |

**Probed 2026-08-19:** extra query params (`date`, `from`/`to`, `day`) are **ignored**. Same JSON as the unparameterized URL.

Live `date` field on that day (publisher, not FlahaINTEL):

| List | Bulletin date in JSON |
|------|------------------------|
| Daily vegetables | **18/09/2025** — publisher stuck |
| Imported fruits | **05/09/2024** — publisher stuck |
| Imported vegetables | **13/08/2026** |
| Fish | **13/08/2026** |

Harvest can only store **that** table. Daily harvest does not invent missing history. Stuck lists are `BLOCKED_PUBLISHER` until MoCI updates.

There is **no** Amman-style date picker on the commodity tables. Site-wide datepicker CSS/JS is not wired to `dailyPrice.php`.

CLI:

```text
npm run markets:harvest -- --country=QA --force
```

---

## Jordan Amman — date picker, 3-day product window

**URL:** https://www.ammancity.gov.jo/ar/market/prices.aspx  

Owner screenshot (2026-08-19 06:45): **من تاريخ** / **الى تاريخ** default **19-08-2026**, **محلي / مستورد**, **بحث**.

That is a **range query**. Past days can be requested. The product lock is still:

```text
harvest daily; each live query from–to ≤ 3 inclusive days
```

(`MarketChannel.filterMaxSpanDays = 3` on `jo-amman-central-market`.)

**Months of history is not one search.** Walk 3-day slices, or import GAM Excel:

```text
npm run markets:harvest -- --channel=jo-amman-central-market --from=2026-08-17 --to=2026-08-19 --origin=LOCAL --force
npm run markets:import-jo-amman-excel -- <folder-or-file>
```

GAM may still have older days; that is **not guaranteed** for every calendar day. Excel remains the path for multi-year fill.

### Live harvest muscle (2026-08-19)

ASP.NET GET shows the date fields. Governed POST search (`harvestAmmanLive`) returned **`errpage.aspx?aspxerrorpath=/ar/market/prices.aspx`** — including for **2026-07-30**, a day already stored. Until that postback is fixed, `--from`/`--to` will not close the gap. Use Excel in the meantime.

DB snapshot the same morning: Amman `lastObservedOn` **2026-07-30** (~20 day lag) after local-only operate (API/task not running).

---

## What this is not

- Not a reason to skip **daily** Amman harvest once the adapter works.  
- Not permission to query Amman for a 30-day span in one call.  
- Not a MoCI historical importer (still *not built*; live API cannot feed it).  
- Not auto-apply into FlahaSOIL / CALC / FAST.
