"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Bounded HTML Resource Benchmark Runner
Introduction:
Measures isolated candidate processes on generated small and medium HTML artifacts.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from benchmark_lib import write_json
from measure_process import measure
from run_html_benchmark import CANDIDATES, REPO, ROOT


def run() -> Path:
    generated = ROOT / "generated-corpus/html"
    results = ROOT / "results/html-resource"
    generated.mkdir(parents=True, exist_ok=True)
    results.mkdir(parents=True, exist_ok=True)
    sizes = {"small.html": 100, "medium.html": 2500}
    for name, paragraphs in sizes.items():
        content = "<!doctype html><main><article><h1>Generated resource fixture</h1>" + "".join(f"<p data-i='{index}'>Irrigation evidence {index} المياه</p>" for index in range(paragraphs)) + "</article></main>"
        (generated / name).write_text(content, encoding="utf-8", newline="\n")
    rows = []
    for candidate, (python, adapter) in CANDIDATES.items():
        for name in sizes:
            environment = {"PATH": str(python.parent), "SYSTEMROOT": os.environ.get("SYSTEMROOT", r"C:\Windows"), "TEMP": os.environ.get("TEMP", ""), "PYTHONIOENCODING": "utf-8"}
            value = measure([str(python), "-I", str(adapter), "--corpus-root", str(generated), "--artifact-key", name, "--summary-only"], environment, str(REPO))
            output = json.loads(value.pop("stdout")) if value["exitCode"] == 0 else None
            rows.append({"candidate": candidate, "fixture": name, "inputBytes": (generated / name).stat().st_size, **value, "canonicalOutputSha256": output.get("canonicalOutputSha256") if output else None})
    write_json(results / "summary.json", {"scope": "bounded generated HTML; process peak working set includes interpreter and parser", "rows": rows})
    return results


if __name__ == "__main__":
    print(run())
