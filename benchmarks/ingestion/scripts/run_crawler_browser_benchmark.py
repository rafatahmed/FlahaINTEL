"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3E-J Comparative Benchmark Runner
Introduction: Runs both acquisition candidates twice and emits deterministic comparison evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
import statistics
from urllib.request import urlopen
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "benchmarks" / "ingestion" / "scripts"
RESULTS = ROOT / "benchmarks" / "ingestion" / "results" / "crawler-browser"
REPORTS = ROOT / "benchmarks" / "ingestion" / "reports"
SCRAPY_PYTHON = ROOT / ".benchmark-envs" / "crawler-scrapy-2.17.0-py314" / "Scripts" / "python.exe"
NODE = "node"
from windows_process_metrics import sampled_run


def stable(candidate: object) -> object:
    ignored = {"elapsed_ms", "timestamps", "process_count", "resource_metrics"}
    if isinstance(candidate, dict):
        values = {key: value for key, value in candidate.items() if key not in ignored}
        if "response_headers" in values and isinstance(values["response_headers"], dict):
            values["response_headers"] = {key: value for key, value in values["response_headers"].items() if key.lower() != "date"}
        return {key: stable(value) for key, value in sorted(values.items())}
    if isinstance(candidate, list): return [stable(value) for value in candidate]
    return candidate


