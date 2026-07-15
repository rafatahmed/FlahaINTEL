<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: HTML Candidate Comparison and Decisions
Introduction:
Separates benchmark findings and adoption statuses without production registration.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# HTML candidate comparison and decisions

| Decision area | Status | Basis |
| --- | --- | --- |
| stdlib HTML parser baseline | ADOPT | Governed zero-dependency benchmark baseline; not production routing |
| lxml controlled DOM parser | REQUIRES TECHNICAL HARDENING | Correct and deterministic; native deployment and supervisor limits remain |
| selectolax fast parser | REQUIRES TECHNICAL HARDENING | Correct and deterministic on accepted inputs; over-depth rejection and native deployment remain |
| Trafilatura main-content extractor | DEFER | Dependency set requires licence review; not installed or run |
| governed encoding policy | ADOPT | Strict precedence and allowlist pass Western/Arabic and malformed fixtures |
| shared metadata extraction | BENCHMARK FURTHER | Deterministic precedence exists; wider publisher corpus needed |
| JSON-LD extraction | BENCHMARK FURTHER | Valid/multiple/invalid fixtures pass; schema breadth is limited |
| link extraction | REQUIRES TECHNICAL HARDENING | Ordered observation is safe; future URL policy and acquisition remain separate |
| table extraction | BENCHMARK FURTHER | Spans and nested tables covered; complex table semantics remain |
| Arabic extraction | BENCHMARK FURTHER | Governed Arabic fixtures pass; real publisher diversity is absent |
| bilingual extraction | BENCHMARK FURTHER | Governed RTL/LTR fixtures pass; broader ordering review needed |
| malformed-HTML recovery | BENCHMARK FURTHER | Deterministic parser-specific recovery is evidenced, not standardized |
| large-document processing | BENCHMARK FURTHER | Medium input passes; reliable memory and maximum-bound evidence are pending |
| deterministic normalization | ADOPT | Stable traversal, warning order, JSON, NFC comparison, and hashes pass twice |
| isolated candidate environments | ADOPT | Exact hash-locked offline reconstruction and isolation pass |
| production HTML extraction candidate | DEFER | No candidate is registered; hardening and main-content evaluation remain |

The recommendation is to accept Phase 3E-G as a governed benchmark gate for the
stdlib/lxml/selectolax scope, with Trafilatura explicitly blocked and no production
candidate approved. Phase 3E-H, crawler/browser work, provider framework, routing,
and production integration have not started.
