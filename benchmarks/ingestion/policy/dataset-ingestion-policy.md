<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Dataset Ingestion Policy
Introduction:
Defines bounded, deterministic, quarantine-first dataset ingestion governance.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Dataset ingestion policy

Supported benchmark formats are CSV, JSON, and JSONL. CSV is UTF-8 with an optional
leading UTF-8 BOM, LF or CRLF physical records, comma delimiter, RFC-style doubled
quotes, and no escape character. Embedded record newlines, delimiter ambiguity,
invalid UTF-8, NUL bytes, or malformed quoting require quarantine before pandas.

Default limits are 1 GiB per file, 10,000,000 records, 512 columns, 1 MiB per
physical CSV row or JSONL line, 256 Ki characters per field, and JSON nesting depth
64. Lower `PolicySnapshot` limits always prevail. Processing must stream validation,
enforce cancellation and disk headroom, and avoid unbounded copies. Workloads over
100,000 rows require measured process limits; over 1 GiB, nested JSON, unsupported
formats, or workloads that cannot meet memory limits require a fallback engine.

Duplicate records are preserved and identified, never silently removed. Malformed
records are not skipped or repaired. JSON rejects NaN and Infinity. Null tokens are
declared per dataset; the defaults are empty, `null`, and `NULL`, never arbitrary
truth-like values. Timestamps must be declared ISO 8601; UTC values use `Z`.
Exact decimals remain decimal strings. Binary floats are permitted only when the
precision tradeoff is declared. Categorical dictionaries are evidence, not identity.

Text is preserved as received in NFC-compatible Unicode without lossy transliteration;
normalization is recorded and never silently applied to identifiers. Arabic code
points and RTL ordering must survive round trips. Output uses stable column and row
order, canonical JSON serialization, and SHA-256 evidence.

Warnings are `INFERENCE`, `PRECISION`, `RESOURCE`, or `COMPATIBILITY`. Errors are
`POLICY`, `MALFORMED`, `SCHEMA`, `RESOURCE`, or `ENGINE`. Malformed syntax, policy
overflow, ambiguous delimiter, invalid encoding, schema disagreement, or incomplete
processing causes quarantine. Processing success remains separate from approval.

CSV validation by the standard library is mandatory before pandas. pandas is a
compatibility engine for bounded CSV/JSON/JSONL. A different engine is required for
larger-than-policy inputs, true bounded-memory transformation, Parquet/Excel, nested
JSON governance, or resource behavior that fails the acceptance thresholds.
