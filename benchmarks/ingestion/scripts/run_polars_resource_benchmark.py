"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Polars Process Resource Benchmark Runner
Introduction:
Measures isolated eager, lazy, and streaming workloads on governed generated data.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import json,os,pathlib,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from generate_large_datasets import generate
from measure_process import measure
ROOT=pathlib.Path(__file__).resolve().parents[3];BENCH=ROOT/"benchmarks"/"ingestion"

def run(python:pathlib.Path,output:pathlib.Path)->dict[str,object]:
    generated=BENCH/"generated-corpus";specs=[generate(generated,n) for n in (10_000,100_000)];env={k:v for k,v in os.environ.items() if k in {"SYSTEMROOT","WINDIR","TEMP","TMP","PROCESSOR_ARCHITECTURE"}};env.update(PYTHONIOENCODING="utf-8",PYTHONUNBUFFERED="1");results=[]
    for spec in specs:
        for execution in ("eager","lazy","streaming"):
            command=[str(python),"-I",str(BENCH/"scripts"/"polars_adapter.py"),str(generated),spec["relativePath"],"--execution",execution,"--dtype-mode","TEXT_PRESERVING"]
            measured=measure(command,env,str(ROOT));value=json.loads(measured.pop("stdout"));wall=measured["wallSeconds"];results.append({**spec,"execution":execution,"rowsPerSecond":spec["rows"]/wall,"bytesPerSecond":spec["bytes"]/wall,"scanSetupNanoseconds":value["scanSetupNanoseconds"],"collectionNanoseconds":value["collectionNanoseconds"],"normalizationNanoseconds":value["normalizationNanoseconds"],"outputHash":value["normalizedRecordsSha256"],"fullyMaterialized":True,**measured})
    output.mkdir(parents=True,exist_ok=False);summary={"createdUtc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"generation":specs,"results":results};(output/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n",encoding="utf-8");return summary
if __name__=="__main__":
    stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime());print(json.dumps(run(ROOT/".benchmark-envs"/"polars-1.42.1-py314"/"Scripts"/"python.exe",BENCH/"results"/(stamp+"-polars-resource")),indent=2))
