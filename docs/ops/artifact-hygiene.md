<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Artifact Store Hygiene (G10)
Introduction: Operator guide for reconciling orphan staging and missing promoted blobs.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# Artifact hygiene (G10)

## Purpose

ArtifactStore may accumulate **orphaned staging** files or show **PREVIEW_UNAVAILABLE** when DB links remain after blobs are gone (tests, interrupted writes).

## Command

```powershell
npm run ops:artifact-hygiene
npm run ops:artifact-hygiene -- --json
```

Reports counts for:

- `orphanedStagingKeys` — staging files without registry promotion  
- `missingRegisteredKeys` — registry points to missing files  
- `unregisteredPromotedKeys` — promoted files not in registry  
- `checksumMismatches`  

## Policy

- **Report-only** by default — do not bulk-delete without review.  
- Markets and RSS continue without orphan previews.  
- Prefer freeing disk with known large folders first; then re-run hygiene.

## After Submit promote (P2/P3)

Market, soil, CALC, and FAST promote paths seal a content-addressed artifact under `intake/sha256/...` and bind:

- price rows → `evidenceArtifactId` + `intake://…` URL  
- CALC/FAST DRAFT packs → item `evidenceArtifactId`  

## Harvest + analyst packs (G7)

```powershell
npm run markets:harvest -- --force --rebuild-analyst-packs
```
