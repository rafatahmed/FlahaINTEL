"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed HTML Artifact Policy
Introduction:
Validates bounded repository-owned HTML artifact keys before candidate parsing.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import os
import re
from pathlib import Path

MAX_HTML_BYTES = 10 * 1024 * 1024
RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
DRIVE = re.compile(r"^[A-Za-z]:")


def governed_html(root: Path, artifact_key: str, *, max_bytes: int = MAX_HTML_BYTES) -> tuple[Path, bytes]:
    if not isinstance(artifact_key, str) or not artifact_key or "\x00" in artifact_key:
        raise ValueError("INVALID_ARTIFACT_KEY")
    if "\\" in artifact_key or artifact_key.startswith("/") or DRIVE.match(artifact_key):
        raise ValueError("ABSOLUTE_OR_WINDOWS_PATH")
    parts = artifact_key.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise ValueError("PATH_TRAVERSAL")
    for part in parts:
        stem = part.rstrip(" .").split(".", 1)[0].upper()
        if ":" in part:
            raise ValueError("WINDOWS_ADS_OR_DEVICE_PATH")
        if stem in RESERVED:
            raise ValueError("WINDOWS_RESERVED_COMPONENT")
    base = root.resolve(strict=True)
    candidate = base.joinpath(*parts)
    if candidate.suffix.lower() not in {".html", ".htm"}:
        raise ValueError("UNSUPPORTED_ARTIFACT_TYPE")
    current = base
    for part in parts:
        current /= part
        if current.is_symlink():
            raise ValueError("SYMLINK_OR_REPARSE_POINT")
        if os.name == "nt" and current.exists() and os.lstat(current).st_file_attributes & 0x400:
            raise ValueError("SYMLINK_OR_REPARSE_POINT")
    resolved = candidate.resolve(strict=True)
    if resolved != base and base not in resolved.parents:
        raise ValueError("ARTIFACT_ESCAPES_ROOT")
    if not resolved.is_file():
        raise ValueError("ARTIFACT_NOT_FILE")
    size = resolved.stat().st_size
    if size > max_bytes:
        raise ValueError("ARTIFACT_TOO_LARGE")
    return resolved, resolved.read_bytes()
