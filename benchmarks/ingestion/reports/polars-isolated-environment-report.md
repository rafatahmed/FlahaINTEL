<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Polars Isolated Environment Report
Introduction:
Records reproducible Polars wheel, runtime, isolation, and supervisor evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Polars isolated environment report

The Windows x64 wheelhouse contains exactly `polars-1.42.1-py3-none-any.whl`
(837,622 bytes, SHA-256 `3c0c65cdfa21a621650c4bdcbbccf93964d052fd766c3e70e84a55d961c259fd`)
and `polars_runtime_32-1.42.1-cp310-abi3-win_amd64.whl` (52,715,432 bytes,
SHA-256 `e9364c26da389a8b7339e4d29e20a3d12af730247e6ed3b7804bddce2477f428`).
The total is 53,553,054 bytes. Both are MIT licensed and came from official PyPI.

The ignored environment is 205,235,560 bytes. `pyvenv.cfg` disables system site
packages; user site is disabled and absent from `sys.path`; no `.pth` exists; pandas
and NumPy are absent. Runtime inventory is exactly Polars 1.42.1 and
polars-runtime-32 1.42.1, plus bootstrap pip 25.2. The native `.pyd` resolves inside
the environment. `pip check` reports no broken requirements. A second temporary
environment reconstructed offline from the same hashes and inventory and was removed.

The unchanged Phase 3D launcher ran the probe with `-I`, returned exit 0, reported
machine `AMD64`, Polars 1.42.1, disabled user site, no user-site path, and no
`DATABASE_URL`. No listener or orphan process remained. The runtime includes native
Rust/SIMD code and assumes the verified AVX/AVX2 host; Linux needs a separate lock.
Representative cold process imports took 266–326 ms. The first import inside an
already-running isolated interpreter took about 186 ms; a repeated import was
effectively zero because Python reused the loaded module.
