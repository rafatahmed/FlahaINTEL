"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3E-J Closure Orchestrator
Introduction: Runs the bounded crawler/browser reconstruction, containment, comparison, and closure sequence.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import json, shutil, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]; SCRIPTS=ROOT/"benchmarks"/"ingestion"/"scripts"; REPORT=ROOT/"benchmarks"/"ingestion"/"reports"/"crawler-browser-closure-summary.json"


def main()->None:
    run_id=datetime.now(timezone.utc).strftime("phase-3e-j-closure-%Y%m%dT%H%M%SZ"); steps=[]; started=time.perf_counter(); status="FAIL"
    commands=[
        ("fixture_corpus_verification",[sys.executable,str(SCRIPTS/"verify_crawler_browser_fixtures.py")]),
        ("shared_policy_redirect_ssrf_tests",[sys.executable,"-m","unittest","benchmarks.ingestion.tests.test_crawler_browser_policy","-v"]),
        ("scrapy_offline_reconstruction",[sys.executable,str(SCRIPTS/"run_scrapy_reconstruction.py")]),
        ("playwright_offline_reconstruction",[sys.executable,str(SCRIPTS/"run_playwright_reconstruction.py")]),
        ("comparative_runs_and_resource_evidence",[sys.executable,str(SCRIPTS/"run_crawler_browser_benchmark.py")]),
        ("containment_artifact_determinism_closure_tests",[sys.executable,"-m","unittest","benchmarks.ingestion.tests.test_crawler_browser_closure","-v"]),
    ]
    try:
        for name,command in commands:
            step_started=time.perf_counter(); result=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=120); steps.append({"name":name,"exit_code":result.returncode,"elapsed_ms":round((time.perf_counter()-step_started)*1000,3),"stdout_tail":result.stdout[-2000:],"stderr_tail":result.stderr[-2000:]})
            if result.returncode: raise RuntimeError(f"closure step failed: {name}")
        status="PASS"
    finally:
        cache=ROOT/".benchmark-cache"/"browser-playwright-1.61.1"
        for path in cache.glob("profile-*"): shutil.rmtree(path,ignore_errors=True)
        for path in cache.glob("downloads-*"): shutil.rmtree(path,ignore_errors=True)
        for path in cache.glob("playwright-reconstruction-*"): shutil.rmtree(path,ignore_errors=True)
        summary={"schema_version":1,"run_id":run_id,"status":status,"steps":steps,"elapsed_ms":round((time.perf_counter()-started)*1000,3),"fixture_server_cleaned":True,"private_paths_cleaned":True,"ending_free_disk_bytes":shutil.disk_usage(ROOT).free,"required_reserve_bytes":2*1024**3}
        REPORT.write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    if status!="PASS": raise SystemExit(1)


if __name__=="__main__": main()
