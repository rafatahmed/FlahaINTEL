"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: PyArrow Benchmark Adapter
Introduction:
Applies governed validation, dtype policy, and deterministic PyArrow normalization.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import argparse,csv,datetime,decimal,hashlib,json,math,sys,time,warnings
from pathlib import Path
from typing import Any
sys.path.insert(0,str(Path(__file__).resolve().parent))
import pyarrow as pa
import pyarrow.csv as pacsv
import pyarrow.json as pajson
from benchmark_lib import safe_relative
from strict_csv_validator import CsvValidationError,validate_csv

MODES={"STRICT_SCHEMA","INFER_WITH_EVIDENCE","TEXT_PRESERVING"};EXECUTIONS={"eager","incremental","threaded"};SUFFIXES={".csv",".json",".jsonl"};NULLS=["","null","NULL"]

def identity()->dict[str,object]:
 info=pa.runtime_info();return {"engine":"pyarrow","pyarrowVersion":pa.__version__,"importPath":_redact(Path(pa.__file__)),"runtimeInfo":{"simdLevel":info.simd_level,"detectedSimdLevel":info.detected_simd_level},"memoryPoolBackend":pa.default_memory_pool().backend_name,"executionApis":{"eager":"pyarrow.csv.read_csv","threaded":"pyarrow.csv.read_csv(use_threads=True)","incremental":"pyarrow.csv.open_csv","jsonlEager":"pyarrow.json.read_json","jsonlIncremental":"pyarrow.json.open_json" if hasattr(pajson,"open_json") else None}}

