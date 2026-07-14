"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Pandas Benchmark Runner
Introduction:
Runs pandas against governed datasets and compares it with the stdlib baseline.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import uuid
from pathlib import Path

from benchmark_lib import load_dataset, safe_relative, sha256_file, validate_run_id, write_json
from inspect_environment import inventory
from pandas_adapter import identity, load
from verify_corpus import verify

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "corpus"


def run(run_id: str | None = None, results_root: Path | None = None, determinism_runs: int = 2) -> Path:
    errors = verify(CORPUS)
    if errors:
        raise ValueError("corpus verification failed: " + "; ".join(errors))
    now = dt.datetime.now(dt.timezone.utc)
    run_id = run_id or f"{now:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:8]}"
    validate_run_id(run_id)
    root = safe_relative((results_root or ROOT / "results").resolve(), run_id)
    root.mkdir(parents=True, exist_ok=False)
    (root / "outputs").mkdir(); (root / "logs").mkdir()
    manifest = json.loads((CORPUS / "manifest.json").read_text(encoding="utf-8"))
    results: list[dict[str, object]] = []
    for item in manifest["items"]:
        if item["category"] != "DATASET":
            continue
        modes = [("full", None)]
        if item["id"] == "dataset-streaming":
            modes.append(("chunksize", 64))
        for mode, chunksize in modes:
            attempts = [load(CORPUS, item["path"], chunksize=chunksize) for _ in range(determinism_runs)]
            normalized_attempts = [_without_measurements(value) for value in attempts]
            deterministic = all(value == normalized_attempts[0] for value in normalized_attempts[1:])
            pandas_result = attempts[0]
            expected = json.loads(safe_relative(CORPUS, item["expectedOutputReference"]).read_text(encoding="utf-8"))
            expected_malformed = expected["expectedErrorClassification"] == "MALFORMED_INPUT"
            if expected_malformed and pandas_result["classification"] == "SUCCESS":
                classification = "RECOVERED_MALFORMED_INPUT"
            else:
                classification = pandas_result["classification"]
            stdlib = load_dataset(safe_relative(CORPUS, item["path"]))
            comparison = _compare(pandas_result, stdlib, expected)
            output = {**pandas_result, "classification": classification}
            normalized_bytes = json.dumps(_without_measurements(output), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
            records_bytes = json.dumps(output["records"], ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
            output_reference = f"outputs/{item['id']}-{mode}.json"
            write_json(safe_relative(root, output_reference), output)
            results.append({"frameworkVersion": "1.0.0", "runId": run_id, "timestampUtc": now.isoformat().replace("+00:00", "Z"),
                            **identity(), "corpusItemId": item["id"], "mode": mode, "chunksize": chunksize,
                            "inputSha256": sha256_file(safe_relative(CORPUS, item["path"])),
                            "outputSha256": hashlib.sha256(normalized_bytes).hexdigest(), "outputReference": output_reference,
                            "normalizedRecordsSha256": hashlib.sha256(records_bytes).hexdigest(),
                            "classification": classification, "exceptionType": pandas_result["exceptionType"],
                            "elapsedNanoseconds": pandas_result["elapsedNanoseconds"], "peakMemoryBytes": None,
                            "warnings": pandas_result["warnings"], "deterministic": deterministic, "comparison": comparison})
    with (root / "engine-results.jsonl").open("x", encoding="utf-8", newline="\n") as stream:
        for result in results:
            stream.write(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n")
    write_json(root / "environment.json", {**inventory(), "pandasIdentity": identity(), "databaseUrlPresent": False, "sensitiveEnvironmentCopied": False})
    streaming = [result for result in results if result["corpusItemId"] == "dataset-streaming"]
    write_json(root / "summary.json", {"runId": run_id, "resultCount": len(results),
               "determinismFailures": sum(not result["deterministic"] for result in results),
               "comparisonFailures": sum(not all(result["comparison"].values()) for result in results),
               "streamingOutputsEquivalent": len(streaming) == 2 and streaming[0]["normalizedRecordsSha256"] == streaming[1]["normalizedRecordsSha256"]})
    return root


def _without_measurements(value: dict[str, object]) -> dict[str, object]:
    return {key: item for key, item in value.items() if key not in {"elapsedNanoseconds"}}


def _compare(pandas_result: dict[str, object], stdlib: dict[str, object], expected: dict[str, object]) -> dict[str, bool]:
    encoded = json.dumps(pandas_result["records"], ensure_ascii=False, allow_nan=False)
    pandas_rows = [_semantic_row(row) for row in pandas_result["records"]]
    stdlib_rows = [_semantic_row(row) for row in stdlib["records"]]
    duplicate_retained = len(pandas_rows) == len(stdlib_rows)
    expected_error = expected["expectedErrorClassification"]
    malformed_consistent = expected_error is None or stdlib["classification"] == "MALFORMED_INPUT"
    return {"rowCount": pandas_result["recordCount"] == expected["expectedRecordCount"],
            "fieldValuePreservation": pandas_rows == stdlib_rows,
            "arabicPreserved": "قمح" not in json.dumps(stdlib, ensure_ascii=False) or "قمح" in encoded,
            "duplicateRetention": duplicate_retained,
            "malformedBaselineRecognized": malformed_consistent,
            "jsonFinite": "NaN" not in encoded and "Infinity" not in encoded}


def _semantic_row(row: object) -> object:
    if not isinstance(row, dict):
        return row
    return {str(key): _semantic_value(value) for key, value in row.items()}


def _semantic_value(value: object) -> str:
    if value is None or value == "":
        return "<null>"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--run-id"); arguments = parser.parse_args()
    print(run(arguments.run_id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
