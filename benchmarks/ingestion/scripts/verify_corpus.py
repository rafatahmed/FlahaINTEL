"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Corpus Manifest Verifier
Introduction:
Validates governed metadata, safe paths, hashes, sizes, and expected outputs.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from benchmark_lib import ALLOWED_CATEGORIES, ALLOWED_LANGUAGES, safe_relative, sha256_file

REQUIRED = {"id", "title", "category", "language", "format", "sourceOwnership", "synthetic", "sha256", "byteSize",
            "path", "expectedOutputReference", "benchmarkDimensions", "limitations", "createdDate", "lastModifiedDate"}


def verify(corpus_root: Path, maximum_bytes: int = 1048576) -> list[str]:
    errors: list[str] = []
    try:
        manifest = json.loads((corpus_root / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"manifest unreadable: {error}"]
    seen: set[str] = set()
    for index, item in enumerate(manifest.get("items", [])):
        label = str(item.get("id", f"item-{index}"))
        missing = REQUIRED - set(item)
        if missing:
            errors.append(f"{label}: missing fields {sorted(missing)}")
        if label in seen:
            errors.append(f"{label}: duplicate corpus ID")
        seen.add(label)
        if item.get("category") not in ALLOWED_CATEGORIES:
            errors.append(f"{label}: unsupported category")
        if item.get("language") not in ALLOWED_LANGUAGES:
            errors.append(f"{label}: unsupported language")
        for field in ("path", "expectedOutputReference"):
            try:
                target = safe_relative(corpus_root, str(item.get(field, "")))
                if not target.is_file():
                    errors.append(f"{label}: {field} does not exist")
            except ValueError as error:
                errors.append(f"{label}: unsafe {field}: {error}")
        try:
            source = safe_relative(corpus_root, str(item.get("path", "")))
            if source.is_file():
                size = source.stat().st_size
                if size != item.get("byteSize"):
                    errors.append(f"{label}: byte size mismatch")
                if size > maximum_bytes:
                    errors.append(f"{label}: item exceeds size limit")
                if sha256_file(source) != item.get("sha256"):
                    errors.append(f"{label}: SHA-256 mismatch")
        except ValueError:
            pass
    return errors


def main() -> int:
    corpus = Path(__file__).resolve().parents[1] / "corpus"
    errors = verify(corpus)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    count = len(json.loads((corpus / "manifest.json").read_text(encoding="utf-8"))["items"])
    print(f"Verified {count} governed corpus items.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
