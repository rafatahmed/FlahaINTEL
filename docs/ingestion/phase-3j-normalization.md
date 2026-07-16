<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3J Content Normalization
Introduction: Defines the durable in-process normalization boundary from verified extraction artifacts to governed normalized content.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# Phase 3J — Content Normalization

## Scope

Phase 3J converts verified Phase 3I extraction artifacts into one stable FlahaINTEL content model. Execution is deterministic in-process TypeScript. Phase 3G owns job lifecycle; ArtifactStore owns immutable bytes; TypeScript remains the sole PostgreSQL writer. Normalization does not access the network.

## Non-goals

Summarization, entity extraction, classification, sentiment, relevance scoring, embeddings, search indexing, article publication, OCR, UI, and live network acquisition are out of scope. PPTX remains unsupported. Arabic and bilingual authoritative PDFs remain unsupported and review-routed.

## Normalized schema

Versioned schema `packages/ingestion-contracts/schemas/v1/normalized-content.schema.json` defines identity, lineage, optional metadata fields, plain text, structure, hashes, warnings, quality indicators, and field provenance. Missing metadata stays null; values are never fabricated.

## Profiles

| Profile | Family | Notes |
|---|---|---|
| `HTML_ARTICLE_V1` | HTML | Requires explicit article-like evidence |
| `HTML_GENERIC_PAGE_V1` | HTML | General pages |
| `PDF_DOCUMENT_V1` | Document | English PDF |
| `OFFICE_DOCUMENT_V1` | Document | DOCX/RTF |
| `PLAIN_TEXT_V1` | Document | Plain text |

Each profile is versioned with a digest covering inputs, mappings, limits, and quality rules.

## Metadata precedence

```text
explicit extraction RESULT
→ structured extraction METADATA
→ acquisition metadata
→ governed source metadata
→ null
```

Current time, filesystem timestamps, and job creation time are never publication evidence.

## Canonicalization

Text: Unicode NFC, LF endings, control removal, profile whitespace rules, paragraph segmentation, soft-hyphen handling, wrap repair, duplicate/header warnings, truncation flags. No translation or Arabic repair.

Structure: bounded depth, counts, table dimensions, links, and metadata keys. Maps are key-sorted before structural hashing. Document order is preserved.

## Hashing

- `normalizationInputHash` — sorted input artifact IDs, roles, SHA-256, profile id/version
- `normalizationProfileHash` — profile digest
- `rawNormalizedTextHash` — canonical plain text
- `structuralContentHash` — canonical structure JSON

Duplicate fingerprints may be calculated; records are not merged.

## Output artifacts

`NORMALIZED_CONTENT`, `NORMALIZED_TEXT`, `NORMALIZED_STRUCTURE`, `NORMALIZED_METADATA`, `NORMALIZATION_RESULT`, `DIAGNOSTIC` are sealed, verified, and promoted. PostgreSQL stores links, hashes, warnings, and provenance only.

## Quality indicators

`EMPTY_CONTENT`, `LOW_TEXT_VOLUME`, `MISSING_TITLE`, `MISSING_DATE`, `MISSING_AUTHOR`, `STRUCTURE_UNAVAILABLE`, `TABLE_EXTRACTION_WARNING`, `ENCODING_WARNING`, `TRUNCATED_OUTPUT`, `UNSUPPORTED_LANGUAGE`, `REQUIRES_ANALYST_REVIEW`.

## Durable lifecycle

Jobs use Phase 3G claim/lease/cancel/retry/fail/complete. Synthetic catalogue engines `normalization.html.flaha-v1` and `normalization.document.flaha-v1` are in-process and not production network providers. No Prisma migration is required.

## CLI

```text
npm run ingest:create-normalization -- --job-id <extraction-job-id> --profile <profile> --idempotency-key <key>
npm run ingest:normalization-worker:once
npm run ingest:normalization-job -- --job-id <normalization-job-id>
npm run ingest:normalization-artifact -- --artifact-id <artifact-id>
```

## Testing and security

Acceptance covers HTML/document normalization, determinism, unsupported PPTX/Arabic/bilingual paths, cancellation, stale lease fencing, hash/ownership/profile failures, and bounded staging cleanup.

## Residual risks

Provider extraction quality bounds remain; normalization cannot invent missing structure. Ambiguous HTML must not use `HTML_ARTICLE_V1` without article evidence.

## Relationship to Phase 3K

Phase 3K may consume immutable normalized artifacts for governance and analyst review. Phase 3J does not start review workflows or UI.
