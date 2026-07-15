"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Playwright Offline Browser Reconstruction
Introduction: Restores and launches the pinned browser exclusively from a local candidate archive.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import hashlib, json, os, shutil, subprocess, sys, time, zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]; SCRIPTS=ROOT/"benchmarks"/"ingestion"/"scripts"; REPORTS=ROOT/"benchmarks"/"ingestion"/"reports"
ARCHIVE=ROOT/".benchmark-cache"/"browser-playwright-1.61.1"/"playwright-chromium-headless-shell-149.0.7827.55-r1228-win64.zip"


def main() -> None:
    run_id=datetime.now(timezone.utc).strftime("playwright-reconstruction-%Y%m%dT%H%M%SZ"); destination=ROOT/".benchmark-cache"/"browser-playwright-1.61.1"/run_id; output=destination/"acquisition.json"
    start_free=shutil.disk_usage(ROOT).free; required=2*1024**3; projected=start_free-ARCHIVE.stat().st_size*3
    if projected < required: raise SystemExit("disk_reserve_preflight_failed")
    server=None; started=time.perf_counter(); evidence={"schema_version":1,"run_id":run_id,"network_mode":"shared exact-origin policy; no package or browser download","archive_filename":ARCHIVE.name,"archive_bytes":ARCHIVE.stat().st_size,"archive_sha256":hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),"download_source_identity":"locally reconstructed from installed Playwright revision 1228 payload originally obtained from cdn.playwright.dev","playwright_version":"1.61.1","browser_name":"chromium-headless-shell","chromium_version":"149.0.7827.55","browser_revision":"1228"}
    try:
        destination.mkdir(parents=True); zipfile.ZipFile(ARCHIVE).extractall(destination)
        executable=destination/"chromium_headless_shell-1228"/"chrome-headless-shell-win64"/"chrome-headless-shell.exe"; evidence["executable_relative_path"]=str(executable.relative_to(destination)); evidence["executable_sha256"]=hashlib.sha256(executable.read_bytes()).hexdigest(); evidence["installed_layout"]=sorted(item.name for item in destination.iterdir())
        server=subprocess.Popen([sys.executable,str(SCRIPTS/"crawler_browser_fixture_server.py")],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True); port=json.loads(server.stdout.readline())["port"]
        temp=destination/"temp"; temp.mkdir(); env=os.environ.copy(); env["PLAYWRIGHT_BROWSERS_PATH"]=str(destination); env["TEMP"]=env["TMP"]=str(temp)
        command=["node",str(SCRIPTS/"browser_playwright_adapter.mjs"),"--port",str(port),"--output",str(output)]
        run=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,text=True,timeout=30); evidence["launch_exit_code"]=run.returncode
        if run.returncode: raise RuntimeError(run.stderr)
        acquired=json.loads(output.read_text(encoding="utf-8")); evidence["governed_dynamic_sha256"]=acquired["rendered_sha256"]; evidence["policy_rejections"]=acquired["policy_rejections"]; evidence["status"]="PASS"
    finally:
        if server:
            server.terminate()
            try: server.wait(3)
            except subprocess.TimeoutExpired: server.kill(); server.wait(3)
        shutil.rmtree(destination,ignore_errors=True); evidence["destination_removed"]=not destination.exists(); evidence["elapsed_ms"]=round((time.perf_counter()-started)*1000,3); evidence["ending_free_disk_bytes"]=shutil.disk_usage(ROOT).free
        REPORTS.joinpath("crawler-browser-playwright-reconstruction.json").write_text(json.dumps(evidence,indent=2)+"\n",encoding="utf-8")


if __name__=="__main__": main()
