"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Benchmark Tests
Introduction:
Verifies governed formats, dtype modes, explicit ordering, and path safety.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import json,pathlib,shutil,sys,unittest,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1];CORPUS=ROOT/"corpus";sys.path.insert(0,str(ROOT/"scripts"))
from duckdb_adapter import APPROVED_ROOTS,identity,load
from run_duckdb_benchmark import run
class DuckDBAdapterTests(unittest.TestCase):
 def fixture(self,name,text):
  relative=".duckdb-fixture-"+uuid.uuid4().hex;root=ROOT/"generated-corpus"/relative;root.mkdir();self.addCleanup(shutil.rmtree,root);(root/name).write_text(text,encoding="utf-8");return relative+"/"+name
 def test_identity(self):self.assertEqual(identity()["duckdbVersion"],"1.5.4");self.assertEqual(identity()["importPath"],"<isolated-env>/duckdb/__init__.py");self.assertEqual(identity()["executionApis"]["relation"],"DuckDBPyConnection.execute+fetchall (fixed relation-mode label)")
 def test_formats(self):self.assertEqual(load("GOVERNED_CORPUS","datasets/records.csv")["recordCount"],3);self.assertEqual(load("GOVERNED_CORPUS","datasets/records.json")["recordCount"],3);self.assertEqual(load("GOVERNED_CORPUS","datasets/records.jsonl")["recordCount"],2)
 def test_execution_order_and_hashes(self):
  values=[load("GOVERNED_CORPUS","datasets/streaming.csv",execution=x,dtype_mode="TEXT_PRESERVING") for x in ("eager","relation","bounded","threaded")];self.assertEqual(len({v["normalizedRecordsSha256"] for v in values}),1);self.assertEqual([v["records"] for v in values[1:]],[values[0]["records"]]*3);self.assertTrue(all(v["explicitOrder"] for v in values))
 def test_json_bounded_equivalence(self):
  for name in ("records.json","records.jsonl"):
   a=load("GOVERNED_CORPUS","datasets/"+name);b=load("GOVERNED_CORPUS","datasets/"+name,execution="bounded");self.assertEqual(a["normalizedRecordsSha256"],b["normalizedRecordsSha256"])
 def test_arabic_null_duplicates(self):
  value=load("GOVERNED_CORPUS","datasets/records.json");text=json.dumps(value["records"],ensure_ascii=False);self.assertIn("قمح",text);self.assertIn("null",text);self.assertEqual(value["records"][1],value["records"][2])
 def test_text_preserving(self):self.assertEqual(load("GENERATED_CORPUS",self.fixture("x.csv","id,text\n001,قمح\n"),dtype_mode="TEXT_PRESERVING")["records"][0],{"id":"001","text":"قمح"})
 def test_strict_decimal_boolean_timestamp(self):
  key=self.fixture("x.csv","id,amount,active,at\n1,12.340,true,2026-07-15T00:00:00Z\n");value=load("GENERATED_CORPUS",key,dtype_mode="STRICT_SCHEMA",schema={"id":"integer","amount":"decimal","active":"boolean","at":"datetime"});self.assertEqual(value["records"][0],{"id":1,"amount":"12.340","active":True,"at":"2026-07-15T00:00:00Z"})
 def test_strict_failures(self):
  key=self.fixture("x.csv","id,x\na,b\n");self.assertEqual(load("GENERATED_CORPUS",key,dtype_mode="STRICT_SCHEMA",schema={"id":"integer"})["classification"],"QUARANTINED");self.assertEqual(load("GENERATED_CORPUS",key,dtype_mode="STRICT_SCHEMA",schema={"id":"integer","x":"string"})["classification"],"QUARANTINED")
 def test_inference_evidence(self):self.assertIsNotNone(load("GOVERNED_CORPUS","datasets/records.csv")["inferenceEvidence"])
 def test_malformed_csv_blocked_first(self):self.assertEqual(load("GOVERNED_CORPUS","datasets/malformed.csv")["errorCode"],"CSV_INCONSISTENT_FIELDS")
 def test_unsafe_paths(self):
  for path in ("../x.csv","C:/x.csv","/x.csv","https://example.test/x.csv","datasets/*.csv","\\\\server\\share\\x.csv","datasets/records.csv:stream","\\\\.\\NUL"):
   with self.assertRaises(ValueError):load("GOVERNED_CORPUS",path)
 def test_caller_cannot_choose_arbitrary_root(self):
  self.assertEqual(set(APPROVED_ROOTS),{"GOVERNED_CORPUS","GENERATED_CORPUS"})
  with self.assertRaises(ValueError):load(str(CORPUS),"datasets/records.csv")
 def test_runner_determinism(self):
  run_id="20260715T000000Z-"+uuid.uuid4().hex[:8];result=run(run_id,ROOT/"results");self.addCleanup(shutil.rmtree,result);summary=json.loads((result/"summary.json").read_text());self.assertEqual(summary["determinismFailures"],0);self.assertEqual(summary["executionHashMismatches"],0);self.assertEqual(summary["comparisonFailures"],0)
if __name__=="__main__":unittest.main()
