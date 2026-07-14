<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Dataset Policy Benchmark Results
Introduction:
Records strict validation, dtype governance, comparisons, and adoption decisions.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Dataset policy benchmark results

The streaming standard-library pre-validator accepts governed UTF-8 and Arabic CSV
and deterministically rejects inconsistent fields, misplaced or unterminated quotes,
NUL bytes, invalid UTF-8, oversized rows or fields, excess columns, and delimiter
ambiguity. It blocks the Phase 3E-B malformed CSV before pandas, eliminating silent
parser recovery. The validator intentionally forbids embedded physical newlines.

`STRICT_SCHEMA` enforces exact ordered columns and explicit conversion; exact decimal
spelling is preserved as a string, invalid integer/boolean values fail, and missing or
extra columns fail. `INFER_WITH_EVIDENCE` records raw pandas dtype and bounded samples
without granting authority. `TEXT_PRESERVING` preserves Arabic and leading zeroes and
uses governed null tokens. Duplicate rows and ordering remain intact.

Isolated small-format runs covered CSV, JSON, JSONL, malformed JSON/JSONL, Arabic,
nulls, duplicates, and full/chunked CSV twice. Each run produced eight results, zero
determinism failures, matching chunk hashes, and the known raw pandas malformed-CSV
comparison mismatch. The governed policy path blocks that mismatch before pandas.

## Decisions

- pandas as compatibility engine: **ADOPT AS FALLBACK** for bounded CSV/JSON/JSONL.
- pandas as strict governed ingestion engine: **REQUIRES TECHNICAL HARDENING**;
  adoption depends on mandatory pre-validation and schema/policy integration.
- pandas for large files: **BENCHMARK FURTHER** beyond 100k rows and for true bounded
  memory transformations.
- stdlib CSV validation layer: **ADOPT** for the governed strict preflight.
- dedicated virtual environment strategy: **ADOPT** as the reproducible worker
  runtime pattern, while production engine registration remains out of scope.

Gate 3E-C is recommended for acceptance as a benchmark and policy gate, subject to
the documented CPU-counter and large-scale memory limitations. It does not adopt or
register a production dataset engine.
