<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: PyArrow Isolated Environment Report
Introduction:
Records reproducible PyArrow wheel, runtime, isolation, and supervisor evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# PyArrow isolated environment report

The official PyPI wheel is `pyarrow-25.0.0-cp314-cp314-win_amd64.whl`,
28,613,262 bytes, SHA-256
`2e093efbecb5317372f819228fa4b4e6157eee48d3f0a7b0303705ebf81a7104`.
Its METADATA has Apache-2.0 licence evidence and zero `Requires-Dist`. The wheel
contains 21 `.pyd` modules, ten Arrow/Parquet DLLs, and two mangled MSVC runtime
DLLs. No dependency wheel or source archive exists in the 28,613,262-byte
wheelhouse.

The ignored environment is 102,388,770 bytes. It contains bootstrap pip 25.2 and
PyArrow 25.0.0 only. System and user site-packages are disabled, no `.pth` or
editable install exists, and NumPy, pandas, Polars, cffi, and fsspec are absent.
`pip check` reports no broken requirements. A second temporary environment was
reconstructed offline with `--no-index`, `--require-hashes`, imported PyArrow,
matched the inventory, and was removed.

Runtime evidence is AMD64 with detected/enabled AVX-512, mimalloc, and available
Brotli, BZip2, gzip, LZ4, Snappy, and Zstandard codecs. The unchanged Phase 3D
launcher used the explicit interpreter with `-I -u`, exited 0, suppressed
`DATABASE_URL` and a representative secret, disabled user site, and left no
listener or process. Cold imports were 74.6–84.2 ms; first warm-process import
was 36.3 ms and repeat import was effectively zero.
