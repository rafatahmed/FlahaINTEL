"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: PyArrow Resource Benchmark Runner
Introduction:
Measures isolated eager, threaded, and incremental workloads on governed data.

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
  for execution in ("eager","threaded","incremental"):
   command=[str(python),"-I",str(BENCH/"scripts"/"pyarrow_adapter.py"),str(generated),spec["relativePath"],"--execution",execution,"--dtype-mode","TEXT_PRESERVING"];measured=measure(command,env,str(ROOT));value=json.loads(measured.pop("stdout"));wall=measured["wallSeconds"];results.append({**spec,"execution":execution,"rowsPerSecond":spec["rows"]/wall,"bytesPerSecond":spec["bytes"]/wall,"readSetupNanoseconds":value.get("readSetupNanoseconds"),"normalizationNanoseconds":value.get("normalizationNanoseconds"),"hashingNanoseconds":value.get("hashingNanoseconds"),"arrowBytesAllocated":value.get("arrowBytesAllocated"),"arrowPeakMemory":value.get("arrowPeakMemory"),"outputHash":value["normalizedRecordsSha256"],"fullyMaterialized":value.get("materializedTable"),"allNormalizedRowsRetained":value.get("allNormalizedRowsRetained"),"completeCanonicalDocumentRetained":value.get("completeCanonicalDocumentRetained"),**measured})
 output.mkdir(parents=True,exist_ok=False);summary={"createdUtc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"generation":specs,"results":results,"processMemoryLimitation":"Windows sampler observes the venv launcher PID; values are null or unreliable and are not used for engine superiority claims."};(output/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n",encoding="utf-8");return summary
if __name__=="__main__":
 stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime());print(json.dumps(run(ROOT/".benchmark-envs"/"pyarrow-25.0.0-py314"/"Scripts"/"python.exe",BENCH/"results"/(stamp+"-pyarrow-resource")),indent=2))
