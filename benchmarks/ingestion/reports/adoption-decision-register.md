<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Ingestion Engine Adoption Decision Register
Introduction:
Tracks benchmark state separately from any future production adoption decision.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-16
-->

# Adoption decision register

| Candidate | Benchmark state | Adoption status | Basis |
| --- | --- | --- | --- |
| Python stdlib HTML | Benchmarked on 31 fixtures | ADOPT | Governed benchmark baseline only; no production routing |
| lxml 6.1.1 | Benchmarked in isolation | REQUIRES TECHNICAL HARDENING | Correct and deterministic; native deployment and supervisor resource limits remain |
| selectolax 0.4.10 | Benchmarked in isolation | REQUIRES TECHNICAL HARDENING | Lexbor correct and deterministic in scope; native deployment and depth behavior remain |
| Python csv/json/jsonl | Benchmarked | ADOPT AS BENCHMARK BASELINE | Dependency-free reference, not full dataset engine |
| Docling | Not installed; benchmark pending | DEFER | Installation/model approval required |
| Apache Tika | Not installed; benchmark pending | DEFER | Java and pinned binary approval required |
| pypdf 6.14.2 — general PDF text extraction | Stopped on governed Arabic correctness failure | REJECT | Logical Arabic `الزراعة` was extracted as reversed Unicode `ةعارزلا` |
| pypdf 6.14.2 — Arabic extraction | Governed rejection evidence retained | REJECT | Arabic logical order is invalid; ground truth and output were not rewritten |
| pypdf 6.14.2 — narrow inspection/metadata role | Partial evidence only | BENCHMARK FURTHER | Full metadata, action, and embedded-file benchmark did not complete |
| pypdf 6.14.2 — production document extractor | Candidate gate rejected | REJECT | Production registration is not authorized |
| Tesseract OCR | Not installed; benchmark pending | DEFER | Executable and language-data approval required |
| PaddleOCR | Not installed | DEFER | Explicit later approval and model/runtime review required |
| Trafilatura 2.1.0 | Resolver-audited; not installed | DEFER | `tld` dependency licence expression requires business/legal review |
| pandas 2.3.3 | Benchmarked | BENCHMARK FURTHER | Correct governed values except malformed CSV recovery; current user-site install is unavailable under Phase 3D `-I` isolation |
| Polars 1.42.1 | Benchmarked | REQUIRES TECHNICAL HARDENING | Correct behind strict validation; lazy/streaming hashes match, but full materialization, resource evidence, and native deployment need hardening |
| PyArrow 25.0.0 | Benchmarked | REQUIRES TECHNICAL HARDENING | Correct eager/threaded/batch hashes behind strict validation; normalized rows remain retained and total memory is unproven |
| DuckDB 1.5.4 | Benchmarked | REQUIRES TECHNICAL HARDENING | Exact-path and extension/remote denial passed; governed hashes match, but total-memory, timezone, and production isolation remain unproven |

No candidate is registered with production dispatch, and no reputation-based
quality score or adoption recommendation is recorded.
