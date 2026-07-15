<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Dataset Engine Comparison
Introduction:
Separates governed DuckDB benchmark findings from production adoption decisions.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# DuckDB dataset engine comparison

DuckDB matched accepted normalized hashes for the governed 10k and 100k datasets.
Its post-hardening 100k wall times were 3.69–3.82 seconds, compared with accepted pandas
2.83–3.10, Polars 3.84–5.53, and PyArrow 4.40–5.06 second ranges. These are not
engine-superiority claims: instrumentation, execution plans, result-transfer paths,
and internal metrics differ, while Python normalization dominates substantial work.

| Decision | Status | Basis |
| --- | --- | --- |
| Isolated environment | ADOPT | Exact pinned one-wheel environment passed retained Gate A validation. |
| Security boundary | REQUIRES TECHNICAL HARDENING | Governed fixed boundary passed; not an OS sandbox or untrusted-SQL boundary. |
| Exact-path file access | ADOPT | One canonical path works with external access disabled; sibling and broader scope denied. |
| Extension isolation | ADOPT | Install, load, autoload, community, and unsigned paths denied and locked. |
| External-access isolation | ADOPT | Remote schemes and external attachment denied. |
| CSV ingestion | BENCHMARK FURTHER | Correct behind authoritative stdlib validation. |
| JSON ingestion | BENCHMARK FURTHER | Correct for governed ordinary JSON corpus. |
| JSONL ingestion | BENCHMARK FURTHER | Correct for governed newline-delimited corpus. |
| Schema/type engine | REQUIRES TECHNICAL HARDENING | Timezone-aware Python conversion needs an optional package; governed mapping avoids it. |
| Ordering strategy | ADOPT | Explicit ordinal and ordering matched across fetch and thread modes. |
| Batch fetching | BENCHMARK FURTHER | Correct but all normalized rows remain retained. |
| Large-file processing | BENCHMARK FURTHER | Only 10k and 100k were authorized. |
| Bounded-memory processing | REQUIRES TECHNICAL HARDENING | Buffer limit and batch fetch do not bound total process memory. |
| Governed dataset engine | REQUIRES TECHNICAL HARDENING | Strong security/correctness evidence, but production routing is unapproved. |
| pandas replacement | DEFER | No replacement decision is justified. |
| Compared with Polars | BENCHMARK FURTHER | Equivalent hashes; measurement differences prevent ranking. |
| Compared with PyArrow | BENCHMARK FURTHER | Equivalent hashes; Arrow integration was intentionally absent. |
| pandas fallback | ADOPT AS FALLBACK | Accepted fallback remains unchanged. |
| stdlib strict validator | ADOPT | Remains authoritative before DuckDB. |

DuckDB is benchmark-only and is not registered with production dispatch.
