"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Dependency-Free Baseline Runner
Introduction:
Runs governed HTML and dataset baselines into an immutable per-run directory.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from benchmark_lib import extract_html, load_dataset, safe_relative, sha256_file, validate_run_id, write_json
from inspect_environment import inventory
from verify_corpus import verify

ROOT = Path(__file__).resolve().parents[1]


def git_value(args: list[str]) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT.parents[1], capture_output=True, text=True, timeout=5, check=False,
                            env={"SYSTEMROOT": os.environ.get("SYSTEMROOT", ""), "PATH": os.environ.get("PATH", "")})
    return result.stdout.strip()[:256]


def run(determinism_runs: int, run_id: str | None = None, results_root: Path | None = None) -> Path:
    corpus = ROOT / "corpus"
    errors = verify(corpus)
    if errors:
        raise ValueError("corpus verification failed: " + "; ".join(errors))
    now = dt.datetime.now(dt.timezone.utc)
    run_id = run_id or f"{now:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:8]}"
    validate_run_id(run_id)
    results_root = (results_root or ROOT / "results").resolve()
    run_root = safe_relative(results_root, run_id)
    run_root.mkdir(parents=True, exist_ok=False)
    for directory in ("outputs", "logs"):
        (run_root / directory).mkdir()
    environment = inventory()
    write_json(run_root / "environment.json", environment)
    manifest = json.loads((corpus / "manifest.json").read_text(encoding="utf-8"))
    results = []
    determinism_failures = 0
    for item in manifest["items"]:
        if item["category"] not in {"HTML", "DATASET"}:
            continue
        source = safe_relative(corpus, item["path"])
        expected = json.loads(safe_relative(corpus, item["expectedOutputReference"]).read_text(encoding="utf-8"))
        engine = "python-stdlib-html" if item["category"] == "HTML" else "python-stdlib-datasets"
        outputs = []
        started_wall = time.perf_counter_ns(); started_cpu = time.process_time_ns()
        for _ in range(determinism_runs):
            outputs.append(extract_html(source) if item["category"] == "HTML" else load_dataset(source))
        wall_ns = time.perf_counter_ns() - started_wall; cpu_ns = time.process_time_ns() - started_cpu
        output_bytes = json.dumps(outputs[0], ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        deterministic = all(value == outputs[0] for value in outputs[1:])
        if item["category"] == "HTML":
            expectation_matched = outputs[0]["text"] == expected["expectedNormalizedText"]
        else:
            expectation_matched = (outputs[0]["recordCount"] == expected["expectedRecordCount"] and
                                   (outputs[0]["classification"] if outputs[0]["classification"] != "SUCCESS" else None) == expected["expectedErrorClassification"])
        if not deterministic:
            determinism_failures += 1
        output_relative = f"outputs/{item['id']}.json"
        write_json(safe_relative(run_root, output_relative), outputs[0])
        results.append({"frameworkVersion": "1.0.0", "runId": run_id, "timestampUtc": now.isoformat().replace("+00:00", "Z"),
                        "engine": engine, "engineVersion": platform_version(), "invocation": "in-process Python standard library",
                        "configuration": {"determinismRuns": determinism_runs}, "model": None, "languageData": None,
                        "corpusItemId": item["id"], "inputSha256": sha256_file(source),
                        "outputSha256": hashlib.sha256(output_bytes).hexdigest(), "outputReference": output_relative,
                        "wallClockNanoseconds": wall_ns, "cpuNanoseconds": cpu_ns, "peakMemoryBytes": None,
                        "exitCode": 0, "stdoutBytes": 0, "stderrBytes": 0, "warnings": ["peak memory unavailable from Python standard library"],
                        "classification": outputs[0].get("classification", "SUCCESS"), "deterministic": deterministic})
        results[-1]["expectationMatched"] = expectation_matched
    with (run_root / "engine-results.jsonl").open("x", encoding="utf-8", newline="\n") as stream:
        for result in results:
            stream.write(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    write_json(run_root / "run-manifest.json", {"frameworkVersion": "1.0.0", "runId": run_id, "gitCommit": git_value(["rev-parse", "HEAD"]),
               "dirtyWorktree": bool(git_value(["status", "--porcelain=v1"])), "timestampUtc": now.isoformat().replace("+00:00", "Z"),
               "networkUsed": False, "databaseUsed": False, "resultCount": len(results)})
    write_json(run_root / "summary.json", {"runId": run_id, "resultCount": len(results), "successful": sum(r["classification"] == "SUCCESS" for r in results),
               "malformedInputs": sum(r["classification"] == "MALFORMED_INPUT" for r in results), "determinismFailures": determinism_failures,
               "expectationFailures": sum(not r["expectationMatched"] for r in results)})
    return run_root


def platform_version() -> str:
    return f"Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro} stdlib"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--determinism-runs", type=int, default=2, choices=range(2, 11))
    parser.add_argument("--run-id")
    arguments = parser.parse_args()
    print(run(arguments.determinism_runs, arguments.run_id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
