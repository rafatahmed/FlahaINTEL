<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Milestone v0.7 Operate Harden — Readiness Frame
Introduction:
Defines v0.7 as operate-harden of the v0.6 product surface (vault honesty
and host health), not product-complete and not Stage E.

Created by: Rafat Al Khashan
Created date: 2026-08-19
Last modified: 2026-08-19
-->

# Milestone v0.7 — Operate harden

## Decision summary

| Question | Answer |
|----------|--------|
| What is v0.7? | **Operate-harden** of `v0.6.0-post-3n-product-surface` |
| New product eyes (YouTube/X)? | **No** — Stage E HOLD |
| Product-complete? | **No** |
| Gate family | **4O** — `docs/program/gates/gate-4o-operate-harden.md` |

```text
v0.5.0  backbone
v0.6.0  product surface (markets, packs, research, handoff)
v0.7.x  operate-harden (honest vault + host)     ← now
v0.8+   4M-N / Stage E only after v0.7 + operate proof
```

## v0.7 done when

| Bar | Meaning |
|-----|---------|
| 4O-A | Demo seeds cannot pass as company knowledge; extracts need reference + landed correlation |
| 4O-B | Literature can take KEY WORDS from extracted PDF text |
| 4O-C | Operator can finish a real PDF through eyes without mystery READY jobs |
| Scoreboard | Residuals labeled OPEN / CLOSED / BLOCKED_PUBLISHER / OPEN_HOST |
| Host | Disk still may be OPEN_HOST — documented, not pretended green |
| Stage E | Still HOLD |

**Not required for v0.7 tag:** 365d MoCI (publisher), FKP MCP, YouTube, new country.

## Operator commands (unchanged cadence)

```powershell
npm run ops:operate-scoreboard
npm run ops:pipeline-once
npm run markets:harvest -- --force
npm run knowledge:purge-demo -- --confirm   # if demos remain
```

## Next after v0.7

1. Repeat operate Loops A–C until a channel MEETS_TARGET.  
2. Real pack handoff used in a PA ticket (human).  
3. Only then owner unfreeze **5E-0**.  
