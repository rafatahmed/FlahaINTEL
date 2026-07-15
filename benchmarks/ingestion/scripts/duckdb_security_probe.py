"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Security Boundary Probe
Introduction:
Produces fixed-operation evidence for DuckDB exact-path and side-effect controls.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import shutil
import site
import socket
import sys
import uuid

import duckdb

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROBE_BASE = ROOT / "results" / ".duckdb-security-probes"
LEGACY_PROBE_ROOT = ROOT / "results" / ".duckdb-security-probe"
SETTINGS = (
    "enable_external_access", "allow_unsigned_extensions", "autoinstall_known_extensions",
    "autoload_known_extensions", "allow_community_extensions", "enable_global_s3_configuration",
    "enable_external_file_cache", "preserve_insertion_order", "enable_progress_bar",
    "enable_object_cache", "threads", "memory_limit", "max_temp_directory_size",
    "temp_directory", "home_directory", "extension_directory", "allowed_paths",
    "allowed_directories", "lock_configuration",
)


def _snapshot(root: pathlib.Path) -> list[str]:
    return sorted(str(path.relative_to(root)).replace("\\", "/") for path in root.rglob("*") if path.is_file())


def _attempt(connection: duckdb.DuckDBPyConnection, operation_id: str, statement: str, parameters=None) -> dict:
    try:
        connection.execute(statement, parameters or [])
        connection.fetchall()
        return {"operationId": operation_id, "expected": "DENIED", "actual": "PERMITTED", "exceptionType": None, "passed": False}
    except Exception as error:  # DuckDB exposes several native exception subclasses.
        return {"operationId": operation_id, "expected": "DENIED", "actual": "DENIED", "exceptionType": type(error).__name__, "passed": True}


def _configure(connection: duckdb.DuckDBPyConnection, source: pathlib.Path, home: pathlib.Path,
               extensions: pathlib.Path, temporary: pathlib.Path, threads: int) -> None:
    for statement in (
        "SET allow_unsigned_extensions = false",
        "SET autoinstall_known_extensions = false",
        "SET autoload_known_extensions = false",
        "SET allow_community_extensions = false",
        "SET enable_external_file_cache = false",
        "SET enable_object_cache = false",
        "SET enable_progress_bar = false",
        "SET preserve_insertion_order = true",
        f"SET threads = {threads}",
        "SET memory_limit = '256MB'",
        "SET max_temp_directory_size = '16MB'",
    ):
        connection.execute(statement)
    connection.execute("SET home_directory = ?", [str(home.resolve())])
    connection.execute("SET extension_directory = ?", [str(extensions.resolve())])
    connection.execute("SET temp_directory = ?", [str(temporary.resolve())])
    connection.execute("SET allowed_paths = ?", [[str(source.resolve())]])
    connection.execute("SET allowed_directories = []")
    connection.execute("SET enable_external_access = false")
    connection.execute("SET lock_configuration = true")


def _read(connection: duckdb.DuckDBPyConnection, source: pathlib.Path, parallel: bool, bounded: bool) -> list[tuple]:
    parallel_sql = "true" if parallel else "false"
    cursor = connection.execute(
        "SELECT ordinal, value FROM read_csv(?, header=true, "
        f"columns={{'ordinal':'INTEGER','value':'VARCHAR'}}, strict_mode=true, parallel={parallel_sql}) ORDER BY ordinal",
        [str(source.resolve())],
    )
    if not bounded:
        return cursor.fetchall()
    rows: list[tuple] = []
    while batch := cursor.fetchmany(2):
        rows.extend(batch)
    return rows


def _remove_probe_root(path: pathlib.Path) -> bool:
    try:
        shutil.rmtree(path)
    except OSError:
        return False
    return not path.exists()


