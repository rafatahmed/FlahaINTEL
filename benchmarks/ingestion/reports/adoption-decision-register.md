<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Ingestion Engine Adoption Decision Register
Introduction:
Tracks benchmark state separately from any future production adoption decision.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Adoption decision register

| Candidate | Benchmark state | Adoption status | Basis |
| --- | --- | --- | --- |
| Python stdlib HTML | Benchmarked | BENCHMARK FURTHER | Baseline only; inadequate evidence for production |
| Python csv/json/jsonl | Benchmarked | ADOPT AS BENCHMARK BASELINE | Dependency-free reference, not full dataset engine |
| Docling | Not installed; benchmark pending | DEFER | Installation/model approval required |
| Apache Tika | Not installed; benchmark pending | DEFER | Java and pinned binary approval required |
| Tesseract OCR | Not installed; benchmark pending | DEFER | Executable and language-data approval required |
| PaddleOCR | Not installed | DEFER | Explicit later approval and model/runtime review required |
| Trafilatura | Not installed; benchmark pending | LEGAL REVIEW REQUIRED | GPL posture requires explicit legal/architecture decision |
| pandas 2.3.3 | Installed; not benchmarked | BENCHMARK FURTHER | Existing availability is not an adoption decision |
| Polars | Not installed; benchmark pending | DEFER | Pinned wheel approval required |
| PyArrow | Not installed; benchmark pending | DEFER | Pinned large wheel approval required |
| DuckDB | Not installed; benchmark pending | DEFER | Pinned wheel and extension controls required |

No candidate is registered with production dispatch, and no reputation-based
quality score or adoption recommendation is recorded.
