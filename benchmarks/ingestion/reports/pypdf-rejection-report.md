<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: pypdf Phase 3E-H-A Rejection Report
Introduction:
Records the controlled evidence closure for the rejected pypdf digital-text baseline.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# pypdf Phase 3E-H-A rejection report

## Scope and repository baseline

The gate ran on branch `phase-3e-h-document-extraction` at exact baseline
`f5c6862f5776f077c7a8d31df757cdc8fad5da1a`. No production provider,
routing, protocol, Prisma, database, API, RSS, or web code was changed.

Candidate: `pypdf 6.14.2`. Wheel:
`pypdf-6.14.2-py3-none-any.whl`, 349,514 bytes, SHA-256
`3f07891af76dc002657e04993ab9b4de81de29f9013b9761d0b7968bff12e946`,
BSD-3-Clause. Inspection found a pure `py3-none-any` wheel, no mandatory
dependency on CPython 3.14, no entry points, and no native, executable, JAR,
model, or bundled runtime payload. Optional crypto and image extras were not
installed.

## Isolated environment evidence

The Windows CPython 3.14.0 environment contained exactly `pypdf 6.14.2` and
`pip 25.2`, plus unavoidable virtual-environment bootstrap metadata. Its file
size was 15,306,545 bytes. `pip check` returned `No broken requirements found`.
The import resolved below the isolated environment, user and system site were
disabled, and no external `.pth` file or editable installation was present.
Candidate installation integrity and environment isolation passed as benchmark
infrastructure only. Production registration is not authorized.

Offline reconstruction was not performed after the mandatory stop. The lock
artifacts preserve installation identity, not a claim of fully reconstructed
reproducibility. Validation is Windows-specific; Linux and macOS remain
separately unvalidated.

## Decisive correctness failure

The already-governed fixture was
`benchmarks/ingestion/corpus/documents/ar-simple.pdf` (`doc-ar-simple`), SHA-256
`8eabf3012a94fe51304b507295986f9b3831ff1e593d211ecc38dfee0935ae0c`.
Its independent ground truth requires the logical Arabic span `الزراعة`.
pypdf returned `ةعارزلا`. This is reversed Unicode logical text, not merely a
visual display or bidirectional-rendering difference, and is classified
`ARABIC_LOGICAL_ORDER_INVALID`.

Reversing, reshaping, reordering, or otherwise post-processing the output is
prohibited because it could corrupt valid mixed-direction text and conceal the
candidate's correctness failure. The independent ground truth was not changed.

## Partial findings and stop boundary

Before the stop, fresh checks covered the closed mode surface, unsafe path and
signature rejection, encrypted and malformed classification, bounded action
and embedded-file inventory behavior, output/page bounds, deterministic
canonicalization, and non-exposure of a `DATABASE_URL` marker. These are partial
engineering observations, not accepted capability claims. Reparse-point
creation was unavailable under the Windows sandbox, so that finding is
unverified.

The full correctness and bilingual acceptance benchmarks, resource benchmark,
offline reconstruction, full security matrix, and cross-platform validation
were not completed. Eleven generated PDFs were never admitted to the governed
manifest, had no accepted expected-output records, and were removed during
closure. The governed corpus therefore remains unchanged.

## Decision

pypdf remains potentially useful for narrow inspection or metadata roles,
but it is rejected as the general Phase 3E-H digital-text baseline.

- pypdf lightweight inspection: **BENCHMARK FURTHER**
- pypdf plain digital text: **REJECT**
- pypdf metadata extraction: **BENCHMARK FURTHER**
- pypdf annotations/actions inventory: **BENCHMARK FURTHER**
- pypdf embedded-file inventory: **BENCHMARK FURTHER**
- Arabic extraction: **REJECT**
- bilingual extraction: **REQUIRES TECHNICAL HARDENING**
- malformed-PDF handling: **BENCHMARK FURTHER**
- encrypted-PDF handling: **BENCHMARK FURTHER**
- OCR-needed assessment: **DEFER**
- large-document processing: **DEFER**
- production document extractor: **REJECT**
- Production registration: **NOT AUTHORIZED**

Final gate outcome: **REJECT PHASE 3E-H-A PYPDF AS GENERAL DOCUMENT EXTRACTION BASELINE**.
