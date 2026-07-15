<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Candidate Engine Register
Introduction:
Records purpose, availability, licensing posture, prerequisites, strengths, and risks.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-16
-->

# Candidate engine register

Licence entries follow the approved Phase 3A assessment and must be verified
against the exact pinned release before installation or redistribution.

| Candidate | Purpose / implementation | Availability | Licence posture | Models and runtime | Strengths | Risks / status |
| --- | --- | --- | --- | --- | --- | --- |
| Docling Slim 2.111.0 | English PDF text, layout, sections and tables; Python | Controlled 75-wheel offline benchmark runtime validated | MIT package; local model licences separately locked | Local non-OCR layout and TableFormer models | Primary benchmark-architecture candidate for English PDF structure | Arabic/bilingual REJECT; heavy runtime; production provider DEFER |
| Apache Tika 3.3.1 | Broad document fallback; portable Java | Controlled portable Temurin 21.0.11+10 runtime validated | Apache-2.0 with contained third-party notices | Fixed shaded JAR; no server or external executable | Benchmark fallback for PDF, DOCX, PPTX, RTF and text | Arabic/bilingual REJECT; cache/temp containment PARTIAL; production provider DEFER |
| pdfminer.six 20260107 | PDF text candidate; Python | Fast gate completed and stopped | MIT | Isolated pure-Python/runtime dependency set | Lightweight text inspection only | General extraction REJECT; Arabic extraction REJECT |
| pypdf 6.14.2 | Narrow PDF inspection/metadata candidate; Python | Isolated benchmark runtime validated; candidate rejected for general text | BSD-3-Clause | Pure Python wheel; optional crypto/image extras excluded | Potential narrow inspection role requires further benchmarking | General PDF text extraction: REJECT; Arabic extraction: REJECT; production document extractor: REJECT |
| Tesseract OCR | Offline OCR; C++ CLI | Not installed | Apache-2.0 | Executable plus pinned `eng`/`ara` trained data | Mature offline baseline | Arabic/layout quality and packaging; pending |
| PaddleOCR | OCR candidate; Python/native | Not installed | Apache-2.0, verify models | Large framework and model downloads | Potential multilingual/layout quality | Deferred until explicit approval |
| Python stdlib HTML | Measurement baseline; Python | Benchmarked on 31 fixtures | Python licence | None | Offline, deterministic, tiny | Governed baseline only; not production article extraction |
| lxml | Controlled HTML DOM; C/Python | Benchmarked 6.1.1 in isolation | BSD-3-Clause | Native wheel; bundled libxml2/libxslt | Deterministic recovery and DOM reference | Native/supervisor hardening; XML APIs excluded |
| selectolax | Fast HTML DOM; Cython/native | Benchmarked 0.4.10 in isolation | MIT | Lexbor primary; Modest present but unused | Deterministic governed extraction | Native/supervisor hardening and depth behavior |
| Trafilatura | Main-content extraction; Python | Resolver-audited; not installed | Apache-2.0 package; dependency set needs review | 18 mandatory resolved wheels | Article-focused extraction | `tld` disjunctive MPL/GPL/LGPL expression blocks installation |
| Python csv/json | Dataset baseline; Python | Available | Python licence | None | Deterministic streaming CSV/JSONL primitives | Limited typing/formats; benchmarked |
| pandas | Dataset compatibility; Python/native | Benchmarked 2.3.3 with NumPy 2.3.5 | BSD-3-Clause installed metadata | Per-user binary wheels; optional format packages absent | Unicode, nulls, duplicates, chunked CSV | Malformed CSV recovery, inference, memory, and `-I` isolation risk; benchmark further |
| Polars | Dataset transformation; Rust/Python | Benchmarked 1.42.1 in isolated environment | MIT | Native `polars-runtime-32` wheel | Correct governed eager/lazy/streaming output | Full normalization dominates; native CPU/deployment and larger-scale memory require hardening |
| PyArrow | Columnar interchange; C++/Python | Benchmarked 25.0.0 in isolated environment | Apache-2.0 | Self-contained native wheel; zero Python runtime dependencies | Correct governed table/batch output and Arrow/Parquet interoperability | Python normalization retention, native deployment, memory evidence, and JSON-array limitation require hardening |
| DuckDB | Governed in-process query; C++/Python | Benchmarked 1.5.4 in isolated environment | MIT | Self-contained native wheel; zero mandatory Python dependencies | Exact-path scans, fixed queries, explicit ordering | SQL surface, total-memory evidence, timezone conversion, and production isolation require hardening |

All candidates must produce contract-representable provider-neutral outputs and
run beneath the Phase 3D stdio supervisor before adoption can be considered.
