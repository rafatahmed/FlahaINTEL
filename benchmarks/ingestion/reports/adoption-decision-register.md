<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Ingestion Engine Adoption Decision Register
Introduction:
Tracks benchmark state separately from any future production adoption decision.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-08-19
-->

# Adoption decision register

**Operate supersession (2026-08-19):** production routing uses Apache Tika for PDF/DOCX/RTF/TXT text. Docling is REJECTED for operate and must not be restored. Structured PDF later is MinerU under a new approved gate. Rows below remain the original benchmark record.

| Candidate | Benchmark state | Adoption status | Basis |
| --- | --- | --- | --- |
| Python stdlib HTML | Benchmarked on 31 fixtures | ADOPT | Governed benchmark baseline only; no production routing |
| lxml 6.1.1 | Benchmarked in isolation | REQUIRES TECHNICAL HARDENING | Correct and deterministic; native deployment and supervisor resource limits remain |
| selectolax 0.4.10 | Benchmarked in isolation | REQUIRES TECHNICAL HARDENING | Lexbor correct and deterministic in scope; native deployment and depth behavior remain |
| Python csv/json/jsonl | Benchmarked | ADOPT AS BENCHMARK BASELINE | Dependency-free reference, not full dataset engine |
| Docling Slim 2.111.0 — English PDF text/layout/sections/tables | Comparative benchmark passed | ADOPT AS PRIMARY | Benchmark architecture only; corrected offline lock, local models, correctness and determinism passed; no production registration |
| Docling Slim 2.111.0 — Arabic/bilingual extraction | Governed extraction failed | REJECT | Arabic logical order is invalid; unsupported/manual-review classification required |
| Apache Tika 3.3.1 — PDF and DOCX/PPTX/RTF/text fallback | Comparative benchmark passed | ADOPT AS FALLBACK | Benchmark architecture only; broad-format evidence passed with PARTIAL cache/temp containment and LIMITED resources |
| Apache Tika 3.3.1 — Arabic/bilingual extraction | Governed extraction failed | REJECT | Undecodable glyph output; unsupported/manual-review classification required |
| pdfminer.six 20260107 — general extraction | Arabic-first fast gate stopped | REJECT | Governed Arabic CID glyphs were undecodable |
| pdfminer.six 20260107 — Arabic extraction | Governed rejection evidence retained | REJECT | No CID repair or candidate-specific correction is authorized |
| pypdf 6.14.2 — general PDF text extraction | Stopped on governed Arabic correctness failure | REJECT | Logical Arabic `الزراعة` was extracted as reversed Unicode `ةعارزلا` |
| pypdf 6.14.2 — Arabic extraction | Governed rejection evidence retained | REJECT | Arabic logical order is invalid; ground truth and output were not rewritten |
| pypdf 6.14.2 — narrow inspection/metadata role | Partial evidence only | BENCHMARK FURTHER | Full metadata, action, and embedded-file benchmark did not complete |
| Embedded-content inventory | Synthetic marker evidence only | BENCHMARK FURTHER | Populated attachment streams and realistic embedded content were not tested |
| Malformed/encrypted document handling | Bounded policy and supervision passed | REQUIRES TECHNICAL HARDENING | Broader hostile realism and production containment remain incomplete |
| Large-document processing | Bounded page/size rejection passed | BENCHMARK FURTHER | Maximum-scale and peak resource evidence are limited |
| Production document provider | Comparative benchmark only | DEFER | Production registration is not authorized |
| Tesseract OCR | Not installed; benchmark pending | DEFER | Executable and language-data approval required |
| PaddleOCR | Not installed | DEFER | Explicit later approval and model/runtime review required |
| Trafilatura 2.1.0 | Resolver-audited; not installed | DEFER | `tld` dependency licence expression requires business/legal review |
| pandas 2.3.3 | Benchmarked | BENCHMARK FURTHER | Correct governed values except malformed CSV recovery; current user-site install is unavailable under Phase 3D `-I` isolation |
| Polars 1.42.1 | Benchmarked | REQUIRES TECHNICAL HARDENING | Correct behind strict validation; lazy/streaming hashes match, but full materialization, resource evidence, and native deployment need hardening |
| PyArrow 25.0.0 | Benchmarked | REQUIRES TECHNICAL HARDENING | Correct eager/threaded/batch hashes behind strict validation; normalized rows remain retained and total memory is unproven |
| DuckDB 1.5.4 | Benchmarked | REQUIRES TECHNICAL HARDENING | Exact-path and extension/remote denial passed; governed hashes match, but total-memory, timezone, and production isolation remain unproven |
| Scrapy 2.17.0 — static acquisition/crawling | Comparative and offline-reconstruction closure passed | ADOPT AS PRIMARY | Deterministic raw bytes, governed links, robots, redirects, hashed offline rebuild and process-tree resources passed; no production registration |
| Playwright 1.61.1 / Chromium 149.0.7827.55 — dynamic rendering | Comparative, containment and offline-reconstruction closure passed | ADOPT AS FALLBACK | Rendered DOM, network interception, download/popup containment, five-process sampling and local archive restoration passed; static-default use is not justified |
| Production crawler provider | Comparative benchmark only | DEFER | Provider registration, wider adversarial coverage and supervisor resource enforcement are not authorized in Phase 3E-J |
| Production browser provider | Comparative benchmark only | DEFER | Windows sandbox limitation, process-tree enforcement, resource instrumentation and production integration require technical hardening |

No candidate is registered with production dispatch, and no reputation-based
quality score or adoption recommendation is recorded.
