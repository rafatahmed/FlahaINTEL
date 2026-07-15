"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Benchmark Adapter
Introduction:
Applies governed validation, a locked exact-path connection, and deterministic normalization.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import argparse,datetime,decimal,hashlib,json,math,pathlib,sys,time
from typing import Any
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
import duckdb
from benchmark_lib import safe_relative
from strict_csv_validator import CsvValidationError,validate_csv

BENCHMARK_ROOT=pathlib.Path(__file__).resolve().parents[1]
APPROVED_ROOTS={"GOVERNED_CORPUS":BENCHMARK_ROOT/"corpus","GENERATED_CORPUS":BENCHMARK_ROOT/"generated-corpus"}
MODES={"STRICT_SCHEMA","INFER_WITH_EVIDENCE","TEXT_PRESERVING"};EXECUTIONS={"eager","relation","bounded","threaded"};SUFFIXES={".csv",".json",".jsonl"}
TYPE_SQL={"string":"VARCHAR","integer":"BIGINT","decimal":"DECIMAL(38,3)","float":"DOUBLE","boolean":"BOOLEAN","date":"DATE","datetime":"TIMESTAMP","categorical":"VARCHAR"}

def identity()->dict[str,object]:
 return {"engine":"duckdb","duckdbVersion":duckdb.__version__,"importPath":_redact(pathlib.Path(duckdb.__file__)),"executionApis":{"eager":"DuckDBPyConnection.execute+fetchall","relation":"DuckDBPyConnection.execute+fetchall (fixed relation-mode label)","bounded":"DuckDBPyConnection.execute+fetchmany","threaded":"DuckDBPyConnection.execute(threads=2)+fetchall"}}

def _connect(source:pathlib.Path,threads:int)->duckdb.DuckDBPyConnection:
 connection=duckdb.connect(":memory:")
 for statement in ("SET allow_unsigned_extensions=false","SET autoinstall_known_extensions=false","SET autoload_known_extensions=false","SET allow_community_extensions=false","SET enable_external_file_cache=false","SET enable_object_cache=false","SET enable_progress_bar=false","SET preserve_insertion_order=true",f"SET threads={threads}","SET memory_limit='256MB'","SET max_temp_directory_size='16MB'","SET allowed_directories=[]"):
  connection.execute(statement)
 connection.execute("SET allowed_paths=?",[[str(source.resolve())]])
 connection.execute("SET enable_external_access=false");connection.execute("SET lock_configuration=true")
 return connection

