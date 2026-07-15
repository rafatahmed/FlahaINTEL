<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Security Boundary Report
Introduction:
Records the fixed-statement, exact-path, and side-effect denial proof for DuckDB.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# DuckDB security boundary

DuckDB 1.5.4 passed the benchmark-only boundary. The probe accepts no SQL, path,
configuration, expression, identifier, or extension input. A dedicated `:memory:`
connection used fixed internal statements and was launched by the Phase 3D supervisor
with `-I -u`; `DATABASE_URL`, API keys, proxy credentials, cloud credentials, and
other representative secret names were absent.

The core runtime exposes `enable_external_access`, `allow_unsigned_extensions`,
`autoinstall_known_extensions`, `autoload_known_extensions`,
`allow_community_extensions`, `enable_external_file_cache`,
`preserve_insertion_order`, `enable_progress_bar`, `enable_object_cache`, `threads`,
`memory_limit`, `max_temp_directory_size`, `temp_directory`, `home_directory`,
`extension_directory`, `allowed_paths`, `allowed_directories`, and
`lock_configuration`. `enable_global_s3_configuration` is absent because it belongs
to the uninstalled `httpfs` extension.

The connection disabled external access, extension install/autoload, unsigned and
community extensions, external file caching, object caching, and progress output. It
used two threads, a 256 MB buffer-manager limit, a 16 MB temporary-directory limit,
and one canonical entry in `allowed_paths`, then locked configuration. DuckDB added
only the dedicated probe temporary directory to the effective `allowed_directories`;
the retained actual-setting inventory records this engine behavior.

The exact canonical CSV was readable while its sibling, outside canary, traversal,
glob, file list, directory scan, UNC, device, ADS, HTTP, HTTPS, S3, Azure, and GCS
references were denied. `INSTALL`, community `INSTALL`, `LOAD`, implicit SQLite
autoload, `ATTACH`, SQLite attachment, `COPY TO`, and `CREATE SECRET` were denied.
After locking, every attempted relaxation of external access, extension controls,
paths, directories, home/extension directories, memory, and spill limits failed.

No extension, output, persistent database, or temporary spill file remained. The
extension and temporary directories were empty. A unique probe root was removed and
verified after the run. The retained result preserved the audited legacy three-canary
inventory before that stale root was removed. Windows symlink creation was not
available in this host context, so reparse-point denial remains enforced by adapter
canonical containment and requires a privileged Windows fixture for additional proof.
Both ports remained bindable and no child or orphan process remained.

Machine-readable Gate B evidence is retained at
`results/duckdb-security/20260715T015300009Z-70218eb1/summary.json`. Every denial has
a fixed operation ID, expectation, actual result, exception type, and pass boolean.

Gate B: **passed for the governed benchmark boundary**. This is defense in depth,
not authorization for untrusted SQL or production use.
