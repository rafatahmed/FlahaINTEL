<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Mahaseel Historical PDF Import
Introduction: Operator guide to backfill prior-year Mahaseel PDFs into FlahaINTEL markets.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Mahaseel historical PDF import

**Full matrix (all formats):** `docs/markets/historical-import-matrix.md`

## Why

Daily harvest only adds **new** bulletins. If you already have Mahaseel PDFs from prior years, import them to:

- Fill **retention span** without waiting a calendar year  
- Improve **trends** and **analyst packs** for Qatar local vegetables  

## Channel

`qa-mahaseel-local-vegetables`

## Requirements

1. `bootstrap:local` and `markets:seed-channels` already done  
2. PDFs with a **text layer** (exported/digital PDFs).  
   **Scanned image-only PDFs will fail** (no OCR in this path).  
3. Folder of `.pdf` files (subfolders OK)

## Commands

From repo root:

```powershell
# 1) Dry-run: parse only, no DB writes
npm run markets:import-mahaseel-pdfs -- --dir=C:\path\to\mahaseel-pdfs --dry-run

# 2) Import all PDFs under the folder (recursive)
npm run markets:import-mahaseel-pdfs -- --dir=C:\path\to\mahaseel-pdfs

# Single file
npm run markets:import-mahaseel-pdfs -- --file=C:\path\to\one.pdf

# First N files only
npm run markets:import-mahaseel-pdfs -- --dir=C:\path\to\mahaseel-pdfs --limit=5
```

## Safety / de-duplication (important)

If you have **5 copies of the same PDF** or several files for the **same from–to dates**, the importer will **not** insert five times.

| Layer | Rule |
|-------|------|
| **1. Same file bytes** | SHA-256 of PDF content — only the **first** file is kept |
| **2. Same bulletin period** | Same `periodFrom`–`periodTo` in the folder batch — only the **first** file is kept |
| **3. Period already in DB** | If that from–to already has rows for Mahaseel — **skip** (unless `--force`) |
| **4. Row upsert** | Same commodity + observed day + unit + pack/grade/method — **update**, not a second row |

```text
5 identical PDFs in folder
  → scan all
  → plan: import 1, skip 4 (duplicate_file_bytes)
  → write once
```

```text
PDF already imported last week (same dates)
  → skip (period_already_in_database)
```

```text
Re-upsert on purpose
  → --force  (still skips duplicate files/periods inside the same batch)
```

| Property | Behavior |
|----------|----------|
| Evidence | `file:///...` path on each row |
| Review | Follows channel policy (Mahaseel typically auto-approve when official) |
| Live harvest | Unchanged; still fetches latest PDF from Mahaseel site |

## After import

1. Markets hub → **Retention 365d** — Mahaseel span should grow  
2. Markets hub → **Prices** → Mahaseel channel — browse history  
3. Optional: **Analyst packs** → rebuild this channel  

## Failures

| Message | Action |
|---------|--------|
| empty text / no extractable text | PDF is likely scanned; convert with OCR outside INTEL or get digital original |
| MAHASEEL_PERIOD_NOT_FOUND | PDF layout differs; open one sample and adjust parser if needed |
| MAHASEEL_NO_ROWS | Text extracted but no vegetable lines matched |

## Not in scope (this tool)

- OCR of image PDFs  
- MoCI / Amman historical import (separate tools later)  
- Changing FlahaCALC/SOIL/FAST product code  
