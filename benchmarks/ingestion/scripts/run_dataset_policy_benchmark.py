"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Dataset Policy Benchmark Runner
Introduction:
Runs isolated deterministic dataset policy workloads with process resource evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import hashlib,json,os,pathlib,time
from generate_large_datasets import generate
from measure_process import measure

ROOT=pathlib.Path(__file__).resolve().parents[3]; BENCH=ROOT/"benchmarks"/"ingestion"

def run(python:pathlib.Path, output:pathlib.Path)->dict[str,object]:
    generated=BENCH/"generated-corpus"; specs=[generate(generated,n) for n in (10_000,100_000)]
    safe_env={k:v for k,v in os.environ.items() if k in {"SYSTEMROOT","WINDIR","TEMP","TMP"}}; safe_env.update(PYTHONIOENCODING="utf-8",PYTHONUNBUFFERED="1")
    results=[]
    for spec in specs:
        for chunk in (None,4096):
            command=[str(python),"-I",str(BENCH/"scripts"/"dataset_policy_adapter.py"),str(generated/spec["relativePath"]),"--mode","TEXT_PRESERVING"]
            if chunk: command.extend(["--chunksize",str(chunk)])
            measured=measure(command,safe_env,str(ROOT)); value=json.loads(measured.pop("stdout")); elapsed=measured["wallSeconds"]
            results.append({**spec,"mode":"chunksize" if chunk else "full","chunkSize":chunk,"rowsPerSecond":spec["rows"]/elapsed,"bytesPerSecond":spec["bytes"]/elapsed,"outputHash":value.get("sha256"),**measured})
    output.mkdir(parents=True,exist_ok=False); summary={"createdUtc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"generation":specs,"results":results}
    (output/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n",encoding="utf-8")
    return summary

if __name__=="__main__":
    stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
    print(json.dumps(run(ROOT/".benchmark-envs"/"pandas-2.3.3-py314"/"Scripts"/"python.exe",BENCH/"results"/(stamp+"-policy")),indent=2))
