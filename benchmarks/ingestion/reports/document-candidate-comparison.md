<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3E-H Document Candidate Comparison
Introduction:
Records capability-level findings from the controlled Docling Slim and Apache Tika campaign.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# Phase 3E-H document candidate comparison

## Controlled runtimes

Docling Slim 2.111.0 was installed from 75 hash-locked binary wheels on CPython
3.14. The initial 73-wheel graph was not runnable: Docling imports SciPy from
its base OCR stage even with `do_ocr=false`, and TableFormer imports headless
OpenCV. SciPy 1.18.0 and opencv-python-headless 5.0.0.93 were added as explicit
binary support dependencies. No OCR engine was installed. Models are locked by
immutable revision, path, size, hash, licence, and purpose. The successful
probe disabled OCR, remote services, and external plugins.

Tika app 3.3.1 and portable Temurin JRE 21.0.11+10 matched the approved sizes
and hashes. The supervisor uses a 512 MiB maximum heap, private temp, bounded
output, a 30-second timeout, and explicit PDF, OOXML, RTF, and text parsers.
It does not use system Java, PATH, Tika Server, URL/GUI/pipe mode, fetchers,
emitters, or external executables.

The Apache security register places the XFA/PDF XXE affected range through
3.2.1, not 3.3.1. Tika is nevertheless not a security boundary. Hostile parsing
remains blocked pending verified temp cleanup, font-cache redirection, and OS
process containment.

## Shared corpus and results

The candidate-independent corpus now verifies 66 governed items, covering the
requested PDF, DOCX, PPTX, RTF, and plain-text dimensions. Expected values were
not generated from candidate output. Synthetic embedded image/file fixtures
currently test assessment markers rather than populated PDF attachment streams;
those capabilities remain `BENCHMARK FURTHER`.

| Capability | pypdf | pdfminer.six | Docling Slim | Apache Tika |
|---|---|---|---|---|
| Lightweight inspection | BENCHMARK FURTHER | REJECT | NOT TARGETED | BENCHMARK FURTHER |
| English plain text | PARTIAL | PARTIAL | PASS | PASS |
| Arabic plain text | REJECT: reversed | REJECT: undecodable | REJECT: reversed | REJECT: undecodable |
| Bilingual authority | REJECT | NOT PERFORMED | REJECT | REJECT |
| Metadata | BENCHMARK FURTHER | NOT PERFORMED | PARTIAL | PASS |
| Annotations/actions | BENCHMARK FURTHER | NOT PERFORMED | NOT ESTABLISHED | BENCHMARK FURTHER |
| Embedded artifacts | BENCHMARK FURTHER | NOT PERFORMED | NOT ESTABLISHED | BENCHMARK FURTHER |
| Reading order/headings/layout | REJECT | REJECT | PASS on bounded English probes | PARTIAL |
| Tables | NOT TARGETED | NOT TARGETED | PASS on bounded probe | PARTIAL text fallback |
| PDF fallback | REJECT multilingual | REJECT | PARTIAL | PASS except governed Arabic |
| DOCX/PPTX/RTF/TXT | NOT TARGETED | NOT TARGETED | NOT IN GRAPH | PASS on benign allowlisted probes |
| Malformed/encrypted | PARTIAL | PARTIAL | BENCHMARK FURTHER | BENCHMARK FURTHER |
| OCR-needed assessment | PARTIAL | PARTIAL | PASS without OCR | BENCHMARK FURTHER |
| Resource footprint | LIGHT | LIGHT | HEAVY | MODERATE one-shot JVM |

## Recommended architecture

```text
FlahaDocument
├── Inspection adapter: pypdf primary; Tika fallback
├── English/plain-text adapter: Docling Slim primary for PDF; Tika fallback
├── Arabic/bilingual adapter: unsupported in current program
├── Layout/section adapter: Docling Slim
├── Table adapter: Docling Slim; Tika text fallback only
├── Broad-format fallback: Apache Tika
└── Digital-text sufficiency assessor: deterministic policy; Docling signal fallback
```

pypdf's inspection role requires metadata/action/encryption/embedded-file tests.
Docling requires corrected-lock offline reconstruction, deterministic two-run
hashes, worker supervision, and broader real documents. Tika requires a private
PDFBox cache, reliable temp cleanup, contained-library inventory, and hostile
tests inside an OS process boundary. No provider registration or production
integration is authorized.

## Closure evidence

- Corrected 75-wheel Docling lock: **PASS**; zero sdists/source builds/OCR,
  remote-service, or external-plugin packages.
- Offline reconstruction `20260715T223522Z-ba19ce80`: **PASS**; local models
  loaded, no profile-cache change/listener/child survived, and the disposable
  environment was removed.
- Tika contained-library inventory and approved parser allowlist: **PASS**.
- Hostile-policy supervision: **PASS** for malformed/encrypted, page/size,
  action/URI/launch, embedded marker, archive recursion, timeout, and output
  bounds. Dangerous inputs are classified without candidate execution.
- Comparative runs `20260715T224408Z-c01a648b` and
  `20260715T224431Z-c1765d06`: 16 results each, 10 successes, 3 unsupported
  language results, 16 hashes compared, zero hash/classification mismatch and
  zero determinism failures.
- Private cache/temp containment: **PARTIAL**. Docling profile caches were
  unchanged. Tika received private `java.io.tmpdir`, PDFBox cache and user-home
  paths, but Windows denied deletion to the sandboxed parent; elevated closure
  cleanup was required. Absolute containment is not claimed.
- Resource evidence: **LIMITED** because reliable peak process-tree memory and
  isolated temporary-disk growth were not captured.

Arabic and bilingual inputs are classified `UNSUPPORTED_LANGUAGE_EXTRACTION`
and `REQUIRES_ANALYST_REVIEW`. No reversal, CID conversion, reshaping, OCR, or
candidate-specific correction is permitted.

Embedded image/file capability: **BENCHMARK FURTHER**.

## Final capability decisions

| Capability | Decision |
|---|---|
| pypdf inspection | BENCHMARK FURTHER |
| pypdf metadata | BENCHMARK FURTHER |
| pypdf actions/annotations | BENCHMARK FURTHER |
| Docling English PDF text | ADOPT AS PRIMARY |
| Docling layout | ADOPT AS PRIMARY |
| Docling sections | ADOPT AS PRIMARY |
| Docling tables | ADOPT AS PRIMARY |
| Docling OCR-needed signals | ADOPT AS FALLBACK |
| Tika PDF fallback | ADOPT AS FALLBACK |
| Tika DOCX | ADOPT AS FALLBACK |
| Tika PPTX | ADOPT AS FALLBACK |
| Tika RTF | ADOPT AS FALLBACK |
| Tika plain text | ADOPT AS FALLBACK |
| Arabic PDF extraction | REJECT |
| bilingual PDF extraction | REJECT |
| embedded-content inventory | BENCHMARK FURTHER |
| malformed-document handling | REQUIRES TECHNICAL HARDENING |
| encrypted-document handling | REQUIRES TECHNICAL HARDENING |
| large-document processing | BENCHMARK FURTHER |
| production document provider | DEFER |

## Roadmap decision

```text
Phase 3E-I OCR:
OMITTED FROM CURRENT IMPLEMENTATION PROGRAM
Future optional development only

Next active phase:
3E-J — crawler/browser benchmark
```

No OCR work was started. Production registration remains deferred.
