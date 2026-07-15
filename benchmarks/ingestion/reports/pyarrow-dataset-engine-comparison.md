<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: PyArrow Dataset Engine Comparison
Introduction:
Compares governed PyArrow evidence with stdlib, pandas, and Polars evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# PyArrow dataset engine comparison

| Dimension | stdlib | pandas 2.3.3 | Polars 1.42.1 | PyArrow 25.0.0 |
| --- | --- | --- | --- | --- |
| Strict preflight | Authoritative | Must precede | Must precede | Must precede |
| Governed correctness | Reference | Correct after preflight | Correct after preflight | Correct after preflight |
| CSV incremental API | Row iterator | `chunksize` | streaming collect | `open_csv` batches |
| Native JSON | stdlib JSON/JSONL | JSON/JSONL | JSON/JSONL | JSONL only |
| 100k wall evidence | 2.83–3.10 s pandas comparison path | 2.83–3.10 s | 3.84–5.53 s | 4.40–5.06 s |
| Reliable total memory | No | No | No | No; Arrow pool only |
| Current role | Strict validator | Fallback | Candidate | Canonical columnar candidate |

Timing methods and execution paths differ, so the table does not establish fair
engine superiority. PyArrow matched governed hashes and offered a real batch
reader, but Python normalization dominated and retained all normalized output.
It was slower than the accepted pandas evidence and overlaps the Polars range;
neither comparison supports replacement. pandas remains **ADOPT AS FALLBACK**,
the stdlib validator remains **ADOPT**, and PyArrow requires technical hardening
before any production or bounded-memory claim.

Separate decisions: governed engine **REQUIRES TECHNICAL HARDENING**; eager CSV
**BENCHMARK FURTHER**; incremental CSV **REQUIRES TECHNICAL HARDENING**; JSONL
**BENCHMARK FURTHER**; native ordinary JSON **REJECT**; schema/type engine
**BENCHMARK FURTHER**; decimal handling **REQUIRES TECHNICAL HARDENING**;
large-file engine **BENCHMARK FURTHER**; bounded-memory processing **REQUIRES
TECHNICAL HARDENING**; pandas replacement **DEFER**; comparison with Polars
**BENCHMARK FURTHER**; isolated environment **ADOPT**.
