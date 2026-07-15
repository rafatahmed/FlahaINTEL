<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Polars 1.42.1 Benchmark Results
Introduction:
Records governed correctness, execution-mode, resource, and security findings.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Polars 1.42.1 benchmark results

Two governed runs each produced 13 results with zero comparison failures, zero
determinism failures, and zero eager/lazy/streaming hash mismatches. CSV uses
`polars.read_csv`; lazy uses `polars.scan_csv(...).collect(engine="auto")`; actual
streaming uses `polars.scan_csv(...).collect(engine="streaming")`. JSON uses a strict
stdlib JSON decode followed by `polars.DataFrame`; JSONL uses `polars.read_ndjson`.

The mandatory stdlib CSV validator runs first and blocks malformed rows, quoting,
encoding, NUL, size, field, column, and delimiter failures before Polars. Valid CSV,
JSON, and JSONL match the stdlib semantic baseline. Arabic, nulls, mixed values,
duplicates, leading zeroes, exact decimal strings, and row ordering are preserved.
Strict schema rejects column or value disagreement. Inference records Polars schema
and bounded samples without granting authority.

The 10k input is 803,857 bytes; the 100k input is 8,137,919 bytes. Across two
process-sampled runs, 10k eager was 1.11–1.18 s, lazy 1.21–1.29 s, and streaming
1.25–1.26 s. For 100k, eager was 4.68–4.73 s, lazy 3.84–4.71 s, and streaming
4.60–5.53 s. Internal 100k collection was only 18–25 ms; converting every value to
Python objects and canonical JSON took 1.36–1.89 s. All mode hashes matched.

Windows process sampling reported about 4.0 MB peak working set when available, but
CPU values were zero or null and are not reliable. Sampling launches PowerShell and
distorts short timings. All outputs are fully collected and retained for hashing, so
these results do not prove bounded end-to-end streaming memory. The optional 500k
case was skipped because 10k/100k met this gate and more data would not repair the
measurement limitation.

Security boundaries reject URLs, absolute paths, traversal, symlink escape, and
unsupported extensions. The adapter has no SQL, database, shell, remote filesystem,
or arbitrary code execution path. It emits strict finite JSON, sanitizes diagnostics,
uses no network, and writes only to its allocated ignored run root.
