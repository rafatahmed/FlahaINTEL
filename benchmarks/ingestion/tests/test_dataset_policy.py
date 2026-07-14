"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Dataset Policy Tests
Introduction:
Verifies schema modes, exact values, deterministic generation, and measurement.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import json,pathlib,sys,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/"scripts"))
from dataset_policy_adapter import load_csv
from generate_large_datasets import generate

class DatasetPolicyTests(unittest.TestCase):
 def fixture(self,text):
  d=tempfile.TemporaryDirectory(); p=pathlib.Path(d.name)/"x.csv"; p.write_text(text,encoding="utf-8"); self.addCleanup(d.cleanup); return p
 def test_strict_success_decimal_boolean_null(self):
  p=self.fixture("id,amount,active,note\n1,12.340,true,\n")
  r=load_csv(p,"STRICT_SCHEMA",{"id":"integer","amount":"decimal","active":"boolean","note":"string"})
  self.assertEqual(r["records"],[{"id":1,"amount":"12.340","active":True,"note":None}])
 def test_missing_and_extra_columns_fail(self):
  p=self.fixture("id,x\n1,a\n"); self.assertEqual(load_csv(p,"STRICT_SCHEMA",{"id":"integer"})["errorCode"],"SCHEMA_COLUMNS_MISMATCH")
 def test_invalid_integer_and_boolean_fail(self):
  for value,kind in (("x","integer"),("yes","boolean")):
   p=self.fixture(f"v\n{value}\n"); self.assertEqual(load_csv(p,"STRICT_SCHEMA",{"v":kind})["errorCode"],"SCHEMA_VALUE_INVALID")
 def test_text_preserves_arabic_and_leading_zero(self):
  r=load_csv(self.fixture("id,text\n001,قمح\n"),"TEXT_PRESERVING"); self.assertEqual(r["records"][0],{"id":"001","text":"قمح"})
 def test_infer_records_evidence(self): self.assertIsNotNone(load_csv(self.fixture("id\n1\n"),"INFER_WITH_EVIDENCE")["inferenceEvidence"])
 def test_malformed_blocked_before_pandas(self): self.assertEqual(load_csv(self.fixture('a,b\n1,"x\n'),"TEXT_PRESERVING")["classification"],"QUARANTINED")
 def test_generation_deterministic_and_bounded(self):
  with tempfile.TemporaryDirectory() as a,tempfile.TemporaryDirectory() as b:
   x=generate(pathlib.Path(a),10_000); y=generate(pathlib.Path(b),10_000); self.assertEqual(x["sha256"],y["sha256"]); self.assertEqual(x["rows"],10_000)
 def test_nonstandard_json_rejected(self):
  with self.assertRaises(ValueError): json.loads("[NaN]",parse_constant=lambda x: (_ for _ in ()).throw(ValueError(x)))

if __name__=="__main__": unittest.main()
