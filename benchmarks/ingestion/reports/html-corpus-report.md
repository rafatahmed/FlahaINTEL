<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed HTML Corpus Report
Introduction:
Documents the synthetic HTML coverage, immutable bytes, and review expectations.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Governed HTML corpus report

The corpus contains 45 total governed items, including 31 HTML fixtures. The seven
pre-existing HTML files retain their exact bytes. Twenty-four repository-owned
fixtures add metadata conflicts and precedence, Open Graph/Twitter fields, valid and
invalid multiple JSON-LD blocks, Microdata, spanned and nested tables, ordered and
unsafe links, hidden and boilerplate content, comments, empty/embedded elements,
long attributes, safe and over-limit DOM depth, encoding cases, Unicode
normalization, duplicate attributes, SVG/MathML, and realistic English, Arabic, and
bilingual content.

Encoding fixtures cover UTF-8 BOM, Windows-1252, ISO-8859-1, Windows-1256,
ISO-8859-6, conflicting declarations, and invalid UTF-8. Non-UTF-8 and intentionally
invalid fixtures are marked binary in `.gitattributes` so Git cannot rewrite their
bytes. Manifest SHA-256 and byte size bind every input; expected files carry
independent human-authored required spans, prohibited boilerplate, acceptable
omissions, title/author/date expectations, paragraph order, Arabic requirements, and
review notes. Candidate output is never ground truth.

All content is synthetic and generated locally; no live page was downloaded.
`verify_corpus.py` verifies all 45 items, and regeneration is byte-deterministic.
Generated resource pages and raw benchmark results remain ignored.
