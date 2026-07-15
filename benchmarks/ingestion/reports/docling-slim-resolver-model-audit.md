<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Docling Slim Resolver and Model Audit
Introduction:
Records the installation-free Python graph, OCR exclusion, model, network, and disk review.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# Docling Slim resolver and model audit

## Proposed package strategy

Official PyPI metadata identified stable `docling-slim 2.111.0`, released
2026-07-08, MIT, Python `>=3.10,<4.0`. The proposed narrow expression is:

```text
docling-slim[format-pdf,models-local]==2.111.0
```

Roles remain separated:

- base wrapper: docling-slim, docling-core, pydantic, pydantic-settings, pluggy;
- PDF parsing/rendering: docling-parse and pypdfium2;
- local layout/table runtime: docling-ibm-models, torch, torchvision,
  accelerate, transformers, safetensors, and Hugging Face Hub;
- OCR: excluded;
- remote services and external plugins: excluded and disabled.

The base wrapper still selects `requests`; local-model support selects
`huggingface-hub`, `httpx`, and `hf-xet`. Package selection alone therefore
does not prove offline operation.

## Resolver evidence

A CPython 3.14 Windows x64 binary-only dry run selected 73 wheels and zero
sdists. No environment was created and nothing was installed. Ignored evidence
under `benchmarks/ingestion/results/docling-slim-resolution/` contains the pip
resolver report and a 73-entry inventory with normalized name, version, wheel,
tags, exact byte size, SHA-256, declared licence, dependency parents,
native-code classification, and purpose.

Important selections include:

| Role | Artifact |
| --- | --- |
| Wrapper | `docling_slim-2.111.0-py3-none-any.whl` |
| Core | `docling_core-2.87.1-py3-none-any.whl` |
| Parser | `docling_parse-7.8.0-cp314-cp314-win_amd64.whl` |
| Renderer | `pypdfium2-5.12.0-py3-none-win_amd64.whl` |
| Models package | `docling_ibm_models-3.13.3-py3-none-any.whl` |
| Model runtime | `torch-2.13.0-cp314-cp314-win_amd64.whl` |
| Vision runtime | `torchvision-0.28.0-cp314-cp314-win_amd64.whl` |
| Configuration | pydantic 2.13.4, pydantic-core 2.46.4, pluggy 1.6.0 |
| Network/cache | requests 2.34.2, Hugging Face Hub 1.23.0, httpx 0.28.1, hf-xet 1.5.1 |

All selected native artifacts have compatible Windows x64 CPython 3.14 or
stable-ABI wheels. The resolved wheel payload totals 222,432,161 bytes.
Several dependency licence fields are legacy or blank in core metadata and
must be normalized against the licence files inside the exact wheels before
installation authorization.

## OCR exclusion

The selected graph contains no RapidOCR, EasyOCR, tesserocr/Tesseract binding,
PaddleOCR, OCR runtime, or OCR model package. The `standard`, `all`, and every
`feat-ocr-*` extra remain prohibited. OCR exclusion is proven for this exact
resolver expression.

## Model and offline gap

Docling requires local non-OCR artifacts for layout and table structure. The
official `docling-project/docling-models` repository covers layout detection
and TableFormer table structure under CDLA-Permissive-2.0 and Apache-2.0. A
reviewable immutable repository revision exists at
`2bdc831fd1edeb61e6d0dfc8ae7596b0c30bdff4`; its TableFormer directory alone
is approximately 358 MB. Historical LFS evidence identifies layout weights
around 202 MB and table weights around 146–213 MB.

This is not yet an installation-ready model manifest. The exact artifact set
expected by docling-ibm-models 3.13.3, immutable per-file paths, sizes and
SHA-256 values, reading-order responsibility, and code-execution implications
have not all been reconciled to that revision. No model was downloaded.

Future offline architecture must use a pinned wheelhouse, an immutable local
model manifest, a candidate-specific ignored cache, explicit `artifacts_path`,
`enable_remote_services=false`, `allow_external_plugins=false`, Hugging Face
offline variables, sanitized proxy/cache variables, and OS-level network
denial. With no local artifact, first use may fetch models remotely.

## Disk and runtime budget

At audit start the host had 7,317,946,368 free bytes. Current estimates are:

- wheelhouse: 222.4 MB exact resolved payload;
- environment: 650 MB–1.2 GB estimated after expansion;
- models: at least about 560 MB; exact total unresolved;
- bounded extraction/temp reserve: 1 GB;
- rollback/safety reserve: 2 GB;
- projected lower-bound campaign footprint: approximately 4.43 GB.

The lower bound fits, but installation is not authorized because the exact
model footprint and safe post-install headroom are unresolved.

## Decision

```text
DOCLING SLIM REQUIRES TECHNICAL REVIEW
```

No Docling environment, repository lock, model directory, or production
registration was created.
