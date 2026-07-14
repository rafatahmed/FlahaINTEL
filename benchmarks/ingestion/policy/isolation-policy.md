<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Dataset Engine Isolation Policy
Introduction:
Defines reproducible offline Python engine environments and supervisor boundaries.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Dataset engine isolation policy

Each adopted engine version uses a dedicated ignored virtual environment built by an
explicit interpreter. Wheels come only from approved infrastructure, are binary-only,
hash-locked, inspected before installation, and installed offline with `--no-index`,
`--find-links`, and `--require-hashes`. System and user site packages, editable
installs, `.pth` injection, and undeclared distributions are forbidden.

The Phase 3D supervisor launches the environment's absolute interpreter with `-I`,
`-u`, an explicit working directory, and a minimal allowlisted environment. It does
not pass `DATABASE_URL`, credentials, proxy/index configuration, or arbitrary Python
paths. Workers remain database-blind, use stdio JSONL only, create no listener, and
are terminated as a process tree on timeout or cancellation.

The lock manifest is committed; wheels, environments, generated data, and raw runs
are ignored. Offline reconstruction, exact inventory, import containment, `pip check`,
sanitized environment, supervisor compatibility, listener absence, and orphan-process
absence are required before an engine can advance beyond benchmarking.
