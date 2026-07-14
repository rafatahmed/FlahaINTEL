"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Benchmark Result Summarizer
Introduction:
Validates JSONL results and derives a compact deterministic run summary.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from benchmark_lib import validate_run_id, write_json


def summarize(run_root: Path) -> dict[str, object]:
    validate_run_id(run_root.name)
    results = [json.loads(line) for line in (run_root / "engine-results.jsonl").read_text(encoding="utf-8").splitlines()]
    return {"runId": run_root.name, "resultCount": len(results), "engines": sorted({result["engine"] for result in results}),
            "classifications": {name: sum(result["classification"] == name for result in results) for name in sorted({r["classification"] for r in results})},
            "determinismFailures": sum(not result["deterministic"] for result in results),
            "expectationFailures": sum(not result["expectationMatched"] for result in results),
            "totalWallClockNanoseconds": sum(result["wallClockNanoseconds"] for result in results)}


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("run_directory", type=Path); arguments = parser.parse_args()
    summary = summarize(arguments.run_directory.resolve())
    write_json(arguments.run_directory.resolve() / "summary.json", summary)
    print(json.dumps(summary, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