def run() -> dict:
    probe_root = PROBE_BASE / uuid.uuid4().hex
    allowed_dir = probe_root / "allowed"
    inert_home = probe_root / "home"
    extension_dir = probe_root / "extensions"
    temp_dir = probe_root / "temp"
    for directory in (allowed_dir, inert_home, extension_dir, temp_dir):
        directory.mkdir(parents=True)
    allowed = allowed_dir / "allowed.csv"
    sibling = allowed_dir / "sibling.csv"
    outside = probe_root / "outside.csv"
    renamed = allowed_dir / "renamed.csv"
    text = "ordinal,value\n2,beta\n1,alpha\n3,gamma\n"
    for path in (allowed, sibling, outside, renamed):
        path.write_text(text, encoding="utf-8")
    symlink = allowed_dir / "link.csv"
    try:
        symlink.symlink_to(outside)
        symlink_supported = True
    except OSError:
        symlink_supported = False

    legacy = {
        "exists": LEGACY_PROBE_ROOT.exists(),
        "files": _snapshot(LEGACY_PROBE_ROOT) if LEGACY_PROBE_ROOT.exists() else [],
    }
    before = {"home": _snapshot(inert_home), "extensions": _snapshot(extension_dir), "temp": _snapshot(temp_dir)}
    expected_rows = [(1, "alpha"), (2, "beta"), (3, "gamma")]
    single = duckdb.connect(":memory:")
    _configure(single, allowed, inert_home, extension_dir, temp_dir, 1)
    single_rows = _read(single, allowed, False, False)
    single.close()

    connection = duckdb.connect(":memory:")
    _configure(connection, allowed, inert_home, extension_dir, temp_dir, 2)
    inventory_rows = connection.execute("SELECT name, value, input_type, scope FROM duckdb_settings()").fetchall()
    inventory = {row[0]: {"value": row[1], "type": row[2], "scope": row[3]} for row in inventory_rows}
    fetchall_rows = _read(connection, allowed, True, False)
    bounded_rows = _read(connection, allowed, True, True)
    repeated_rows = _read(connection, allowed, True, False)

    operations = [
        _attempt(connection, "SIBLING_READ", "SELECT * FROM read_csv(?)", [str(sibling.resolve())]),
        _attempt(connection, "OUTSIDE_ABSOLUTE_READ", "SELECT * FROM read_csv(?)", [str(outside.resolve())]),
        _attempt(connection, "PARENT_DIRECTORY_READ", "SELECT * FROM read_csv(?)", [str(probe_root.resolve())]),
        _attempt(connection, "TRAVERSAL_READ", "SELECT * FROM read_csv(?)", [str(allowed_dir / ".." / "outside.csv")]),
        _attempt(connection, "RENAMED_ALTERNATE_READ", "SELECT * FROM read_csv(?)", [str(renamed.resolve())]),
        _attempt(connection, "GLOB_READ", "SELECT * FROM read_csv(?)", [str(allowed_dir / "*.csv")]),
        _attempt(connection, "FILE_LIST_READ", "SELECT * FROM read_csv(?)", [[str(allowed.resolve()), str(sibling.resolve())]]),
        _attempt(connection, "DIRECTORY_SCAN", "SELECT * FROM glob(?)", [str(allowed_dir / "*")]),
        _attempt(connection, "UNC_READ", "SELECT * FROM read_csv('\\\\nonexistent.invalid\\share\\x.csv')"),
        _attempt(connection, "DEVICE_READ", "SELECT * FROM read_csv('\\\\.\\NUL')"),
        _attempt(connection, "ADS_READ", "SELECT * FROM read_csv(?)", [str(allowed) + ":stream"]),
        _attempt(connection, "HTTP_READ", "SELECT * FROM read_csv('http://127.0.0.1:9/x.csv')"),
        _attempt(connection, "HTTPS_READ", "SELECT * FROM read_csv('https://127.0.0.1:9/x.csv')"),
        _attempt(connection, "S3_READ", "SELECT * FROM read_csv('s3://invalid-bucket/x.csv')"),
        _attempt(connection, "AZURE_READ", "SELECT * FROM read_csv('az://invalid/x.csv')"),
        _attempt(connection, "GCS_READ", "SELECT * FROM read_csv('gcs://invalid/x.csv')"),
        _attempt(connection, "INSTALL_EXTENSION", "INSTALL httpfs"),
        _attempt(connection, "INSTALL_COMMUNITY_EXTENSION", "INSTALL spatial FROM community"),
        _attempt(connection, "LOAD_EXTENSION", "LOAD spatial"),
        _attempt(connection, "AUTOLOAD_EXTENSION", "SELECT * FROM sqlite_scan('x.db','x')"),
        _attempt(connection, "ATTACH_DATABASE", "ATTACH 'blocked.duckdb' AS blocked"),
        _attempt(connection, "PERSISTENT_DATABASE_CREATE", "ATTACH 'blocked-create.duckdb' AS blocked_create"),
        _attempt(connection, "ATTACH_SQLITE", "ATTACH 'blocked.sqlite' AS blocked_sqlite (TYPE sqlite)"),
        _attempt(connection, "ARBITRARY_WRITE", "COPY (SELECT 1) TO 'blocked.csv'"),
        _attempt(connection, "CREATE_SECRET", "CREATE SECRET blocked (TYPE S3, KEY_ID 'x', SECRET 'x')"),
        _attempt(connection, "ENABLE_EXTERNAL_ACCESS", "SET enable_external_access = true"),
        _attempt(connection, "ENABLE_AUTOINSTALL", "SET autoinstall_known_extensions = true"),
        _attempt(connection, "ENABLE_AUTOLOAD", "SET autoload_known_extensions = true"),
        _attempt(connection, "ENABLE_UNSIGNED_EXTENSIONS", "SET allow_unsigned_extensions = true"),
        _attempt(connection, "CHANGE_EXTENSION_DIRECTORY", "SET extension_directory = 'other'"),
        _attempt(connection, "CHANGE_HOME_DIRECTORY", "SET home_directory = 'other'"),
        _attempt(connection, "EXPAND_ALLOWED_PATHS", "SET allowed_paths = ['.']"),
        _attempt(connection, "EXPAND_ALLOWED_DIRECTORIES", "SET allowed_directories = ['.']"),
        _attempt(connection, "RAISE_MEMORY_LIMIT", "SET memory_limit = '1GB'"),
        _attempt(connection, "RAISE_TEMP_LIMIT", "SET max_temp_directory_size = '1GB'"),
        _attempt(connection, "CHANGE_THREADS", "SET threads = 8"),
    ]
    if symlink_supported:
        operations.append(_attempt(connection, "SYMLINK_ESCAPE", "SELECT * FROM read_csv(?)", [str(symlink)]))
    connection.close()

    row_bytes = json.dumps(expected_rows, ensure_ascii=False, separators=(",", ":")).encode()
    ordering = {
        "expectedRows": expected_rows,
        "singleThreadFetchall": single_rows,
        "multiThreadFetchall": fetchall_rows,
        "multiThreadFetchmany": bounded_rows,
        "multiThreadRepeated": repeated_rows,
        "canonicalSha256": hashlib.sha256(row_bytes).hexdigest(),
        "passed": single_rows == fetchall_rows == bounded_rows == repeated_rows == expected_rows,
    }
    after = {"home": _snapshot(inert_home), "extensions": _snapshot(extension_dir), "temp": _snapshot(temp_dir)}
    sensitive_tokens = ("DATABASE_URL", "SECRET", "TOKEN", "PASSWORD", "API_KEY", "AWS_", "AZURE_", "GOOGLE_", "PROXY")
    result = {
        "schemaVersion": "1.0.0",
        "duckdbVersion": duckdb.__version__,
        "executable": sys.executable,
        "importPath": duckdb.__file__,
        "database": ":memory:",
        "userSiteEnabled": site.ENABLE_USER_SITE,
        "userSiteInPath": site.getusersitepackages() in sys.path,
        "databaseUrlPresent": "DATABASE_URL" in os.environ,
        "sensitiveEnvironmentPresent": any(any(token in key.upper() for token in sensitive_tokens) for key in os.environ),
        "settings": {name: inventory.get(name) for name in SETTINGS},
        "unsupportedSettings": [name for name in SETTINGS if name not in inventory],
        "restrictedConnectionCreated": True,
        "exactPath": {"expected": "ALLOWED", "actual": "ALLOWED" if single_rows == expected_rows else "MISMATCH", "passed": single_rows == expected_rows, "resultSha256": ordering["canonicalSha256"]},
        "operations": operations,
        "ordering": ordering,
        "directoryContentsBefore": before,
        "directoryContentsAfter": after,
        "spillControlled": after["temp"] == [],
        "legacyProbeAudit": legacy,
        "symlinkSupported": symlink_supported,
        "listenerPortsAvailable": {},
    }
    for port in (3003, 5174):
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", port))
                result["listenerPortsAvailable"][str(port)] = True
            except OSError:
                result["listenerPortsAvailable"][str(port)] = False
    result["probeRootRemoved"] = _remove_probe_root(probe_root)
    result["remainingProbePaths"] = [] if result["probeRootRemoved"] else _snapshot(probe_root)
    result["passed"] = all(operation["passed"] for operation in operations) and ordering["passed"] and result["exactPath"]["passed"] and result["spillControlled"] and result["probeRootRemoved"] and all(result["listenerPortsAvailable"].values()) and not result["databaseUrlPresent"] and not result["sensitiveEnvironmentPresent"]
    return result


if __name__ == "__main__":
    print(json.dumps(run(), ensure_ascii=False, separators=(",", ":")), file=sys.stderr, flush=True)
