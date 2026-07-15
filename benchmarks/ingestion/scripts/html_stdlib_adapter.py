"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Standard-Library HTML Benchmark Adapter
Introduction:
Provides the authoritative dependency-free governed HTML comparison baseline.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from html_artifact_policy import governed_html
from html_encoding_policy import decode_html
from html_shared_extractors import extract, parse_stdlib


def load(root: Path, artifact_key: str, trusted_encoding: str | None = None) -> dict[str, object]:
    started = time.perf_counter_ns()
    _, raw = governed_html(root, artifact_key)
    read_finished = time.perf_counter_ns()
    decoded = decode_html(raw, trusted_encoding)
    decode_finished = time.perf_counter_ns()
    tree, evidence = parse_stdlib(decoded.text)
    parse_finished = time.perf_counter_ns()
    result = extract(tree, candidate="stdlib-html.parser", version=sys.version.split()[0], parser_evidence={"api": "html.parser.HTMLParser", **evidence})
    extraction_finished = time.perf_counter_ns()
    result["encoding"] = {"selected": decoded.encoding, "reason": decoded.reason, "hadBom": decoded.had_bom}
    result["mode"] = "DOM_AND_VISIBLE_TEXT_WITH_SHARED_EXTRACTORS"
    result["phaseTimingsNs"] = {"artifactRead": read_finished - started, "decode": decode_finished - read_finished, "parse": parse_finished - decode_finished, "extractNormalizeHash": extraction_finished - parse_finished, "totalAdapter": extraction_finished - started}
    result["normalizedOutputByteCount"] = len(json.dumps({key: result[key] for key in ("document", "content", "links", "tables", "structuredData", "domEvidence", "evidence")}, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus-root", type=Path, required=True)
    parser.add_argument("--artifact-key", required=True)
    parser.add_argument("--trusted-encoding")
    parser.add_argument("--summary-only", action="store_true")
    args = parser.parse_args()
    value = load(args.corpus_root, args.artifact_key, args.trusted_encoding)
    if args.summary_only:
        value = {"candidate": value["candidate"], "canonicalOutputSha256": value["canonicalOutputSha256"], "domEvidence": value["domEvidence"], "warnings": value["warnings"]}
    sys.stdout.buffer.write((json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8"))
