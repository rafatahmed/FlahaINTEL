"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Polars Benchmark Adapter
Introduction:
Applies governed validation and dtype modes to local Polars dataset workloads.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import argparse, csv, datetime, decimal, hashlib, json, math, sys, time, warnings
from pathlib import Path
from typing import Any
sys.path.insert(0,str(Path(__file__).resolve().parent))
import polars as pl
from benchmark_lib import safe_relative
from strict_csv_validator import CsvValidationError, validate_csv

MODES={"STRICT_SCHEMA","INFER_WITH_EVIDENCE","TEXT_PRESERVING"}; EXECUTIONS={"eager","lazy","streaming"}; SUFFIXES={".csv",".json",".jsonl"}; NULLS={"","null","NULL"}

def identity()->dict[str,object]:
    return {"engine":"polars","polarsVersion":pl.__version__,"importPath":_redact(Path(pl.__file__)),"runtime":"polars-runtime-32","executionApis":{"eager":"polars.read_csv","lazy":"polars.scan_csv.collect(engine='auto')","streaming":"polars.scan_csv.collect(engine='streaming')"}}

def load(root:Path,relative_path:str,*,dtype_mode:str="INFER_WITH_EVIDENCE",execution:str="eager",schema:dict[str,str]|None=None)->dict[str,object]:
    source=safe_relative(root,relative_path)
    if not source.is_file() or source.suffix.lower() not in SUFFIXES: raise ValueError("unsupported governed dataset")
    if dtype_mode not in MODES or execution not in EXECUTIONS: raise ValueError("unsupported mode")
    if source.suffix.lower() != ".csv" and execution != "eager": raise ValueError("lazy and streaming modes are CSV-only")
    started=time.perf_counter_ns(); captured=[]
    try:
        validation=None
        if source.suffix.lower()==".csv": validation=validate_csv(source)
        with warnings.catch_warnings(record=True) as seen:
            warnings.simplefilter("always"); frame,scan_ns,collect_ns=_read(source,dtype_mode,execution)
        captured=[{"category":w.category.__name__,"message":_sanitize(str(w.message),root)} for w in seen]
        raw_schema={name:str(kind) for name,kind in frame.schema.items()}
        normalize_started=time.perf_counter_ns()
        if dtype_mode=="STRICT_SCHEMA": records,error=_strict_records(frame,schema)
        else: records,error=([{str(k):normalize(v) for k,v in row.items()} for row in frame.to_dicts()],None)
        if error: return _failure(error,started,captured,execution,dtype_mode)
        evidence={name:{"polarsType":raw_schema[name],"category":map_dtype(kind),"samples":[normalize(v) for v in frame[name].head(3).to_list()]} for name,kind in frame.schema.items()} if dtype_mode=="INFER_WITH_EVIDENCE" else None
        encoded=json.dumps(records,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
        normalize_ns=time.perf_counter_ns()-normalize_started
        return {"classification":"SUCCESS","errorCode":None,"records":records,"recordCount":len(records),"columnCount":len(frame.columns),"inferredSchema":raw_schema,"inferenceEvidence":evidence,"validation":validation,"dtypeMode":dtype_mode,"execution":execution,"materialized":True,"scanSetupNanoseconds":scan_ns,"collectionNanoseconds":collect_ns,"normalizationNanoseconds":normalize_ns,"normalizedRecordsSha256":hashlib.sha256(encoded).hexdigest(),"elapsedNanoseconds":time.perf_counter_ns()-started,"warnings":captured}
    except CsvValidationError as error: return _failure(error.code,started,captured,execution,dtype_mode)
    except (ValueError,TypeError,UnicodeError,pl.exceptions.PolarsError,json.JSONDecodeError) as error: return _failure(type(error).__name__,started,captured,execution,dtype_mode)

def _read(path:Path,mode:str,execution:str)->tuple[pl.DataFrame,int,int]:
    suffix=path.suffix.lower()
    if suffix==".csv":
        with path.open(encoding="utf-8-sig") as stream: header=next(csv.reader([stream.readline()]))
        options={"encoding":"utf8","ignore_errors":False,"truncate_ragged_lines":False,"null_values":list(NULLS),"schema_overrides":{name:pl.String for name in header} if mode in {"STRICT_SCHEMA","TEXT_PRESERVING"} else None}
        if execution=="eager":
            started=time.perf_counter_ns();frame=pl.read_csv(path,**options);return frame,0,time.perf_counter_ns()-started
        started=time.perf_counter_ns();lazy=pl.scan_csv(path,**options);scan_ns=time.perf_counter_ns()-started
        started=time.perf_counter_ns();frame=lazy.collect(engine="streaming" if execution=="streaming" else "auto");return frame,scan_ns,time.perf_counter_ns()-started
    if suffix==".jsonl":
        started=time.perf_counter_ns();frame=pl.read_ndjson(path,ignore_errors=False);return frame,0,time.perf_counter_ns()-started
    raw=json.loads(path.read_text(encoding="utf-8"),parse_constant=lambda value:(_ for _ in ()).throw(ValueError(value)))
    started=time.perf_counter_ns();frame=pl.DataFrame(raw if isinstance(raw,list) else [raw],strict=True);return frame,0,time.perf_counter_ns()-started

def _strict_records(frame:pl.DataFrame,schema:dict[str,str]|None)->tuple[list[dict[str,object]],str|None]:
    if not schema: return [],"SCHEMA_REQUIRED"
    if frame.columns!=list(schema): return [],"SCHEMA_COLUMNS_MISMATCH"
    try:return ([{k:_convert(v,schema[k]) for k,v in row.items()} for row in frame.to_dicts()],None)
    except (ValueError,decimal.InvalidOperation):return [],"SCHEMA_VALUE_INVALID"

def _convert(value:object,kind:str)->object:
    if value is None or str(value) in NULLS:return None
    text=str(value)
    if kind in {"string","date","datetime","categorical"}:return text
    if kind=="integer":return int(text)
    if kind=="decimal":return str(decimal.Decimal(text))
    if kind=="float":
        number=float(text)
        if not math.isfinite(number):raise ValueError("finite")
        return number
    if kind=="boolean":
        if text not in {"true","false"}:raise ValueError("boolean")
        return text=="true"
    raise ValueError("dtype")

def normalize(value:Any)->object:
    if value is None:return None
    if isinstance(value,(datetime.datetime,datetime.date,datetime.time)):return value.isoformat()
    if isinstance(value,decimal.Decimal):return str(value)
    if isinstance(value,float):
        if not math.isfinite(value):raise ValueError("non-finite value")
        return value
    if isinstance(value,(str,int,bool)):return value
    raise TypeError(f"unsupported scalar {type(value).__name__}")

def map_dtype(kind:pl.DataType)->str:
    if kind==pl.String:return "string"
    if kind.is_integer():return "integer"
    if kind.is_float():return "float"
    if kind==pl.Boolean:return "boolean"
    if kind==pl.Date:return "date"
    if isinstance(kind,pl.Datetime):return "datetime"
    if isinstance(kind,pl.Decimal):return "decimal"
    if kind==pl.Categorical:return "categorical"
    if kind==pl.Null:return "null"
    return "unknown"

def _failure(code:str,started:int,warnings_:list[dict[str,str]],execution:str,mode:str)->dict[str,object]:
    return {"classification":"QUARANTINED","errorCode":code,"records":[],"recordCount":0,"columnCount":0,"inferredSchema":{},"inferenceEvidence":None,"validation":None,"dtypeMode":mode,"execution":execution,"materialized":False,"scanSetupNanoseconds":None,"collectionNanoseconds":None,"normalizationNanoseconds":None,"normalizedRecordsSha256":None,"elapsedNanoseconds":time.perf_counter_ns()-started,"warnings":warnings_}

def _redact(path:Path)->str:
    parts=[p.lower() for p in path.parts]; index=parts.index("site-packages"); return "<isolated-env>/"+"/".join(path.parts[index+1:])
def _sanitize(message:str,root:Path)->str:return message.replace(str(root),"<dataset-root>").replace(str(Path.home()),"<user>")[:512]

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("root");parser.add_argument("relative");parser.add_argument("--execution",default="eager");parser.add_argument("--dtype-mode",default="TEXT_PRESERVING");args=parser.parse_args();result=load(Path(args.root),args.relative,execution=args.execution,dtype_mode=args.dtype_mode);result.pop("records",None);print(json.dumps(result,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False))
