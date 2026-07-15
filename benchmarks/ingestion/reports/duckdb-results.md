<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Governed Benchmark Results
Introduction:
Records correctness, determinism, ordering, and resource evidence for DuckDB.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# DuckDB benchmark results

Two final governed runs (`20260715T021844Z-c6d520ec` and
`20260715T021845Z-81866dfb`) each produced 20 results with zero comparison,
determinism, or execution-hash failures. CSV eager, relation-labelled fixed-query,
bounded `fetchmany()`, and controlled two-thread scans matched. The relation label is
retained for the cross-engine comparison matrix but uses the same fixed parameterized
`DuckDBPyConnection.execute()+fetchall()` API rather than DuckDB's relation API. JSON
and JSONL eager and bounded modes matched. Every result used an explicit source
ordinal and final `ORDER BY`.

The stdlib CSV validator remained authoritative. `STRICT_SCHEMA`,
`INFER_WITH_EVIDENCE`, and `TEXT_PRESERVING` were exercised. Arabic, nulls,
duplicates, leading zeros, exact decimal scale, booleans, and governed UTC timestamps
were preserved. `TIMESTAMPTZ` Python conversion was not used because it requires the
unapproved optional `pytz`; governed UTC input is parsed as `TIMESTAMP` and explicitly
normalized to trailing `Z`.

Gate A offline reconstruction run `20260715T020909332Z-e6f91e6c` installed the
hash-locked wheel with no index into a unique temporary environment. The exact
DuckDB 1.5.4 plus pip 25.2 inventory passed import, isolation, forbidden-module,
listener, and process-exit checks. The temporary environment was removed and verified
absent; machine-readable evidence remains under
`results/duckdb-offline-reconstruction/20260715T020909332Z-e6f91e6c/summary.json`.

The accepted 10k and 100k generated inputs were hash-verified without regeneration
before resource run `20260715T015608Z-duckdb-resource`. At 10k, eager, threaded,
and bounded modes took 0.97, 0.95, and 1.00 seconds. At 100k they took 3.69, 3.81,
and 3.82 seconds. Mode hashes were respectively
`5fea485d6198981621b9e2f4281d84456d432a6b72fd36104c37a2ef2881970d`
and `07ffb53f07d3b95c575474b4aab3f7a5328a72f0c6b483ab0cfd79a58777d96b`,
matching the accepted Polars and PyArrow normalized outputs.

Windows working-set and CPU sampling follows the virtual-environment launcher and is
not reliable engine-memory evidence. DuckDB's 256 MB setting limits its buffer
manager, not Python or every native allocation. Bounded fetching retained every
normalized Python row, so bounded end-to-end memory is not proven. No 500k or 1m
dataset was generated or executed.
