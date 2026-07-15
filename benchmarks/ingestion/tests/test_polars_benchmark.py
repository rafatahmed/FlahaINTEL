"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Polars Benchmark Tests
Introduction:
Verifies governed parsing, dtype modes, execution equivalence, and path safety.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import json,pathlib,shutil,sys,tempfile,unittest,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1];CORPUS=ROOT/"corpus";sys.path.insert(0,str(ROOT/"scripts"))
from polars_adapter import identity,load
from run_polars_benchmark import run

class AdapterTests(unittest.TestCase):
 def fixture(self,text:str):
  root=ROOT/"results"/(".polars-fixture-"+uuid.uuid4().hex);root.mkdir();self.addCleanup(shutil.rmtree,root);(root/"x.csv").write_text(text,encoding="utf-8");return root
 def test_identity(self): self.assertEqual(identity()["polarsVersion"],"1.42.1");self.assertEqual(identity()["importPath"],"<isolated-env>/polars/__init__.py")
 def test_formats(self): self.assertEqual(load(CORPUS,"datasets/records.csv")["recordCount"],3);self.assertEqual(load(CORPUS,"datasets/records.json")["recordCount"],3);self.assertEqual(load(CORPUS,"datasets/records.jsonl")["recordCount"],2)
 def test_arabic_null_duplicates_mixed(self):
  r=load(CORPUS,"datasets/records.json");text=json.dumps(r["records"],ensure_ascii=False,allow_nan=False);self.assertIn("قمح",text);self.assertIn("null",text);self.assertEqual(r["records"][1],r["records"][2])
 def test_execution_hashes_and_order(self):
  values=[load(CORPUS,"datasets/streaming.csv",execution=m) for m in ("eager","lazy","streaming")];self.assertEqual(len({v["normalizedRecordsSha256"] for v in values}),1);self.assertEqual([v["records"] for v in values[1:]],[values[0]["records"]]*2)
 def test_repeat_deterministic(self): self.assertEqual(load(CORPUS,"datasets/records.csv")["normalizedRecordsSha256"],load(CORPUS,"datasets/records.csv")["normalizedRecordsSha256"])
 def test_text_leading_zero_arabic(self): self.assertEqual(load(self.fixture("id,text\n001,قمح\n"),"x.csv",dtype_mode="TEXT_PRESERVING")["records"][0],{"id":"001","text":"قمح"})
 def test_strict_decimal_and_boolean(self):
  r=load(self.fixture("id,amount,active\n1,12.340,true\n"),"x.csv",dtype_mode="STRICT_SCHEMA",schema={"id":"integer","amount":"decimal","active":"boolean"});self.assertEqual(r["records"][0],{"id":1,"amount":"12.340","active":True})
 def test_strict_failures(self):
  root=self.fixture("id,x\na,b\n");self.assertEqual(load(root,"x.csv",dtype_mode="STRICT_SCHEMA",schema={"id":"integer"})["errorCode"],"SCHEMA_COLUMNS_MISMATCH");self.assertEqual(load(root,"x.csv",dtype_mode="STRICT_SCHEMA",schema={"id":"integer","x":"string"})["errorCode"],"SCHEMA_VALUE_INVALID")
 def test_inference_evidence(self): self.assertIsNotNone(load(CORPUS,"datasets/records.csv")["inferenceEvidence"])
 def test_nonstandard_json_rejected(self):
  root=ROOT/"results"/(".polars-fixture-"+uuid.uuid4().hex);root.mkdir();self.addCleanup(shutil.rmtree,root);(root/"x.json").write_text("[NaN]",encoding="utf-8");self.assertEqual(load(root,"x.json")["classification"],"QUARANTINED")
 def test_malformed_csv_blocked_first(self): self.assertEqual(load(CORPUS,"datasets/malformed.csv")["classification"],"QUARANTINED")
 def test_unsafe_paths(self):
  for p in ("../x.csv","C:/x.csv","/x.csv","https://example.test/x.csv"):
   with self.assertRaises(ValueError):load(CORPUS,p)
 def test_symlink_escape_when_available(self):
  root=self.fixture("a\n1\n");link=root/"link.csv"
  try:link.symlink_to(CORPUS/"datasets/records.csv")
  except OSError:self.skipTest("symlink unavailable")
  with self.assertRaises(ValueError):load(root,"link.csv")

class RunnerTests(unittest.TestCase):
 def test_two_runs_have_zero_determinism_and_mode_mismatches(self):
  root=ROOT/"results"/(".polars-run-"+uuid.uuid4().hex);root.mkdir();self.addCleanup(shutil.rmtree,root);a=run("20260715T010203Z-abcdef12",root);b=run("20260715T010204Z-abcdef13",root);sa=json.loads((a/"summary.json").read_text());sb=json.loads((b/"summary.json").read_text());self.assertEqual(sa["determinismFailures"],0);self.assertEqual(sa["executionHashMismatches"],0);self.assertEqual(sa["resultCount"],sb["resultCount"])

if __name__=="__main__":unittest.main()
