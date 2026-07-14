<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3E-A Baseline Results
Introduction:
Summarizes dependency-free benchmark execution and reproducibility evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Baseline results

Representative ignored run: `20260714T231008Z-7ce1da55` at commit `788fd95`
with a dirty worktree accurately recorded because the framework was under
development. No generated run directory is committed.

| Result | Value |
| --- | ---: |
| Governed corpus items verified | 21 |
| HTML/dataset results | 14 |
| Valid inputs classified `SUCCESS` | 11 |
| Malformed inputs classified `MALFORMED_INPUT` | 3 |
| Determinism reruns per input | 2 |
| Determinism mismatches | 0 |
| Expected-output mismatches | 0 |
| Network/database use | None |
| Peak memory | Unavailable; explicitly null |

Arabic text was preserved in HTML, JSON, JSONL, and CSV processing. Navigation,
footer, script, and style content was excluded in controlled fixtures. Malformed
HTML remained deterministic. Malformed CSV, JSON, and JSONL received stable
classifications. Immutable run-ID reuse and unsafe output paths were rejected.

No PDF conversion or OCR result is reported because no approved engine was
installed. pandas was detected but not executed. These results establish framework
behavior only and do not justify adopting the stdlib HTML extractor.