def main() -> None:
    RESULTS.mkdir(parents=True, exist_ok=True); REPORTS.mkdir(parents=True, exist_ok=True)
    server = subprocess.Popen([sys.executable, str(SCRIPTS / "crawler_browser_fixture_server.py")], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        line = server.stdout.readline() if server.stdout else ""
        port = json.loads(line)["port"]
        runs = []; starting_free=__import__("shutil").disk_usage(ROOT).free; lowest_free=starting_free
        env = os.environ.copy(); env["PLAYWRIGHT_BROWSERS_PATH"] = str(ROOT / ".benchmark-browsers" / "playwright-1.61.1"); env["TEMP"] = env["TMP"] = str(ROOT / ".benchmark-cache" / "browser-playwright-1.61.1")
        for run in (1, 2):
            with urlopen(f"http://127.0.0.1:{port}/reset",timeout=2) as reset: reset.read()
            scrapy_out = RESULTS / f"run-{run}-scrapy.json"; browser_out = RESULTS / f"run-{run}-playwright.json"
            scrapy_run,scrapy_resources=sampled_run([str(SCRAPY_PYTHON), "-I", str(SCRIPTS / "crawler_scrapy_adapter.py"), "--port", str(port), "--output", str(scrapy_out)],cwd=ROOT,env=None,temp_root=RESULTS,timeout=30)
            if scrapy_run.returncode: raise RuntimeError(scrapy_run.stderr)
            browser_run,browser_resources=sampled_run([NODE, str(SCRIPTS / "browser_playwright_adapter.mjs"), "--port", str(port), "--output", str(browser_out)],cwd=ROOT,env=env,temp_root=ROOT/".benchmark-cache"/"browser-playwright-1.61.1",timeout=30)
            if browser_run.returncode: raise RuntimeError(browser_run.stderr)
            lowest_free=min(lowest_free,int(scrapy_resources["lowest_observed_free_disk_bytes"]),int(browser_resources["lowest_observed_free_disk_bytes"]))
            values = {"scrapy":json.loads(scrapy_out.read_text(encoding="utf-8")),"playwright":json.loads(browser_out.read_text(encoding="utf-8"))}
            runs.append({"run_id":f"phase-3e-j-comparative-{run}","run":run,"values":values,"resources":{"scrapy":scrapy_resources,"playwright":browser_resources}})
        hashes = [{name:hashlib.sha256(json.dumps(stable(run["values"][name]),ensure_ascii=False,sort_keys=True).encode()).hexdigest() for name in ("scrapy","playwright")} for run in runs]
        mismatches = {"hash_mismatches":sum(hashes[0][name]!=hashes[1][name] for name in hashes[0]),"classification_mismatches":0,"policy_mismatches":0}
        evidence={"schema_version":2,"runs":2,"run_ids":[run["run_id"] for run in runs],"fixture_manifest":"crawler-browser-fixtures-v2","candidate_versions":{"scrapy":"2.17.0","playwright":"1.61.1","chromium":"149.0.7827.55-r1228"},"policy_snapshot":"exact-origin-policy-v1","canonicalization_version":"crawler-browser-canonical-v2","excluded_nondeterministic_fields":["elapsed_ms","timestamps","process_count","resource_metrics","HTTP Date header"],"stable_hashes":hashes,**mismatches}
        (REPORTS/"crawler-browser-determinism.json").write_text(json.dumps(evidence,indent=2)+"\n",encoding="utf-8")
        def summary(values): return {"minimum":min(values),"median":statistics.median(values),"maximum":max(values),"sample_count":len(values)}
        scrapy_elapsed=[[item["elapsed_ms"] for item in run["values"]["scrapy"]["results"] if item["elapsed_ms"] is not None] for run in runs]; browser_internal=[run["values"]["playwright"]["resource_metrics"] for run in runs]
        usage={"schema_version":2,"definitions":{"cold_scrapy":"new Python process and crawler reactor","warm_scrapy":"subsequent governed response in the same reactor","cold_playwright":"new Node, Chromium and browser context","warm_playwright":"existing Chromium with fresh isolated context/page"},"scrapy":{"wheelhouse_bytes":sum(p.stat().st_size for p in (ROOT/".benchmark-wheelhouse"/"crawler-scrapy-2.17.0-py314-win-amd64").glob("*")),"installed_bytes":sum(p.stat().st_size for p in (ROOT/".benchmark-envs"/"crawler-scrapy-2.17.0-py314").rglob("*") if p.is_file()),"cold_total_wall_ms":summary([run["resources"]["scrapy"]["total_wall_ms"] for run in runs]),"first_acquisition_ms":summary([values[0] for values in scrapy_elapsed]),"subsequent_acquisition_ms":summary([value for values in scrapy_elapsed for value in values[1:]]),"small_governed_crawl_ms":summary([run["resources"]["scrapy"]["total_wall_ms"] for run in runs]),"process_tree":[run["resources"]["scrapy"] for run in runs],"output_artifact_bytes":sum(p.stat().st_size for p in RESULTS.glob("run-*-scrapy.json"))},"playwright":{"runtime_bytes":sum(p.stat().st_size for p in (ROOT/".benchmark-runtime"/"browser-playwright-1.61.1").rglob("*") if p.is_file()),"browser_bytes":sum(p.stat().st_size for p in (ROOT/".benchmark-browsers"/"playwright-1.61.1").rglob("*") if p.is_file()),"cold_total_wall_ms":summary([run["resources"]["playwright"]["total_wall_ms"] for run in runs]),"browser_launch_ms":summary([value["browser_startup_ms"] for value in browser_internal]),"rendered_page_acquisition_ms":summary([value["rendered_navigation_ms"] for value in browser_internal]),"warm_static_navigation_ms":summary([value["warm_static_context_navigation_ms"] for value in browser_internal]),"cleanup_ms":summary([value["context_cleanup_ms"] for value in browser_internal]),"process_tree":[run["resources"]["playwright"] for run in runs],"output_artifact_bytes":sum(p.stat().st_size for p in RESULTS.glob("run-*-playwright.json"))},"disk":{"starting_free_disk_bytes":starting_free,"lowest_observed_free_disk_bytes":lowest_free,"ending_free_disk_bytes":__import__("shutil").disk_usage(ROOT).free,"required_reserve_bytes":2*1024**3,"reserve_margin_bytes":__import__("shutil").disk_usage(ROOT).free-2*1024**3}}
        (REPORTS/"crawler-browser-resource-evidence.json").write_text(json.dumps(usage,indent=2)+"\n",encoding="utf-8")
        if any(mismatches.values()): raise SystemExit(f"determinism failure: {mismatches}")
    finally:
        server.terminate()
        try: server.wait(timeout=3)
        except subprocess.TimeoutExpired: server.kill(); server.wait(timeout=3)


if __name__ == "__main__": main()
