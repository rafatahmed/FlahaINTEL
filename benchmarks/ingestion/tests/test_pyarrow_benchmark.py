"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: PyArrow Benchmark Tests
Introduction:
Verifies governed parsing, dtype modes, execution equivalence, and path safety.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import json,pathlib,shutil,sys,tempfile,unittest,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1];CORPUS=ROOT/"corpus";sys.path.insert(0,str(ROOT/"scripts"))
from pyarrow_adapter import identity,load
from run_pyarrow_benchmark import run
class AdapterTests(unittest.TestCase):
 def fixture(self,name,text,encoding="utf-8"):
  root=ROOT/"results"/(".pyarrow-fixture-"+uuid.uuid4().hex);root.mkdir();self.addCleanup(shutil.rmtree,root);(root/name).write_text(text,encoding=encoding);return root
 def test_identity(self):self.assertEqual(identity()["pyarrowVersion"],"25.0.0");self.assertEqual(identity()["importPath"],"<isolated-env>/pyarrow/__init__.py")
 def test_formats(self):self.assertEqual(load(CORPUS,"datasets/records.csv")["recordCount"],3);self.assertEqual(load(CORPUS,"datasets/records.json")["recordCount"],3);self.assertEqual(load(CORPUS,"datasets/records.jsonl")["recordCount"],2)
 def test_arabic_null_duplicates_mixed(self):
  r=load(CORPUS,"datasets/records.json");text=json.dumps(r["records"],ensure_ascii=False,allow_nan=False);self.assertIn("قمح",text);self.assertIn("null",text);self.assertEqual(r["records"][1],r["records"][2])
 def test_csv_execution_hashes_order_and_threading(self):
  values=[load(CORPUS,"datasets/streaming.csv",execution=m) for m in ("eager","threaded","incremental")];self.assertEqual({v["normalizedRecordsSha256"] for v in values},{values[0]["normalizedRecordsSha256"]});self.assertEqual([v["records"] for v in values[1:]],[values[0]["records"]]*2);self.assertFalse(values[2]["materializedTable"]);self.assertFalse(values[2]["readAllCalled"]);self.assertGreater(values[2]["batchCount"],0)
 def test_jsonl_execution_equivalence(self):
  a=load(CORPUS,"datasets/records.jsonl",execution="eager");b=load(CORPUS,"datasets/records.jsonl",execution="incremental");self.assertEqual(a["normalizedRecordsSha256"],b["normalizedRecordsSha256"]);self.assertEqual(b["api"],"pyarrow.json.open_json")
 def test_text_leading_zero_arabic_decimal_timestamp(self):
  root=self.fixture("x.csv","id,amount,text,timestamp\n001,12.340,قمح,2026-07-15T00:00:00Z\n");r=load(root,"x.csv",dtype_mode="TEXT_PRESERVING");self.assertEqual(r["records"][0],{"id":"001","amount":"12.340","text":"قمح","timestamp":"2026-07-15T00:00:00Z"})
 def test_strict_schema_decimal_boolean(self):
  root=self.fixture("x.csv","id,amount,active\n1,12.340,true\n");r=load(root,"x.csv",dtype_mode="STRICT_SCHEMA",schema={"id":"integer","amount":"decimal","active":"boolean"});self.assertEqual(r["records"][0],{"id":1,"amount":"12.340","active":True})
 def test_strict_failures(self):
  root=self.fixture("x.csv","id,x\na,b\n");self.assertEqual(load(root,"x.csv",dtype_mode="STRICT_SCHEMA",schema={"id":"integer"})["classification"],"QUARANTINED");self.assertEqual(load(root,"x.csv",dtype_mode="STRICT_SCHEMA",schema={"id":"integer","x":"string"})["classification"],"QUARANTINED")
 def test_inference_evidence(self):self.assertIsNotNone(load(CORPUS,"datasets/records.csv")["inferenceEvidence"])
 def test_nonstandard_json_rejected(self):
  root=self.fixture("x.json","[NaN]");self.assertEqual(load(root,"x.json")["classification"],"QUARANTINED")
 def test_malformed_csv_blocked_first(self):self.assertEqual(load(CORPUS,"datasets/malformed.csv")["errorCode"],"CSV_INCONSISTENT_FIELDS")
 def test_unsafe_paths(self):
  for path in ("../x.csv","C:/x.csv","/x.csv","https://example.test/x.csv"):
   with self.assertRaises(ValueError):load(CORPUS,path)
 def test_symlink_escape_when_available(self):
  root=self.fixture("x.csv","a\n1\n");link=root/"link.csv"
  try:link.symlink_to(CORPUS/"datasets/records.csv")
  except OSError:self.skipTest("symlink unavailable")
  with self.assertRaises(ValueError):load(root,"link.csv")
class RunnerTests(unittest.TestCase):
 def test_two_runs_zero_mismatches(self):
  root=ROOT/"results"/(".pyarrow-run-"+uuid.uuid4().hex);root.mkdir();self.addCleanup(shutil.rmtree,root);a=run("20260715T010203Z-abcdef12",root);b=run("20260715T010204Z-abcdef13",root);sa=json.loads((a/"summary.json").read_text());sb=json.loads((b/"summary.json").read_text());self.assertEqual(sa["determinismFailures"],0);self.assertEqual(sa["executionHashMismatches"],0);self.assertEqual(sa["resultCount"],sb["resultCount"])
if __name__=="__main__":unittest.main()
