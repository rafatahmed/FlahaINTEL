# FlahaINGEST provider benchmark acceptance plan

## Corpus governance

Use checksummed, versioned, legally redistributable development and blind sets. Record fixture ID, language/direction, licence/source, SHA-256, media type, size, pages/rows, expected features, ground-truth method and adversarial flags.

Minimum development and blind counts are each: 20 English digital PDFs, 20 Arabic digital PDFs, 20 English scans, 20 Arabic scans, 15 mixed RTL/LTR documents, 20 table-heavy PDFs, 15 rotated/skewed documents, 20 malformed/encrypted/active documents, 25 static HTML pages, 20 Arabic/mixed HTML pages, 15 JavaScript-heavy pages, 15 each CSV/JSON/Excel/Parquet datasets, and 40 adversarial fixtures.

## Acceptance thresholds

Thresholds apply per stratum; aggregate performance cannot hide Arabic, scanned, table, or adversarial failures.

| Metric | Required threshold |
| --- | --- |
| English digital text | CER <= 1%, WER <= 2% |
| Arabic digital text | CER <= 2%, WER <= 5% |
| English scanned OCR | median CER <= 4%, p95 document CER <= 8% |
| Arabic scanned OCR | median CER <= 8%, p95 document CER <= 15% |
| Mixed direction | segment CER <= 8%, direction accuracy >= 98% |
| Reading order | pairwise F1 >= 0.95 digital, >= 0.90 scanned |
| Heading hierarchy | F1 >= 0.95 digital, >= 0.88 scanned |
| Table structure | TEDS/equivalent >= 0.90 digital, >= 0.80 scanned |
| HTML main content | precision/recall >= 0.95 static, >= 0.93 Arabic, >= 0.90 rendered fallback |
| Dataset fidelity | 100% columns; >= 99.99% valid values; exact row accounting |
| Determinism | byte-identical normalized output/manifest/warning codes over 3 runs |
| Offline | 100% offline-capable fixtures; zero DNS/socket/download attempts |
| Warning quality | zero silent malformed acceptance or secret leakage; false ERROR <= 1% |

Reference budgets: 10-page digital PDF <= 2 GiB and p95 60 s; 10-page 300-DPI scan <= 4 GiB and p95 180 s; static HTML <= 512 MiB and p95 10 s; rendered page <= 1.5 GiB and p95 30 s; 1 GiB dataset <= 4 GiB and p95 300 s. Disk amplification limits are respectively 5x+100 MiB, 15x+250 MiB, 3x+10 MiB, 100 MiB/page, and 2.5x+1 GiB temporary.

Cancellation acknowledgement must be p95 <= 1 s, graceful completion p95 <= 10 s, forced process-tree termination <= 15 s, and leave zero promoted artifacts or child processes. Crash detection is <= 2 heartbeat intervals; lease recovery is <= expiry plus one poll interval. No duplicate/late terminal result or partial promotion may be accepted, and reconciliation must resolve every injected crash case.

Benchmarks run on a documented Windows reference machine with hardware, software, cache, power and antivirus conditions recorded. Provider adoption also requires exact licence, package, binary and model inventory.
