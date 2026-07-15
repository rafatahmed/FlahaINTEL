<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Candidate Engine Register
Introduction:
Records purpose, availability, licensing posture, prerequisites, strengths, and risks.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Candidate engine register

Licence entries follow the approved Phase 3A assessment and must be verified
against the exact pinned release before installation or redistribution.

| Candidate | Purpose / implementation | Availability | Licence posture | Models and runtime | Strengths | Risks / status |
| --- | --- | --- | --- | --- | --- | --- |
| Docling | Document/PDF conversion; Python | Not installed | MIT, verify release | Python plus document/OCR models | Rich structure and layout | Large models/resources; benchmark pending |
| Apache Tika | Broad document extraction; Java | Not installed; Java absent | Apache-2.0 | Pinned JRE and Tika binary/serverless CLI | Broad formats and metadata | Java surface, PDF layout quality; pending |
| Tesseract OCR | Offline OCR; C++ CLI | Not installed | Apache-2.0 | Executable plus pinned `eng`/`ara` trained data | Mature offline baseline | Arabic/layout quality and packaging; pending |
| PaddleOCR | OCR candidate; Python/native | Not installed | Apache-2.0, verify models | Large framework and model downloads | Potential multilingual/layout quality | Deferred until explicit approval |
| Python stdlib HTML | Measurement baseline; Python | Available | Python licence | None | Offline, deterministic, tiny | Not production article extraction; benchmarked |
| Trafilatura | Main-content extraction; Python | Not installed | GPL-3.0-or-later per approved Phase 3A; legal review required | Python dependency graph | Article-focused extraction | GPL/commercial redistribution decision; pending |
| Python csv/json | Dataset baseline; Python | Available | Python licence | None | Deterministic streaming CSV/JSONL primitives | Limited typing/formats; benchmarked |
| pandas | Dataset compatibility; Python/native | Benchmarked 2.3.3 with NumPy 2.3.5 | BSD-3-Clause installed metadata | Per-user binary wheels; optional format packages absent | Unicode, nulls, duplicates, chunked CSV | Malformed CSV recovery, inference, memory, and `-I` isolation risk; benchmark further |
| Polars | Dataset transformation; Rust/Python | Benchmarked 1.42.1 in isolated environment | MIT | Native `polars-runtime-32` wheel | Correct governed eager/lazy/streaming output | Full normalization dominates; native CPU/deployment and larger-scale memory require hardening |
| PyArrow | Columnar interchange; C++/Python | Benchmarked 25.0.0 in isolated environment | Apache-2.0 | Self-contained native wheel; zero Python runtime dependencies | Correct governed table/batch output and Arrow/Parquet interoperability | Python normalization retention, native deployment, memory evidence, and JSON-array limitation require hardening |
| DuckDB | Governed in-process query; C++/Python | Benchmarked 1.5.4 in isolated environment | MIT | Self-contained native wheel; zero mandatory Python dependencies | Exact-path scans, fixed queries, explicit ordering | SQL surface, total-memory evidence, timezone conversion, and production isolation require hardening |

All candidates must produce contract-representable provider-neutral outputs and
run beneath the Phase 3D stdio supervisor before adoption can be considered.
