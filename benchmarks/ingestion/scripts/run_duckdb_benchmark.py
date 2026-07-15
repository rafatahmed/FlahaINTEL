"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Benchmark Runner
Introduction:
Runs governed DuckDB correctness and deterministic execution comparisons.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import datetime as dt,json,sys,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from benchmark_lib import load_dataset,safe_relative,sha256_file,validate_run_id,write_json
from duckdb_adapter import identity,load
from verify_corpus import verify
ROOT=Path(__file__).resolve().parents[1];CORPUS=ROOT/"corpus"
def run(run_id=None,results_root=None):
 if verify(CORPUS):raise ValueError("corpus verification failed")
 now=dt.datetime.now(dt.timezone.utc);run_id=run_id or f"{now:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:8]}";validate_run_id(run_id);root=safe_relative((results_root or ROOT/"results").resolve(),run_id);root.mkdir(parents=True,exist_ok=False);(root/"outputs").mkdir();manifest=json.loads((CORPUS/"manifest.json").read_text(encoding="utf-8"));results=[]
 for item in manifest["items"]:
  if item["category"]!="DATASET":continue
  executions=["eager","relation","bounded","threaded"] if item["path"].endswith(".csv") else ["eager","bounded"]
  for execution in executions:
   attempts=[load("GOVERNED_CORPUS",item["path"],execution=execution) for _ in range(2)];timing={"elapsedNanoseconds","readSetupNanoseconds","normalizationNanoseconds"};stable=[{k:v for k,v in a.items() if k not in timing} for a in attempts];value=attempts[0];reference=f"outputs/{item['id']}-{execution}.json";write_json(root/reference,value);base=load_dataset(safe_relative(CORPUS,item["path"]));encoded=json.dumps(value["records"],ensure_ascii=False,allow_nan=False);comparison={"rowCount":value["recordCount"]==base["recordCount"],"arabicPreserved":"قمح" not in json.dumps(base,ensure_ascii=False) or "قمح" in encoded,"finiteJson":"NaN" not in encoded and "Infinity" not in encoded,"malformedConsistent":base["classification"]=="SUCCESS" or value["classification"]=="QUARANTINED"};results.append({"runId":run_id,"timestampUtc":now.isoformat().replace("+00:00","Z"),**identity(),"corpusItemId":item["id"],"execution":execution,"inputSha256":sha256_file(safe_relative(CORPUS,item["path"])),"outputReference":reference,"normalizedRecordsSha256":value["normalizedRecordsSha256"],"classification":value["classification"],"elapsedNanoseconds":value["elapsedNanoseconds"],"deterministic":stable[0]==stable[1],"comparison":comparison})
 with (root/"engine-results.jsonl").open("x",encoding="utf-8",newline="\n") as stream:
  for value in results:stream.write(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n")
 groups={item:{r["normalizedRecordsSha256"] for r in results if r["corpusItemId"]==item and r["classification"]=="SUCCESS"} for item in {r["corpusItemId"] for r in results}};write_json(root/"summary.json",{"runId":run_id,"resultCount":len(results),"determinismFailures":sum(not r["deterministic"] for r in results),"comparisonFailures":sum(not all(r["comparison"].values()) for r in results),"executionHashMismatches":sum(len(v)>1 for v in groups.values())});return root
if __name__=="__main__":print(run())
