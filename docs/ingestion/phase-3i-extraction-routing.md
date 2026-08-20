<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3I Extraction Routing
Introduction: Defines the durable, offline routing boundary from canonical acquisition artifacts to extraction artifacts.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-08-19
-->

# Phase 3I — Extraction Routing

Phase 3I connects immutable Phase 3H artifacts to Phase 3G durable jobs. Phase 3F remains the only provider-selection authority, Phase 3G owns lifecycle and fallback, ArtifactStore owns file transitions, and WorkerSupervisor is the only subprocess path.

HTML routes accept stored `text/html` or XHTML only. The stdlib parser handles baseline text, links, and metadata; lxml and selectolax handle eligible structural extraction. No HTML worker fetches a URL. Trafilatura remains deferred.

English PDFs, Word, RTF, and plain text route to Apache Tika for text extraction. Layout, section, and table capabilities have no provider. Docling is rejected and is not launched. Structured PDF later is MinerU under a new approved gate. pypdf is restricted to inspection, metadata, annotation/action inventory, and embedded-artifact inventory. PPTX remains unsupported. Arabic and bilingual authoritative PDF extraction remain unsupported and require analyst review; no provider is launched when Phase 3F finds no eligible provider.

Each attempt re-verifies the promoted input's identity, immutable state, safe key, regular-file status, byte length, and SHA-256. Workers receive one canonical reference and preallocated staging keys. JSONL contains identities, limits, evidence, hashes, and sizes only. Workers have a deny-all network policy and cannot access Prisma or choose providers, retries, fallbacks, final keys, runtime arguments, models, or environment maps.

Successful outputs are sealed, hashed, lease-checked, and promoted as immutable extracted-text, metadata, structure, table, result, or diagnostic artifacts before Phase 3G persists links and provenance. Contract mismatches, cancellation, or stale leases quarantine or abandon staging and cannot create success provenance. Phase 3F's persisted compatible chain is the sole fallback source.

The acceptance scope covers static and rendered HTML, English PDF, Tika broad formats, compatible fallback, unsupported-language non-launch, cancellation, stale output, traversal/hash/size/protocol attacks, timeouts, crashes, and process-tree cleanup. No Prisma migration is required.

Residual risks include parser defects in pinned third-party runtimes, operating-system network controls outside the worker protocol, and intentionally unsupported authoritative Arabic PDF extraction. Phase 3J may consume the verified immutable extraction artifacts for normalization; Phase 3I does not normalize, deduplicate, summarize, classify, or extract entities.
