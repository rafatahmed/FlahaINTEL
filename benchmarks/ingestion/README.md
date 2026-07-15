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
python benchmarks/ingestion/scripts/run_pandas_benchmark.py
<POLARS_VENV_PYTHON> -I benchmarks/ingestion/scripts/run_polars_benchmark.py
<POLARS_VENV_PYTHON> -I benchmarks/ingestion/scripts/run_polars_resource_benchmark.py
<PYARROW_VENV_PYTHON> -I benchmarks/ingestion/scripts/run_pyarrow_benchmark.py
<PYARROW_VENV_PYTHON> -I benchmarks/ingestion/scripts/run_pyarrow_resource_benchmark.py
<DUCKDB_VENV_PYTHON> -I benchmarks/ingestion/scripts/run_duckdb_benchmark.py
<DUCKDB_VENV_PYTHON> -I benchmarks/ingestion/scripts/run_duckdb_resource_benchmark.py
node benchmarks/ingestion/scripts/run_duckdb_gate_probe.mjs gate-a
node benchmarks/ingestion/scripts/run_duckdb_gate_probe.mjs gate-b
node benchmarks/ingestion/scripts/run_duckdb_gate_probe.mjs offline-reconstruction
python benchmarks/ingestion/scripts/run_html_benchmark.py
python benchmarks/ingestion/scripts/run_html_resource_benchmark.py
```

Generated run directories are ignored. The committed reports contain only small,
redacted summaries. Network access is neither used nor tested by the baselines.

The Phase 3E-G HTML benchmark accepts only already-acquired governed bytes. lxml and
selectolax run in separate ignored environments; Trafilatura remains uninstalled
pending dependency-licence review. It does not crawl, fetch URLs, execute JavaScript,
launch a browser, or register a production extractor.
