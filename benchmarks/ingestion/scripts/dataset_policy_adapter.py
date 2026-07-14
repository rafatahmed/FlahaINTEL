"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed Dataset Policy Adapter
Introduction:
Applies strict CSV and explicit dtype modes before deterministic pandas output.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import argparse, decimal, hashlib, json, sys
from pathlib import Path
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parent))
from strict_csv_validator import validate_csv, CsvValidationError

MODES={"STRICT_SCHEMA","INFER_WITH_EVIDENCE","TEXT_PRESERVING"}
NULLS={"", "null", "NULL"}

def load_csv(path: Path, mode: str, schema: dict[str,str]|None=None, chunksize: int|None=None) -> dict[str,object]:
    if mode not in MODES: raise ValueError("unknown dtype mode")
    try: validation=validate_csv(path)
    except CsvValidationError as error: return {"classification":"QUARANTINED","errorCode":error.code,"records":[]}
    options={"encoding":"utf-8-sig","keep_default_na":False,"na_filter":False,"dtype":str if mode in {"STRICT_SCHEMA","TEXT_PRESERVING"} else None}
    parts=list(pd.read_csv(path,chunksize=chunksize,**options)) if chunksize else [pd.read_csv(path,**options)]
    frame=pd.concat(parts,ignore_index=True) if len(parts)>1 else parts[0]
    if mode=="STRICT_SCHEMA":
        if not schema: raise ValueError("schema required")
        if list(frame.columns)!=list(schema): return {"classification":"QUARANTINED","errorCode":"SCHEMA_COLUMNS_MISMATCH","records":[]}
        try: records=[{k:_convert(v,schema[k]) for k,v in row.items()} for row in frame.to_dict("records")]
        except (ValueError,decimal.InvalidOperation): return {"classification":"QUARANTINED","errorCode":"SCHEMA_VALUE_INVALID","records":[]}
    else:
        records=[{str(k):_json_value(v) for k,v in row.items()} for row in frame.to_dict("records")]
    encoded=json.dumps(records,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
    evidence={str(c):{"dtype":str(frame.dtypes[c]),"samples":[_json_value(x) for x in frame[c].head(3).tolist()]} for c in frame.columns}
    return {"classification":"SUCCESS","errorCode":None,"records":records,"recordCount":len(records),"validation":validation,"mode":mode,"inferenceEvidence":evidence if mode=="INFER_WITH_EVIDENCE" else None,"sha256":hashlib.sha256(encoded).hexdigest()}

def _convert(value: object, kind: str)->object:
    text=str(value)
    if text in NULLS: return None
    if kind=="string": return text
    if kind=="integer": return int(text)
    if kind=="decimal": return str(decimal.Decimal(text))
    if kind=="float": return float(text)
    if kind=="boolean":
        if text not in {"true","false"}: raise ValueError("boolean")
        return text=="true"
    if kind in {"date","datetime","categorical"}: return text
    raise ValueError("dtype")

def _json_value(value: object)->object:
    if pd.isna(value): return None
    if hasattr(value,"item"): value=value.item()
    return value

if __name__ == "__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("path"); parser.add_argument("--mode",default="TEXT_PRESERVING"); parser.add_argument("--chunksize",type=int)
    args=parser.parse_args(); result=load_csv(Path(args.path),args.mode,chunksize=args.chunksize)
    result.pop("records",None)
    print(json.dumps(result,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False))
