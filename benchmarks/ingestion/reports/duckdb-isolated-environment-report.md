<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Isolated Environment Report
Introduction:
Records the exact DuckDB wheel, offline installation, and retained Gate A evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# DuckDB isolated environment

The official wheel `duckdb-1.5.4-cp314-cp314-win_amd64.whl` is 13,666,989
bytes with SHA-256
`6dcbb81a1276bc48deb4d562bce4f8895e4fc6348750a096e30052345c6d6552`.
Downloaded bytes matched official PyPI metadata. The packaged licence file identifies
MIT licensing; METADATA has no mandatory `Requires-Dist` and lists optional `all`
extras only. The wheel-download directory has exactly one top-level wheel. Its ignored
`.inspection/` tree is separate extracted inspection evidence containing 54 files; it
is not part of the downloadable-artifact count.

All 53 hashed entries in the 54-entry RECORD verified. The wheel contains one AMD64
PE native module, `_duckdb.cp314-win_amd64.pyd`, and no separate DLL or extension
binary. GNU objdump recorded imports of `python314.dll`, `WS2_32.dll`,
`RstrtMgr.dll`, and `KERNEL32.dll`. No separate Microsoft runtime is bundled or
directly imported. The engine and built-in components are compiled into the native
module; no SIMD baseline claim is inferred from metadata.

The 50,332,670-byte environment contains only pip 25.2 and DuckDB 1.5.4. User and
system sites are disabled; NumPy, pandas, Polars, PyArrow, fsspec, SQLAlchemy, and
database drivers are absent. `pip check` reports no broken requirements. The retained
machine-readable Gate A result is
`results/duckdb-gate-a/20260715T015249782Z-f5f9ff53/summary.json`; it records the
wheel, RECORD, native architecture, environment inventory, isolated import, sanitized
supervisor launch, listener checks, and process cleanup.

Offline reconstruction was repeated successfully as run
`20260715T020909332Z-e6f91e6c`. The fixed command used `--no-index`, the one-wheel
wheelhouse, `--require-hashes`, and the committed requirements lock in a unique
ignored environment. Installation and `pip check` exited zero. The reconstructed
runtime contained only DuckDB 1.5.4 and pip 25.2; NumPy, pandas, Polars, PyArrow,
fsspec, and SQLAlchemy were absent, as were editable metadata and external `.pth`
files. The verified requirements-lock SHA-256 was
`a7c4f9631a2e44d6fd68ea46b26d3a769551475ee75093429f42b4adba805d7d`.
User and system sites were unavailable, the import and interpreter resolved
inside the temporary environment, both listener checks passed, and all direct child
processes exited. The temporary environment was then removed and its absence
verified. Retained evidence is
`results/duckdb-offline-reconstruction/20260715T020909332Z-e6f91e6c/summary.json`.

Gate A: **passed**. Evidence is Windows 11 x64 build 26200 and regular CPython
3.14.0 only. Linux and macOS require separate artifact locks and native validation.
