"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Polars Benchmark Runner
Introduction:
Runs governed Polars correctness and deterministic execution-mode comparisons.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import datetime as dt,hashlib,json,sys,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from benchmark_lib import load_dataset,safe_relative,sha256_file,validate_run_id,write_json
from polars_adapter import identity,load
from verify_corpus import verify
ROOT=Path(__file__).resolve().parents[1];CORPUS=ROOT/"corpus"

def run(run_id:str|None=None,results_root:Path|None=None)->Path:
    errors=verify(CORPUS)
    if errors:raise ValueError("corpus verification failed")
    now=dt.datetime.now(dt.timezone.utc);run_id=run_id or f"{now:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:8]}";validate_run_id(run_id);root=safe_relative((results_root or ROOT/"results").resolve(),run_id);root.mkdir(parents=True,exist_ok=False);(root/"outputs").mkdir()
    manifest=json.loads((CORPUS/"manifest.json").read_text(encoding="utf-8"));results=[]
    for item in manifest["items"]:
        if item["category"]!="DATASET":continue
        executions=["eager"] if not item["path"].endswith(".csv") else ["eager","lazy","streaming"]
        for execution in executions:
            attempts=[load(CORPUS,item["path"],execution=execution) for _ in range(2)];timings={"elapsedNanoseconds","scanSetupNanoseconds","collectionNanoseconds","normalizationNanoseconds"};stable=[{k:v for k,v in a.items() if k not in timings} for a in attempts];deterministic=stable[0]==stable[1];value=attempts[0];stdlib=load_dataset(safe_relative(CORPUS,item["path"]));reference=f"outputs/{item['id']}-{execution}.json";write_json(root/reference,value)
            results.append({"runId":run_id,"timestampUtc":now.isoformat().replace("+00:00","Z"),**identity(),"corpusItemId":item["id"],"execution":execution,"inputSha256":sha256_file(safe_relative(CORPUS,item["path"])),"outputReference":reference,"normalizedRecordsSha256":value["normalizedRecordsSha256"],"classification":value["classification"],"elapsedNanoseconds":value["elapsedNanoseconds"],"deterministic":deterministic,"comparison":_compare(value,stdlib)})
    with (root/"engine-results.jsonl").open("x",encoding="utf-8",newline="\n") as stream:
        for value in results:stream.write(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n")
    csv_groups={item:{r["normalizedRecordsSha256"] for r in results if r["corpusItemId"]==item and r["classification"]=="SUCCESS"} for item in {r["corpusItemId"] for r in results}}
    write_json(root/"summary.json",{"runId":run_id,"resultCount":len(results),"determinismFailures":sum(not r["deterministic"] for r in results),"comparisonFailures":sum(not all(r["comparison"].values()) for r in results),"executionHashMismatches":sum(len(v)>1 for v in csv_groups.values())})
    return root

def _compare(value:dict[str,object],stdlib:dict[str,object])->dict[str,bool]:
    encoded=json.dumps(value["records"],ensure_ascii=False,allow_nan=False);left=[_semantic(r) for r in value["records"]];right=[_semantic(r) for r in stdlib["records"]]
    return {"rowCount":value["recordCount"]==stdlib["recordCount"],"fieldValuePreservation":left==right,"arabicPreserved":"قمح" not in json.dumps(stdlib,ensure_ascii=False) or "قمح" in encoded,"duplicateOrder":len(left)==len(right),"finiteJson":"NaN" not in encoded and "Infinity" not in encoded,"malformedConsistent":stdlib["classification"]=="SUCCESS" or value["classification"]=="QUARANTINED"}
def _semantic(row:object)->object:
    if not isinstance(row,dict):return row
    return {str(k):"<null>" if v is None or v=="" else ("true" if v is True else "false" if v is False else str(int(v)) if isinstance(v,float) and v.is_integer() else str(v)) for k,v in row.items()}
if __name__=="__main__":print(run())
