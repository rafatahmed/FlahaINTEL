<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Knowledge Samples — Relocated
Introduction: Sample JSON moved to automated test fixtures; not for operate DB seeding.
-->

# Samples relocated to tests

Sample packs and example literature are **test fixtures only**.

**Canonical location:**

```text
apps/api/test/fixtures/knowledge/
  samples/
  banks/
  reports/
```

See `apps/api/test/fixtures/knowledge/README.md`.

Operate DBs must use **real** markets, RSS, literature, and human-approved packs.  
Purge demos: `npm run knowledge:purge-demo --workspace=@flaha-intel/api -- --confirm`
