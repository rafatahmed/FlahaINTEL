<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Ingestion Benchmark Methodology
Introduction:
Defines corpus design, expected outputs, scoring, measurement, and limitations.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Benchmark methodology

## Corpus and expected outputs

The corpus is repository-owned and synthetic: seven PDF/OCR cases, seven HTML
cases, and seven CSV/JSON/JSONL cases. Inputs are capped at 1 MiB. The manifest
records ownership, synthetic status, SHA-256, exact byte size, language, category,
expected-output reference, dimensions, dates, and limitations. Expected outputs
declare text, language, headings/tables/metadata, record counts, or deterministic
error classification as applicable.

## Quality and scoring

Mandatory gates are evaluated before the weighted model. Passing candidates are
scored quality 50%, operational suitability 25%, resource behavior 15%, and
determinism 10%. Metrics are dimension-specific: document structure and reading
order; OCR CER/WER and language/layout; HTML precision/recall and boilerplate;
dataset row/type/null/Unicode/malformed behavior. A missing measurement remains
unavailable rather than receiving a neutral score.

## Execution and reproducibility

Each immutable run records framework and engine versions, commit and dirty state,
UTC timestamp, redacted environment, invocation/configuration, model/language
data, input/output hashes, wall and CPU times, exit code, stdout/stderr sizes,
warnings, and classification. Each dependency-free operation executes twice and
compares normalized Python values. Result directories reject reuse.

The baselines use no network or database and create no listener. Safe relative
paths constrain corpus and output access. Commands are fixed by the framework;
there is no arbitrary shell command input.

## Performance limitations

Wall time uses `perf_counter_ns` and CPU time uses `process_time_ns`. They include
two determinism executions and are useful for regression, not cross-engine claims.
Peak memory is unavailable without a new dependency and is recorded as `null`.
Cold-start, package size, and subprocess isolation require later pinned adapters.

The stdlib HTML parser is intentionally a weak baseline, not a production-quality
article extractor. The dependency-free PDFs are structurally limited. The scan
is a placeholder and no OCR or document quality score is claimed in Phase 3E-A.
