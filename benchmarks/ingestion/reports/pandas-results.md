<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Pandas 2.3.3 Benchmark Results
Introduction:
Records governed pandas dataset findings, comparisons, risks, and disposition.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Pandas 2.3.3 benchmark results

## Identity and installation

- Python: `C:\Python314\python.exe`, CPython 3.14.0
- pandas: 2.3.3, `<user-site>/pandas/__init__.py`
- NumPy: 2.3.5, `<user-site>/numpy/__init__.py`
- Installation: per-user site, not global and not a virtual environment
- Installed licence metadata: BSD 3-Clause; licence file present
- PyArrow, openpyxl, numexpr, bottleneck, SciPy, PyTables, XlsxWriter: absent

The pandas package plus metadata occupies approximately 67.6 MB. NumPy, metadata,
and native libraries occupy approximately 54.8 MB. Normal user-site cold imports
measured 424–439 ms. Under the Phase 3D supervisor's `python -I` isolation,
pandas is not importable because user-site packages are intentionally excluded.

## Results

Two required benchmark runs plus a final evidence run each produced eight results:
seven full-load dataset cases and one additional `chunksize=64` streaming case.
Every normalized result was deterministic across its two internal attempts.

| Case | pandas behavior | stdlib comparison |
| --- | --- | --- |
| Valid CSV | 3 rows; values and null preserved after semantic normalization | Match |
| Valid JSON | Arabic, null, mixed numeric/object values, and duplicate row preserved | Match |
| Valid JSONL | 2 rows and Arabic preserved | Match |
| Malformed CSV | Silently recovered one shifted row despite `on_bad_lines="error"` | Mismatch; stdlib rejected |
| Malformed JSON | Rejected with sanitized `ValueError` | Match |
| Malformed JSONL | Rejected with sanitized `ValueError` | Match |
| Streaming CSV full load | 256 rows | Match |
| Streaming CSV chunksize 64 | 256 rows; same normalized-record SHA-256 as full load | Match |

The malformed CSV recovery is an important type/parser-risk finding. The adapter
classifies it `RECOVERED_MALFORMED_INPUT`; it never silently promotes the result
to governed success.

## Timing and memory

Across representative warm in-process runs, valid CSV took about 2.7–3.0 ms,
JSON 2.5–2.9 ms, and JSONL 1.45–1.65 ms. The 256-row full load took about
2.1–2.4 ms; chunksize mode took about 3.7–5.0 ms. These tiny inputs do not support
large-scale throughput claims. Chunking preserved output but was slower here.

Peak memory remains `null`: Python-only measurement cannot reliably capture all
NumPy native allocations. Full load is in-memory. `chunksize` bounds parsing
batches, but concatenating them for governed comparison reconstructs a full frame,
so this benchmark does not claim end-to-end streaming memory bounds.

## Security and operational assessment

The adapter accepts only relative local `.csv`, `.json`, and `.jsonl` paths under
the governed corpus root. It exposes no pickle, eval, query-expression, SQL,
database, URL, remote filesystem, arbitrary deserialization, shell, or subprocess
path. Outputs remain under an allocated run root; JSON forbids NaN and Infinity.

pandas is commercially usable under BSD-3-Clause, mature, offline-capable with
pinned wheels, and Windows/Linux compatible. Its NumPy dependency, binary-wheel
footprint, inference behavior, in-memory model, and current incompatibility with
the Phase 3D isolated interpreter require technical hardening before adoption.

## Decision

Status: **BENCHMARK FURTHER**. Do not adopt pandas as a universal dataset engine.
It remains a plausible compatibility candidate after an approved isolated Python
environment, explicit schema/dtype policies, stricter malformed-CSV preflight,
and larger resource benchmarks.
