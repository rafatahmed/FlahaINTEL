<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Dataset Engine Comparison
Introduction:
Compares stdlib validation, pandas fallback, and the isolated Polars candidate.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Dataset engine comparison

| Dimension | stdlib | pandas 2.3.3 | Polars 1.42.1 |
| --- | --- | --- | --- |
| Strict CSV | Adopted first gate | Must follow gate | Must follow gate |
| Governed correctness | Reference | Matches except raw malformed recovery | Matches behind gate |
| Arabic/order/duplicates | Preserved | Preserved | Preserved |
| Exact decimal | Text baseline | Policy conversion required | Strict mode preserves text |
| Schema modes | Policy-owned | Implemented benchmark mode | Implemented benchmark mode |
| Lazy/streaming engine | No | Chunk parser only | Real lazy and streaming collection |
| Environment size | Built in | 137,543,338 bytes | 205,235,560 bytes |
| Native deployment | CPython | NumPy/pandas wheels | Rust/SIMD runtime wheel |
| Supervisor `-I` | Compatible | Compatible dedicated venv | Compatible dedicated venv |

Polars' internal parsing/collection is fast, but governed Python-object normalization
dominates this workload. The end-to-end Polars process-sampled rates are not a fair
claim of superiority over earlier pandas figures because the Windows sampler changed
and materially distorts short processes. At 10k Polars was not materially faster; at
100k the recorded end-to-end rate was also not faster. Lazy or streaming did not show
a stable wall-time advantage, and full materialization prevents a memory conclusion.

Decisions: Polars governed engine **REQUIRES TECHNICAL HARDENING**; large-file engine
**BENCHMARK FURTHER**; lazy/streaming engine **BENCHMARK FURTHER**; pandas replacement
**DEFER**; pandas remains **ADOPT AS FALLBACK**; stdlib strict validation remains
**ADOPT**; isolated Polars environment pattern is **ADOPT** for benchmarking only.
