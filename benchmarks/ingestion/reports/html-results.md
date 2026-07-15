<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed HTML Extraction Results
Introduction:
Records correctness, determinism, encoding, and extraction findings by candidate.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-16
-->

# Governed HTML extraction results

Run `20260715T031521Z-4fb2b452` produced 93 results: 31 fixtures for each of
stdlib HTMLParser, lxml 6.1.1, and selectolax Lexbor 0.4.10. Each case ran twice.
There were zero determinism mismatches, 89 successful results, and four intentional
quarantines. Invalid UTF-8 was `UNDECODABLE_INPUT` for all candidates. Lexbor also
classified the 520-level fixture `DOM_LIMIT_EXCEEDED`; lxml and stdlib recovered it
below the post-parse depth ceiling due to their own tree construction behavior.

All candidates passed the independent required-span and prohibited-boilerplate
checks on every successfully classified fixture: English 22/22 for stdlib and lxml
and 21/21 plus one depth quarantine for Lexbor; Arabic 4/4 each; bilingual 3/3 each.
The empty undetermined-language page passed and invalid UTF-8 was quarantined.
Arabic code points and paragraph order were preserved. NFC comparison normalized
combining marks while raw input retained NBSP and original bytes.

Shared metadata, ordered links, table rows/spans, and JSON-LD results use distinct
sections. All candidates agreed exactly on content and metadata for 28 corpus items.
The remaining differences are exposed rather than averaged: malformed-tree
recovery, implied HTML elements, parser warnings, duplicate-attribute retention, and
the explicit Lexbor depth rejection. Invalid JSON-LD produces a stable warning. No
URL resolution occurs.

The explicit lxml strict probe classified the malformed fixture as
`MALFORMED_INPUT`; recovery mode produced the governed visible text with a stable
`PARSER_RECOVERY_USED` warning. Recovery is therefore observable rather than silent.

Each machine result records candidate/version, mode, source file/hash, selected
encoding/reason, warnings, normalized document/content/links/tables/structured-data/
DOM/evidence sections, canonical hash, adapter phase timings, cold-process wall time,
and normalized output bytes. Cold-process median wall times were 79.47 ms for stdlib,
104.89 ms for lxml, and 120.95 ms for selectolax. Process startup dominates these
small fixtures, so these numbers are not parser-throughput claims.

Trafilatura main-content extraction was not run because Gate C requires licence
review. Consequently, this gate does not establish a production main-content engine.

The final acceptance audit used accepted earlier full-suite evidence for unchanged
suites where its restricted sandbox denied temporary-file creation or child-process
spawning with `PermissionError` or `EPERM`. It did not claim a fresh successful
Vite/Vitest rerun. Fresh HTML, corpus, correctness, determinism, security, encoding,
JSON/JSONL, ownership, scope, diff, process, and port checks passed.
