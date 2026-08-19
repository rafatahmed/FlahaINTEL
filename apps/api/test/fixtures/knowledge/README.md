<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Knowledge Test Fixtures
Introduction: Sample packs, example literature, and threshold bank for automated tests only.
-->

# Knowledge test fixtures (NOT operate content)

These files exist so **unit/integration tests** can exercise Knowledge / Research / FlahaSOIL comparison paths.

| Path | Purpose |
|------|---------|
| `samples/*.json` | Sample knowledge packs + example literature sources |
| `banks/literature-threshold-bank.json` | Sample threshold bank for 4S-C/D tests |
| `reports/*` | Sample FlahaSOIL report text |

## Rules

1. **Do not** load these into an operate FlahaINTEL database as company knowledge.
2. Seed CLIs require `--for-tests` or `FLAHA_ALLOW_DEMO_SEED=1`.
3. Prefer: `npm run knowledge:test:seed-samples` (and sibling `knowledge:test:*` scripts).
4. Purge accidental demos: `npm run knowledge:purge-demo -- --confirm`

## Real operate content

- Markets: harvest / historical import  
- RSS: collect → Articles  
- Knowledge: human-authored packs + real literature registration (`--file=real.json`)  
- Soil cases: real report import via Submit / bridge — never FLH-2026-001 smoke as truth  
