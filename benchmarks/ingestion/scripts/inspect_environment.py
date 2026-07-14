"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Benchmark Environment Inspector
Introduction:
Collects a redacted, dependency-free inventory without network access.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import importlib.metadata
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

CANDIDATE_PACKAGES = ["docling", "trafilatura", "paddleocr", "pandas", "polars", "pyarrow", "duckdb"]
COMMANDS = ["node", "npm", "java", "tesseract", "docker", "magick", "pdftotext", "qpdf", "libreoffice"]


def command_version(command: str) -> dict[str, object]:
    executable = shutil.which(command)
    if not executable:
        return {"available": False, "version": None}
    args = [executable, "--version"]
    if command == "java":
        args = [executable, "-version"]
    try:
        completed = subprocess.run(args, capture_output=True, text=True, timeout=5, check=False,
                                   env={"SYSTEMROOT": os.environ.get("SYSTEMROOT", ""), "PATH": os.path.dirname(executable)})
        version = (completed.stdout or completed.stderr).splitlines()[0][:256]
    except (OSError, subprocess.TimeoutExpired) as error:
        version = f"UNAVAILABLE: {type(error).__name__}"
    return {"available": True, "version": version}


def inventory() -> dict[str, object]:
    packages: dict[str, str | None] = {}
    for package in CANDIDATE_PACKAGES:
        try:
            packages[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            packages[package] = None
    disk = shutil.disk_usage(Path(__file__).anchor)
    return {
        "schemaVersion": "1.0.0",
        "operatingSystem": {"system": platform.system(), "release": platform.release(), "version": platform.version(), "architecture": platform.machine()},
        "cpu": {"model": platform.processor() or "UNAVAILABLE", "logicalCores": os.cpu_count()},
        "memory": {"totalBytes": None, "availableBytes": None, "measurement": "UNAVAILABLE_FROM_STDLIB"},
        "disk": {"freeBytes": disk.free, "totalBytes": disk.total},
        "python": {"executable": "<configured-python>", "version": platform.python_version(), "implementation": platform.python_implementation()},
        "commands": {command: command_version(command) for command in COMMANDS},
        "candidatePythonPackages": packages,
        "arabicOcrLanguageData": "NOT_INSTALLED" if not shutil.which("tesseract") else "NOT_INSPECTED",
        "internetAccess": "NOT_TESTED_NETWORK_DISABLED",
        "databaseUrlPresent": False,
        "sensitiveEnvironmentCopied": False,
    }


def main() -> int:
    json.dump(inventory(), sys.stdout, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
