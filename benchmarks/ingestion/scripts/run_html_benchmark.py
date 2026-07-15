"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed HTML Extraction Benchmark Runner
Introduction:
Runs isolated HTML candidates twice over the governed corpus and records evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-16
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

from benchmark_lib import safe_relative, validate_run_id, write_json
from verify_corpus import verify

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
CORPUS = ROOT / "corpus"
CANDIDATES = {
    "stdlib": (Path(sys.executable), ROOT / "scripts/html_stdlib_adapter.py"),
    "lxml": (REPO / ".benchmark-envs/html-lxml-6.1.1-py314/Scripts/python.exe", ROOT / "scripts/html_lxml_adapter.py"),
    "selectolax": (REPO / ".benchmark-envs/html-selectolax-0.4.10-py314/Scripts/python.exe", ROOT / "scripts/html_selectolax_adapter.py"),
}


def run(run_id: str | None = None, results_root: Path | None = None) -> Path:
    errors = verify(CORPUS)
    if errors:
        raise ValueError("corpus verification failed")
    now = dt.datetime.now(dt.timezone.utc)
    run_id = run_id or f"{now:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:8]}"
    validate_run_id(run_id)
    run_root = safe_relative((results_root or ROOT / "results").resolve(), run_id)
    run_root.mkdir(parents=True, exist_ok=False)
    manifest = json.loads((CORPUS / "manifest.json").read_text(encoding="utf-8"))
    rows = []
    for item in manifest["items"]:
        if item["category"] != "HTML":
            continue
        for candidate, (python, adapter) in CANDIDATES.items():
            attempts = [_invoke(python, adapter, item["path"]) for _ in range(2)]
            hashes = [value.get("canonicalOutputSha256") for value in attempts if value.get("classification") == "SUCCESS"]
            output = attempts[0].get("output")
            rows.append({"candidate": candidate, "candidateVersion": output.get("candidateVersion") if output else None, "mode": output.get("mode") if output else "GOVERNED_DECODE_AND_PARSE", "corpusItemId": item["id"], "sourceFilename": item["path"], "sourceSha256": item["sha256"], "selectedEncoding": output.get("encoding", {}).get("selected") if output else None, "encodingReason": output.get("encoding", {}).get("reason") if output else None, "warnings": output.get("warnings", []) if output else [], "classification": attempts[0]["classification"], "errorCode": attempts[0].get("errorCode"), "normalizedOutput": {key: output[key] for key in ("document", "content", "links", "tables", "structuredData", "domEvidence", "evidence")} if output else None, "canonicalOutputSha256": attempts[0].get("canonicalOutputSha256"), "deterministic": attempts[0]["stable"] == attempts[1]["stable"], "phaseTimingsNs": {**(output.get("phaseTimingsNs", {}) if output else {}), "coldProcessWall": attempts[0]["wallNanoseconds"]}, "outputByteCount": output.get("normalizedOutputByteCount") if output else 0})
    with (run_root / "engine-results.jsonl").open("x", encoding="utf-8", newline="\n") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n")
    successful = [row for row in rows if row["classification"] == "SUCCESS"]
    write_json(run_root / "summary.json", {"runId": run_id, "timestampUtc": now.isoformat().replace("+00:00", "Z"), "resultCount": len(rows), "successCount": len(successful), "classifiedFailureCount": len(rows) - len(successful), "determinismFailures": sum(not row["deterministic"] for row in rows), "candidateCounts": {name: sum(row["candidate"] == name for row in rows) for name in CANDIDATES}, "crossCandidateContentMatches": _matches(successful, "content"), "crossCandidateMetadataMatches": _matches(successful, "document")})
    return run_root


def _invoke(python: Path, adapter: Path, key: str) -> dict[str, object]:
    started = time.perf_counter_ns()
    environment = {"PATH": str(python.parent), "SYSTEMROOT": os.environ.get("SYSTEMROOT", r"C:\Windows"), "TEMP": os.environ.get("TEMP", ""), "PYTHONIOENCODING": "utf-8"}
    completed = subprocess.run([str(python), "-I", str(adapter), "--corpus-root", str(CORPUS), "--artifact-key", key], capture_output=True, text=True, encoding="utf-8", env=environment, shell=False, timeout=15, check=False)
    elapsed = time.perf_counter_ns() - started
    if completed.returncode:
        error = "UNDECODABLE_INPUT" if "UNDECODABLE_INPUT" in completed.stderr else "DOM_LIMIT_EXCEEDED" if "DOM_LIMIT_EXCEEDED" in completed.stderr else "CANDIDATE_ERROR"
        stable = {"classification": "QUARANTINED", "errorCode": error}
        return {**stable, "stable": stable, "wallNanoseconds": elapsed}
    output = json.loads(completed.stdout)
    stable = {key: value for key, value in output.items() if key not in {"canonicalOutputSha256", "phaseTimingsNs"}}
    return {"classification": "SUCCESS", "canonicalOutputSha256": output["canonicalOutputSha256"], "output": output, "stable": stable, "wallNanoseconds": elapsed}


def _matches(rows: list[dict[str, object]], field: str) -> int:
    total = 0
    for item_id in {str(row["corpusItemId"]) for row in rows}:
        values = [hashlib.sha256(json.dumps(row["normalizedOutput"][field], ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest() for row in rows if row["corpusItemId"] == item_id]
        total += int(len(values) == len(CANDIDATES) and len(set(values)) == 1)
    return total


if __name__ == "__main__":
    print(run())