def load(root_id:str,artifact_key:str,*,dtype_mode:str="INFER_WITH_EVIDENCE",execution:str="eager",schema:dict[str,str]|None=None,batch_size:int=2048)->dict[str,object]:
 source=_resolve_artifact(root_id,artifact_key)
 if not source.is_file() or source.suffix.lower() not in SUFFIXES:raise ValueError("unsupported governed dataset")
 if dtype_mode not in MODES or execution not in EXECUTIONS:raise ValueError("unsupported mode")
 if dtype_mode=="STRICT_SCHEMA" and not schema:raise ValueError("SCHEMA_REQUIRED")
 started=time.perf_counter_ns();validation=None;connection=None
 try:
  if source.suffix.lower()==".csv":validation=validate_csv(source)
  connection=_connect(source,2 if execution=="threaded" else 1);read_started=time.perf_counter_ns();cursor,api=_execute(connection,source,dtype_mode,execution,schema);read_setup=time.perf_counter_ns()-read_started
  description=cursor.description or [];columns=[item[0] for item in description];types={item[0]:str(item[1]) for item in description};rows=[];batch_counts=[];normalization_ns=0;digest=hashlib.sha256();digest.update(b"[");canonical_bytes=1;count=0
  while True:
   batch=cursor.fetchmany(batch_size) if execution=="bounded" else (cursor.fetchall() if count==0 else [])
   if not batch:break
   batch_counts.append(len(batch));point=time.perf_counter_ns()
   for raw in batch:
    row={name:_convert(value,(schema or {}).get(name)) for name,value in zip(columns,raw)};rows.append(row);encoded=json.dumps(row,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
    if count:digest.update(b",");canonical_bytes+=1
    digest.update(encoded);canonical_bytes+=len(encoded);count+=1
   normalization_ns+=time.perf_counter_ns()-point
  digest.update(b"]");canonical_bytes+=1
  evidence={name:{"duckdbType":kind,"category":map_dtype(kind),"samples":[rows[i][name] for i in range(min(3,len(rows)))]} for name,kind in types.items()} if dtype_mode=="INFER_WITH_EVIDENCE" else None
  return {"classification":"SUCCESS","errorCode":None,"records":rows,"recordCount":count,"columnCount":len(columns),"inferredSchema":types,"inferenceEvidence":evidence,"validation":validation,"dtypeMode":dtype_mode,"execution":execution,"api":api,"explicitOrder":True,"threads":2 if execution=="threaded" else 1,"batchSize":batch_size if execution=="bounded" else None,"batchCount":len(batch_counts),"batchRowCounts":batch_counts,"rowsConvertedToPython":True,"allNormalizedRowsRetained":True,"canonicalHashIncremental":True,"canonicalBytes":canonical_bytes,"readSetupNanoseconds":read_setup,"normalizationNanoseconds":normalization_ns,"normalizedRecordsSha256":digest.hexdigest(),"elapsedNanoseconds":time.perf_counter_ns()-started}
 except CsvValidationError as error:return _failure(error.code,started,execution,dtype_mode)
 except (duckdb.Error,ValueError,TypeError,UnicodeError,decimal.InvalidOperation,json.JSONDecodeError) as error:return _failure(type(error).__name__,started,execution,dtype_mode)
 finally:
  if connection is not None:connection.close()

def _execute(connection,source,mode,execution,schema):
 suffix=source.suffix.lower();path=str(source.resolve())
 if suffix==".csv":
  columns=_columns_sql(source,mode,schema);parallel="true" if execution=="threaded" else "false";column_option=f", columns={columns}" if columns else ""
  sql=f"SELECT * EXCLUDE (_ordinal) FROM (SELECT row_number() OVER () AS _ordinal, * FROM read_csv(?, header=true{column_option}, strict_mode=true, parallel={parallel}, store_rejects=false, null_padding=false, union_by_name=false)) ORDER BY _ordinal"
  return connection.execute(sql,[path]),("DuckDBPyConnection.execute+fetchmany" if execution=="bounded" else "DuckDBPyConnection.execute+fetchall")
 format_value="newline_delimited" if suffix==".jsonl" else "array"
 columns=("columns="+_schema_sql(schema)+",") if mode=="STRICT_SCHEMA" else ""
 sql=f"SELECT * EXCLUDE (_ordinal) FROM (SELECT row_number() OVER () AS _ordinal, * FROM read_json(?, format='{format_value}', {columns} ignore_errors=false, maximum_object_size=16777216)) ORDER BY _ordinal"
 return connection.execute(sql,[path]),("DuckDBPyConnection.execute+fetchmany" if execution=="bounded" else "DuckDBPyConnection.execute+fetchall")

def _resolve_artifact(root_id:str,artifact_key:str)->pathlib.Path:
 if root_id not in APPROVED_ROOTS:raise ValueError("unsupported governed root")
 if not isinstance(artifact_key,str) or any(character in artifact_key for character in "*?[]"):
  raise ValueError("artifact key contains a glob")
 source=safe_relative(APPROVED_ROOTS[root_id],artifact_key)
 if not source.is_file():raise ValueError("governed artifact does not exist")
 return source

def _columns_sql(path,mode,schema):
 import csv
 with path.open(encoding="utf-8-sig",newline="") as stream:names=next(csv.reader([stream.readline()]))
 if mode=="STRICT_SCHEMA":
  if names!=list(schema or {}):raise ValueError("SCHEMA_COLUMNS_MISMATCH")
  return _schema_sql(schema)
 if mode=="TEXT_PRESERVING":return "{"+",".join(_quote(name)+":'VARCHAR'" for name in names)+"}"
 return None
def _schema_sql(schema):
 try:return "{"+",".join(_quote(name)+":"+_quote(TYPE_SQL[kind]) for name,kind in (schema or {}).items())+"}"
 except KeyError as error:raise ValueError("unsupported schema type") from error
def _quote(value):return "'"+str(value).replace("'","''")+"'"
def _convert(value,kind):
 if value is None:return None
 if kind=="decimal" or isinstance(value,decimal.Decimal):return format(value,"f")
 if kind=="datetime" and isinstance(value,datetime.datetime) and value.tzinfo is None:return value.isoformat()+"Z"
 return normalize(value)
def normalize(value:Any)->object:
 if value is None:return None
 if isinstance(value,datetime.datetime):return value.astimezone(datetime.timezone.utc).isoformat().replace("+00:00","Z") if value.tzinfo else value.isoformat()
 if isinstance(value,(datetime.date,datetime.time)):return value.isoformat()
 if isinstance(value,decimal.Decimal):return format(value,"f")
 if isinstance(value,float):
  if not math.isfinite(value):raise ValueError("non-finite value")
  return value
 if isinstance(value,(str,int,bool)):return value
 raise TypeError(f"unsupported scalar {type(value).__name__}")
def map_dtype(kind):
 value=kind.upper()
 if "VARCHAR" in value or "ENUM" in value:return "string"
 if "INT" in value:return "integer"
 if "DECIMAL" in value:return "decimal"
 if "DOUBLE" in value or "FLOAT" in value:return "float"
 if "BOOL" in value:return "boolean"
 if value=="DATE":return "date"
 if "TIMESTAMP" in value:return "datetime"
 if value=="NULL":return "null"
 return "unknown"
def _failure(code,started,execution,mode):return {"classification":"QUARANTINED","errorCode":code,"records":[],"recordCount":0,"columnCount":0,"inferredSchema":{},"inferenceEvidence":None,"validation":None,"dtypeMode":mode,"execution":execution,"normalizedRecordsSha256":None,"elapsedNanoseconds":time.perf_counter_ns()-started}
def _redact(path):
 parts=[p.lower() for p in path.parts];index=parts.index("site-packages");return "<isolated-env>/"+"/".join(path.parts[index+1:])
if __name__=="__main__":
 parser=argparse.ArgumentParser();parser.add_argument("root_id",choices=tuple(APPROVED_ROOTS));parser.add_argument("artifact_key");parser.add_argument("--execution",choices=tuple(EXECUTIONS),default="eager");parser.add_argument("--dtype-mode",choices=tuple(MODES),default="TEXT_PRESERVING");parser.add_argument("--batch-size",type=int,default=2048);args=parser.parse_args();value=load(args.root_id,args.artifact_key,execution=args.execution,dtype_mode=args.dtype_mode,batch_size=args.batch_size);value.pop("records",None);print(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False))
