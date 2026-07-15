"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Gate A Evidence Probe
Introduction:
Verifies the pinned wheel and isolated runtime without network access.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations

import base64
import csv
import hashlib
import importlib.metadata as metadata
import importlib.util
import json
import os
import pathlib
import site
import socket
import struct
import sys
import zipfile
from contextlib import redirect_stderr, redirect_stdout
from email.parser import Parser
from io import StringIO

import duckdb
import _duckdb

ROOT = pathlib.Path(__file__).resolve().parents[3]
WHEEL_ROOT = ROOT / ".benchmark-wheelhouse" / "duckdb-1.5.4-py314-win-amd64"
WHEEL = WHEEL_ROOT / "duckdb-1.5.4-cp314-cp314-win_amd64.whl"
EXPECTED_HASH = "6dcbb81a1276bc48deb4d562bce4f8895e4fc6348750a096e30052345c6d6552"
FORBIDDEN = ("numpy", "pandas", "polars", "pyarrow", "fsspec", "sqlalchemy")


def _record_digest(data: bytes) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode().rstrip("=")


def _pe_machine(path: pathlib.Path) -> str:
    data = path.read_bytes()
    offset = struct.unpack_from("<I", data, 0x3C)[0]
    machine = struct.unpack_from("<H", data, offset + 4)[0]
    return {0x8664: "AMD64"}.get(machine, f"UNKNOWN_0x{machine:04x}")


def run() -> dict:
    top_level = sorted(path.name for path in WHEEL_ROOT.iterdir() if path.is_file())
    with zipfile.ZipFile(WHEEL) as archive:
        names = archive.namelist()
        metadata_name = next(name for name in names if name.endswith(".dist-info/METADATA"))
        wheel_name = next(name for name in names if name.endswith(".dist-info/WHEEL"))
        record_name = next(name for name in names if name.endswith(".dist-info/RECORD"))
        license_names = sorted(name for name in names if "license" in name.lower())
        package_metadata = Parser().parsestr(archive.read(metadata_name).decode("utf-8"))
        wheel_metadata = Parser().parsestr(archive.read(wheel_name).decode("utf-8"))
        record_rows = list(csv.reader(archive.read(record_name).decode("utf-8").splitlines()))
        verified = 0
        failures = []
        for name, encoded_hash, size in record_rows:
            if not encoded_hash:
                continue
            payload = archive.read(name)
            expected = encoded_hash.removeprefix("sha256=")
            if _record_digest(payload) != expected or len(payload) != int(size):
                failures.append(name)
            else:
                verified += 1
        native_names = sorted(name for name in names if pathlib.PurePosixPath(name).suffix.lower() in {".pyd", ".dll", ".duckdb_extension"})
    distributions = sorted((item.metadata["Name"].lower(), item.version) for item in metadata.distributions())
    editable = sorted(str(path) for path in pathlib.Path(sys.prefix, "Lib", "site-packages").rglob("direct_url.json"))
    pth = sorted(str(path) for path in pathlib.Path(sys.prefix, "Lib", "site-packages").glob("*.pth"))
    sensitive_tokens = ("DATABASE_URL", "SECRET", "TOKEN", "PASSWORD", "API_KEY", "AWS_", "AZURE_", "GOOGLE_", "PROXY")
    listeners = {}
    for port in (3003, 5174):
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", port))
                listeners[str(port)] = True
            except OSError:
                listeners[str(port)] = False
    pip_stdout = StringIO()
    pip_stderr = StringIO()
    from pip._internal.cli.main import main as pip_main
    with redirect_stdout(pip_stdout), redirect_stderr(pip_stderr):
        pip_exit_code = pip_main(["check"])
    result = {
        "schemaVersion": "1.0.0",
        "wheel": {
            "filename": WHEEL.name,
            "topLevelDownloadedArtifacts": top_level,
            "inspectionArtifactCount": len([path for path in (WHEEL_ROOT / ".inspection").rglob("*") if path.is_file()]),
            "byteSize": WHEEL.stat().st_size,
            "sha256": hashlib.sha256(WHEEL.read_bytes()).hexdigest(),
            "distribution": package_metadata["Name"],
            "version": package_metadata["Version"],
            "tags": wheel_metadata.get_all("Tag", []),
            "licenseExpression": package_metadata.get("License-Expression"),
            "licenseFiles": license_names,
            "requiresDist": package_metadata.get_all("Requires-Dist", []),
            "recordEntries": len(record_rows),
            "recordEntriesVerified": verified,
            "recordFailures": failures,
            "nativeInventory": native_names,
        },
        "runtime": {
            "duckdbVersion": duckdb.__version__,
            "executable": sys.executable,
            "importPath": duckdb.__file__,
            "nativePath": _duckdb.__file__,
            "nativeMachine": _pe_machine(pathlib.Path(_duckdb.__file__)),
            "distributionInventory": distributions,
            "forbiddenModulesImportable": {name: importlib.util.find_spec(name) is not None for name in FORBIDDEN},
            "userSiteEnabled": site.ENABLE_USER_SITE,
            "userSiteInPath": site.getusersitepackages() in sys.path,
            "systemSiteEnabled": sys.base_prefix == sys.prefix,
            "externalPth": pth,
            "editableInstallMetadata": editable,
            "databaseUrlPresent": "DATABASE_URL" in os.environ,
            "sensitiveEnvironmentPresent": any(any(token in key.upper() for token in sensitive_tokens) for key in os.environ),
            "listenerPortsAvailable": listeners,
            "pipCheck": {
                "exitCode": pip_exit_code,
                "stdout": pip_stdout.getvalue().strip(),
                "stderr": pip_stderr.getvalue().strip(),
            },
        },
    }
    result["passed"] = (
        top_level == [WHEEL.name]
        and result["wheel"]["byteSize"] == 13666989
        and result["wheel"]["sha256"] == EXPECTED_HASH
        and result["wheel"]["distribution"].lower() == "duckdb"
        and result["wheel"]["version"] == "1.5.4"
        and result["wheel"]["tags"] == ["cp314-cp314-win_amd64"]
        and failures == [] and native_names == ["_duckdb.cp314-win_amd64.pyd"]
        and duckdb.__version__ == "1.5.4" and distributions == [("duckdb", "1.5.4"), ("pip", "25.2")]
        and not any(result["runtime"]["forbiddenModulesImportable"].values())
        and not result["runtime"]["userSiteEnabled"] and not result["runtime"]["userSiteInPath"]
        and not result["runtime"]["systemSiteEnabled"] and not pth and not editable
        and not result["runtime"]["databaseUrlPresent"] and not result["runtime"]["sensitiveEnvironmentPresent"]
        and result["runtime"]["pipCheck"]["exitCode"] == 0
        and all(listeners.values()) and result["runtime"]["nativeMachine"] == "AMD64"
    )
    return result


if __name__ == "__main__":
    print(json.dumps(run(), ensure_ascii=False, separators=(",", ":")), file=sys.stderr, flush=True)
