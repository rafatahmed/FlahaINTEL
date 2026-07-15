"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Resource Benchmark Runner
Introduction:
Measures fixed eager, threaded, and bounded DuckDB workloads on governed data.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import hashlib,json,os,pathlib,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from measure_process import measure
ROOT=pathlib.Path(__file__).resolve().parents[3];BENCH=ROOT/"benchmarks"/"ingestion"
ACCEPTED_DATASETS=(
 {"relativePath":"dataset-10000.csv","rows":10_000,"bytes":803_857,"sha256":"d78862966a8ff02f60ca7c3713eff48455e49baf402de46497f1f48770bbd95d"},
 {"relativePath":"dataset-100000.csv","rows":100_000,"bytes":8_137_919,"sha256":"a12590d8330e280d357b94e14b9b599b94b6ca9f0996ccc465149f5154a1ab5e"},
)
def verified_datasets(root):
 specs=[]
 for expected in ACCEPTED_DATASETS:
  path=root/expected["relativePath"]
  actual={**expected,"bytes":path.stat().st_size,"sha256":hashlib.sha256(path.read_bytes()).hexdigest()}
  if actual!=expected:raise RuntimeError(f"governed dataset changed: {expected['relativePath']}")
  specs.append(actual)
 return specs
def run(python,output):
 generated=BENCH/"generated-corpus";specs=verified_datasets(generated);env={k:v for k,v in os.environ.items() if k in {"SYSTEMROOT","WINDIR","TEMP","TMP","PROCESSOR_ARCHITECTURE"}};env.update(PYTHONIOENCODING="utf-8",PYTHONUNBUFFERED="1");results=[]
 for spec in specs:
  for execution in ("eager","threaded","bounded"):
   command=[str(python),"-I",str(BENCH/"scripts"/"duckdb_adapter.py"),"GENERATED_CORPUS",spec["relativePath"],"--execution",execution,"--dtype-mode","TEXT_PRESERVING"] ; measured=measure(command,env,str(ROOT));value=json.loads(measured.pop("stdout"));wall=measured["wallSeconds"];results.append({**spec,"execution":execution,"rowsPerSecond":spec["rows"]/wall,"bytesPerSecond":spec["bytes"]/wall,"readSetupNanoseconds":value.get("readSetupNanoseconds"),"normalizationNanoseconds":value.get("normalizationNanoseconds"),"outputHash":value["normalizedRecordsSha256"],"allNormalizedRowsRetained":value.get("allNormalizedRowsRetained"),**measured})
 output.mkdir(parents=True,exist_ok=False);summary={"createdUtc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"acceptedDatasetsVerifiedWithoutRegeneration":specs,"results":results,"processMemoryLimitation":"Windows sampler may observe the venv launcher; unreliable values are not engine-superiority evidence.","memoryLimitation":"DuckDB memory_limit covers its buffer manager, while all normalized Python rows remain retained."};(output/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n",encoding="utf-8");return summary
if __name__=="__main__":
 stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime());print(json.dumps(run(ROOT/".benchmark-envs"/"duckdb-1.5.4-py314"/"Scripts"/"python.exe",BENCH/"results"/(stamp+"-duckdb-resource")),indent=2))
