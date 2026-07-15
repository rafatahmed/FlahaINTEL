<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Synthetic Benchmark Corpus
Introduction:
Defines ownership, generation, safety limits, and limitations of the corpus.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Synthetic benchmark corpus

Every item is repository-owned synthetic content created for FlahaINTEL. No
third-party page or copyrighted document was downloaded. The manifest binds each
input to its expected output with SHA-256 and byte length.

The PDF fixtures are deliberately small, deterministic, dependency-free PDF 1.4
files. They exercise text/layout inputs but are not visual-fidelity reference
documents. The scan fixture is a synthetic placeholder PDF and is excluded from
OCR quality scoring until an approved renderer/OCR engine can consume it.

The bounded streaming dataset contains 256 records and remains under the profile's
one-megabyte corpus-item ceiling. Regenerate owned fixtures only with
`scripts/generate_corpus.py`, then review all hash changes.

The HTML corpus contains 31 byte-governed fixtures. Non-UTF-8 encoding cases are
marked binary in `.gitattributes`; all other governed text remains LF-normalized.
Expected files contain independent human-review assertions and never treat candidate
output as ground truth. No HTML fixture was acquired from a live website.
