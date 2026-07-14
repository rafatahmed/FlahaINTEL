<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Reproducible Ingestion Engine Benchmarks
Introduction:
Describes the governed, offline benchmark framework for ingestion candidates.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Reproducible ingestion engine benchmarks

This evaluation-only framework measures dependency-free baselines and prepares
governed comparisons for later approved engine installations. It has no database,
network, artifact-promotion, production worker, or analyst-approval integration.

Run from the repository root with `C:\Python314\python.exe`:

```powershell
python benchmarks/ingestion/scripts/verify_corpus.py
python -m unittest discover -s benchmarks/ingestion/tests -v
python benchmarks/ingestion/scripts/run_baselines.py --determinism-runs 2
python benchmarks/ingestion/scripts/summarize_results.py <run-directory>
```

Generated run directories are ignored. The committed reports contain only small,
redacted summaries. Network access is neither used nor tested by the baselines.