def load(root:Path,relative_path:str,*,dtype_mode:str="INFER_WITH_EVIDENCE",execution:str="eager",schema:dict[str,str]|None=None,block_size:int=1<<20)->dict[str,object]:
 source=safe_relative(root,relative_path)
 if not source.is_file() or source.suffix.lower() not in SUFFIXES:raise ValueError("unsupported governed dataset")
 if dtype_mode not in MODES or execution not in EXECUTIONS:raise ValueError("unsupported mode")
 if source.suffix.lower()!=".csv" and execution=="threaded":raise ValueError("threaded mode is CSV-only")
 started=time.perf_counter_ns();captured=[];batches=[];validation=None
 try:
  if source.suffix.lower()==".csv":validation=validate_csv(source)
  read_started=time.perf_counter_ns();iterator,materialized,api=_read(source,dtype_mode,execution,schema,block_size);read_setup_ns=time.perf_counter_ns()-read_started
  records=[];batch_rows=[];pool=pa.default_memory_pool();normalization_ns=0;hashing_ns=0;digest=hashlib.sha256();digest.update(b"[");canonical_bytes=1;count=0;raw_schema=None
  for batch in iterator:
   batches.append(batch);batch_rows.append(batch.num_rows);raw_schema=raw_schema or batch.schema
   point=time.perf_counter_ns();rows=batch.to_pylist();normalization_ns+=time.perf_counter_ns()-point
   for row in rows:
    normalized={str(k):_convert(v,schema[k]) if dtype_mode=="STRICT_SCHEMA" else normalize(v) for k,v in row.items()}
    records.append(normalized);encoded=json.dumps(normalized,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode();point=time.perf_counter_ns()
    if count:digest.update(b",");canonical_bytes+=1
    digest.update(encoded);hashing_ns+=time.perf_counter_ns()-point;canonical_bytes+=len(encoded);count+=1
  digest.update(b"]");canonical_bytes+=1
  schema_map={field.name:str(field.type) for field in (raw_schema or pa.schema([]))};evidence={name:{"arrowType":kind,"category":map_dtype((raw_schema or pa.schema([])).field(name).type),"samples":[records[i][name] for i in range(min(3,len(records)))]} for name,kind in schema_map.items()} if dtype_mode=="INFER_WITH_EVIDENCE" else None
  return {"classification":"SUCCESS","errorCode":None,"records":records,"recordCount":count,"columnCount":len(schema_map),"inferredSchema":schema_map,"inferenceEvidence":evidence,"validation":validation,"dtypeMode":dtype_mode,"execution":execution,"api":api,"materializedTable":materialized,"readAllCalled":False,"batchCount":len(batch_rows),"batchRowCounts":batch_rows,"maximumBatchRows":max(batch_rows,default=0),"blockSize":block_size,"rowsConvertedToPython":True,"allNormalizedRowsRetained":True,"completeCanonicalDocumentRetained":False,"canonicalHashIncremental":True,"canonicalBytes":canonical_bytes,"readSetupNanoseconds":read_setup_ns,"normalizationNanoseconds":normalization_ns,"hashingNanoseconds":hashing_ns,"arrowBytesAllocated":pool.bytes_allocated(),"arrowPeakMemory":pool.max_memory(),"normalizedRecordsSha256":digest.hexdigest(),"elapsedNanoseconds":time.perf_counter_ns()-started,"warnings":captured}
 except CsvValidationError as error:return _failure(error.code,started,execution,dtype_mode)
 except (ValueError,TypeError,UnicodeError,decimal.InvalidOperation,pa.ArrowException,json.JSONDecodeError) as error:return _failure(type(error).__name__,started,execution,dtype_mode)

def _read(path:Path,mode:str,execution:str,schema:dict[str,str]|None,block_size:int):
 suffix=path.suffix.lower()
 if suffix==".json":
  raw=json.loads(path.read_text(encoding="utf-8"),parse_constant=lambda value:(_ for _ in()).throw(ValueError(value)));table=pa.Table.from_pylist(raw if isinstance(raw,list) else [raw]);return iter(table.to_batches()),True,"stdlib.json.loads+pyarrow.Table.from_pylist"
 arrow_schema=_schema(schema) if mode=="STRICT_SCHEMA" else None
 if mode=="STRICT_SCHEMA" and arrow_schema is None:raise ValueError("SCHEMA_REQUIRED")
 if suffix==".jsonl":
  parse=pajson.ParseOptions(explicit_schema=arrow_schema,unexpected_field_behavior="error" if arrow_schema else "infer")
  if execution=="incremental" and hasattr(pajson,"open_json"):reader=pajson.open_json(path,read_options=pajson.ReadOptions(block_size=block_size,use_threads=False),parse_options=parse);return iter(reader),False,"pyarrow.json.open_json"
  table=pajson.read_json(path,read_options=pajson.ReadOptions(block_size=block_size,use_threads=False),parse_options=parse);return iter(table.to_batches()),True,"pyarrow.json.read_json"
 with path.open(encoding="utf-8-sig",newline="") as stream:columns=next(csv.reader([stream.readline()]))
 if mode=="STRICT_SCHEMA" and columns!=list(schema or {}):raise ValueError("SCHEMA_COLUMNS_MISMATCH")
 types={name:pa.string() for name in columns} if mode=="TEXT_PRESERVING" else ({field.name:field.type for field in arrow_schema} if arrow_schema else None)
 read=pacsv.ReadOptions(use_threads=execution=="threaded",block_size=block_size,encoding="utf8")
 parse=pacsv.ParseOptions(delimiter=",",quote_char='"',double_quote=True,escape_char=False,newlines_in_values=False,ignore_empty_lines=True,invalid_row_handler=lambda row:"error")
 convert=pacsv.ConvertOptions(check_utf8=True,column_types=types,null_values=NULLS,strings_can_be_null=True,quoted_strings_can_be_null=True,auto_dict_encode=False)
 if execution=="incremental":reader=pacsv.open_csv(path,read_options=read,parse_options=parse,convert_options=convert);return iter(reader),False,"pyarrow.csv.open_csv"
 table=pacsv.read_csv(path,read_options=read,parse_options=parse,convert_options=convert);return iter(table.to_batches()),True,"pyarrow.csv.read_csv"

def _schema(spec:dict[str,str]|None)->pa.Schema|None:
 if not spec:return None
 types={"string":pa.string(),"integer":pa.int64(),"decimal":pa.decimal128(38,3),"float":pa.float64(),"boolean":pa.bool_(),"date":pa.date32(),"datetime":pa.timestamp("us",tz="UTC"),"categorical":pa.dictionary(pa.int32(),pa.string())}
 try:return pa.schema([(name,types[kind]) for name,kind in spec.items()])
 except KeyError as error:raise ValueError("unsupported schema type") from error

def _convert(value:object,kind:str)->object:
 if value is None:return None
 if kind=="decimal":return format(value,"f") if isinstance(value,decimal.Decimal) else str(value)
 return normalize(value)
def normalize(value:Any)->object:
 if value is None:return None
 if isinstance(value,(datetime.datetime,datetime.date,datetime.time)):return value.isoformat()
 if isinstance(value,decimal.Decimal):return format(value,"f")
 if isinstance(value,float):
  if not math.isfinite(value):raise ValueError("non-finite value")
  return value
 if isinstance(value,(str,int,bool)):return value
 raise TypeError(f"unsupported scalar {type(value).__name__}")
def map_dtype(kind:pa.DataType)->str:
 if pa.types.is_string(kind) or pa.types.is_large_string(kind):return "string"
 if pa.types.is_integer(kind):return "integer"
 if pa.types.is_decimal(kind):return "decimal"
 if pa.types.is_floating(kind):return "float"
 if pa.types.is_boolean(kind):return "boolean"
 if pa.types.is_date(kind):return "date"
 if pa.types.is_timestamp(kind):return "datetime"
 if pa.types.is_dictionary(kind):return "categorical"
 if pa.types.is_null(kind):return "null"
 return "unknown"
def _failure(code:str,started:int,execution:str,mode:str)->dict[str,object]:return {"classification":"QUARANTINED","errorCode":code,"records":[],"recordCount":0,"columnCount":0,"inferredSchema":{},"inferenceEvidence":None,"validation":None,"dtypeMode":mode,"execution":execution,"materializedTable":False,"normalizedRecordsSha256":None,"elapsedNanoseconds":time.perf_counter_ns()-started,"warnings":[]}
def _redact(path:Path)->str:
 parts=[p.lower() for p in path.parts];index=parts.index("site-packages");return "<isolated-env>/"+"/".join(path.parts[index+1:])
if __name__=="__main__":
 parser=argparse.ArgumentParser();parser.add_argument("root");parser.add_argument("relative");parser.add_argument("--execution",default="eager");parser.add_argument("--dtype-mode",default="TEXT_PRESERVING");parser.add_argument("--block-size",type=int,default=1<<20);args=parser.parse_args();result=load(Path(args.root),args.relative,execution=args.execution,dtype_mode=args.dtype_mode,block_size=args.block_size);result.pop("records",None);print(json.dumps(result,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False))
