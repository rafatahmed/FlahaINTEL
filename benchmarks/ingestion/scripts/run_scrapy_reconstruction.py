"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Scrapy Offline Environment Reconstruction
Introduction: Rebuilds, validates, exercises, and removes the exact hashed Scrapy runtime.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import json, os, shutil, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]; SCRIPTS=ROOT/"benchmarks"/"ingestion"/"scripts"; REPORTS=ROOT/"benchmarks"/"ingestion"/"reports"; WHEELS=ROOT/".benchmark-wheelhouse"/"crawler-scrapy-2.17.0-py314-win-amd64"; REQUIREMENTS=ROOT/"benchmarks"/"ingestion"/"config"/"crawler-scrapy-2.17.0-hashed-requirements.txt"


def execute(command:list[str],**kwargs)->subprocess.CompletedProcess[str]:
    result=subprocess.run(command,capture_output=True,text=True,**kwargs)
    if result.returncode: raise RuntimeError(f"{command}\n{result.stdout}\n{result.stderr}")
    return result


def main()->None:
    run_id=datetime.now(timezone.utc).strftime("scrapy-reconstruction-%Y%m%dT%H%M%SZ"); destination=ROOT/".benchmark-cache"/"crawler-scrapy-2.17.0"/run_id; evidence={"schema_version":1,"run_id":run_id,"wheel_count":len(list(WHEELS.glob("*.whl"))),"sdist_count":len(list(WHEELS.glob("*.tar.gz"))),"install_flags":["--no-index","--find-links","--require-hashes"]}; server=None; started=time.perf_counter()
    if shutil.disk_usage(ROOT).free-180_000_000 < 2*1024**3: raise SystemExit("disk_reserve_preflight_failed")
    try:
        execute([sys.executable,"-m","venv",str(destination)]); python=destination/"Scripts"/"python.exe"
        execute([str(python),"-I","-m","pip","install","--no-index","--find-links",str(WHEELS),"--require-hashes","-r",str(REQUIREMENTS)],cwd=ROOT)
        evidence["pip_check"]=execute([str(python),"-I","-m","pip","check"],cwd=ROOT).stdout.strip(); inventory=execute([str(python),"-I","-m","pip","freeze","--all"],cwd=ROOT).stdout.splitlines(); evidence["distribution_inventory"]=sorted(inventory,key=str.lower)
        isolation=execute([str(python),"-I","-c","import json,site,sys,scrapy; from twisted.internet import reactor; print(json.dumps({'scrapy':scrapy.__version__,'user_site':site.ENABLE_USER_SITE,'sys_path':sys.path,'reactor':type(reactor).__name__}))"],cwd=ROOT); evidence["isolation"]=json.loads(isolation.stdout)
        server=subprocess.Popen([sys.executable,str(SCRIPTS/"crawler_browser_fixture_server.py")],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True); port=json.loads(server.stdout.readline())["port"]; output=destination/"acquisition.json"
        execute([str(python),"-I",str(SCRIPTS/"crawler_scrapy_adapter.py"),"--port",str(port),"--output",str(output)],cwd=ROOT); acquired=json.loads(output.read_text(encoding="utf-8")); evidence["governed_acquisition_count"]=len(acquired["results"])
        if evidence["governed_acquisition_count"] < 10: raise RuntimeError("governed_scrapy_acquisition_incomplete")
        evidence["status"]="PASS"
    finally:
        if server:
            server.terminate()
            try: server.wait(3)
            except subprocess.TimeoutExpired: server.kill(); server.wait(3)
        shutil.rmtree(destination,ignore_errors=True); evidence["destination_removed"]=not destination.exists(); evidence["elapsed_ms"]=round((time.perf_counter()-started)*1000,3); evidence["ending_free_disk_bytes"]=shutil.disk_usage(ROOT).free
        REPORTS.joinpath("crawler-browser-scrapy-reconstruction.json").write_text(json.dumps(evidence,indent=2)+"\n",encoding="utf-8")


if __name__=="__main__": main()
