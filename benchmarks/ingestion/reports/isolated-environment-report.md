<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Isolated Pandas Environment Report
Introduction:
Records the reproducible offline runtime, inventory, and isolation evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Isolated pandas environment report

The environment was created with explicit CPython 3.14.0 at the ignored relative
location `.benchmark-envs/pandas-2.3.3-py314`. Its final size is 137,543,338 bytes.
`pyvenv.cfg` records `include-system-site-packages = false`; `site.ENABLE_USER_SITE`
is false, the user site is absent from `sys.path`, imports resolve beneath the venv,
and no `.pth` file exists. Runtime distributions are exactly pandas 2.3.3, NumPy
2.3.5, python-dateutil 2.9.0.post0, pytz 2026.2, tzdata 2026.3, and six 1.17.0.
The only bootstrap distribution is pip 25.2. `pip check` reports no broken requirements.

The complete runtime `pip freeze` was:

```text
numpy==2.3.5
pandas==2.3.3
python-dateutil==2.9.0.post0
pytz==2026.2
six==1.17.0
tzdata==2026.3
```

Six binary wheels totaling 25,127,710 bytes were downloaded explicitly with
`--only-binary=:all:` and `--no-deps` from `https://pypi.org/simple`. Installation
used only `--no-index`, the ignored wheelhouse, `--require-hashes`, and the committed
requirements lock. A second temporary venv reconstructed offline with the identical
inventory and passed `pip check`, then was deleted.

The existing Phase 3D launcher successfully spawned this interpreter with `-I` and
its sanitized environment. An intentionally invalid request returned exit 2 and
`invalid request envelope`, proving the configured interpreter path was used without
changing the supervisor. `DATABASE_URL` was not passed; no listener or orphan process
was observed. Full candidate protocol integration remains benchmark-only and is not
a production engine registration.
