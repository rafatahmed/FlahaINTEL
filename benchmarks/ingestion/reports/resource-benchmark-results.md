<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Dataset Resource Benchmark Results
Introduction:
Summarizes deterministic synthetic dataset throughput and process measurements.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Dataset resource benchmark results

Generated ignored inputs are deterministic: 10,000 rows, 803,857 bytes,
SHA-256 `d78862966a8ff02f60ca7c3713eff48455e49baf402de46497f1f48770bbd95d`;
100,000 rows, 8,137,919 bytes, SHA-256
`a12590d8330e280d357b94e14b9b599b94b6ca9f0996ccc465149f5154a1ab5e`.
They contain alternating English/Arabic, integers, exact decimal spellings, floats,
booleans, nulls, UTC timestamps, repeated values, and bounded text. 500,000 rows was
not run because it is optional and 10k/100k answer this gate without extra disk use.

Across the two comparable unsampled evidence runs, 10k full load took 0.65–0.68 s
(14.8k–15.3k rows/s), and chunksize 4096 took 0.70–0.74 s (13.6k–14.3k rows/s).
100k full load took 2.83–2.88 s (34.7k–35.3k rows/s), and chunks took 3.02–3.10 s
(32.3k–33.1k rows/s). Full and chunked normalized hashes matched at both scales,
with zero determinism mismatches. Chunking did not provide an end-to-end memory bound
because the benchmark adapter concatenates chunks for governed comparison.

Windows `Get-Process` sampling reported a peak working set of 4,071,424 bytes for a
representative 100k run, wall time 2.98 s, exit 0, and zero stderr. CPU accounting
returned 0 and is classified unavailable rather than treated as a valid measurement.
The separate Python/PowerShell sampling harness materially increases short-run wall
time; unsampled runs are therefore used for throughput and the OS counter only for
the measured working-set field. Larger sustained resource tests remain necessary.
