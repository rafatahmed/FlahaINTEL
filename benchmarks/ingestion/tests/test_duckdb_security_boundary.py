"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Security Boundary Tests
Introduction:
Verifies exact-path access, fixed ordering, and denial of unsafe DuckDB capabilities.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import json,pathlib,shutil,sys,unittest
from unittest import mock
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/"scripts"))
from duckdb_security_probe import PROBE_BASE,run

class SecurityBoundaryTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.result=run()
 def test_identity_and_isolation(self):
  self.assertEqual(self.result["duckdbVersion"],"1.5.4");self.assertIn(".benchmark-envs",self.result["importPath"])
 def test_exact_path_and_ordering(self):
  expected=[(1,"alpha"),(2,"beta"),(3,"gamma")];ordering=self.result["ordering"]
  self.assertEqual(ordering["singleThreadFetchall"],expected);self.assertEqual(ordering["multiThreadFetchall"],expected);self.assertEqual(ordering["multiThreadFetchmany"],expected);self.assertEqual(ordering["multiThreadRepeated"],expected);self.assertTrue(ordering["passed"])
 def test_all_unsafe_operations_are_denied(self):
  operations={value["operationId"]:value for value in self.result["operations"]};failures=[name for name,value in operations.items() if not value["passed"]];self.assertEqual(failures,[])
  required={"SIBLING_READ","PARENT_DIRECTORY_READ","TRAVERSAL_READ","GLOB_READ","UNC_READ","DEVICE_READ","ADS_READ","HTTP_READ","INSTALL_EXTENSION","AUTOLOAD_EXTENSION","PERSISTENT_DATABASE_CREATE","ATTACH_DATABASE","CREATE_SECRET","ARBITRARY_WRITE","ENABLE_EXTERNAL_ACCESS"};self.assertEqual(required-set(operations),set())
 def test_no_extension_spill_listener_or_unexpected_file(self):
  self.assertEqual(self.result["directoryContentsBefore"],self.result["directoryContentsAfter"]);self.assertTrue(self.result["spillControlled"]);self.assertTrue(all(self.result["listenerPortsAvailable"].values()));self.assertTrue(self.result["probeRootRemoved"]);self.assertEqual(self.result["remainingProbePaths"],[])
 def test_expected_settings_and_extension_scoped_absence(self):
  self.assertEqual(self.result["unsupportedSettings"],["enable_global_s3_configuration"])
 def test_failed_cleanup_fails(self):
  before=set(PROBE_BASE.iterdir()) if PROBE_BASE.exists() else set()
  with mock.patch("duckdb_security_probe._remove_probe_root",return_value=False):result=run()
  created=(set(PROBE_BASE.iterdir()) if PROBE_BASE.exists() else set())-before
  try:self.assertFalse(result["probeRootRemoved"]);self.assertFalse(result["passed"]);self.assertTrue(result["remainingProbePaths"])
  finally:
   for path in created:shutil.rmtree(path)
 def test_latest_retained_gate_b_result_parses(self):
  summaries=sorted((ROOT/"results"/"duckdb-security").glob("*/summary.json"))
  self.assertTrue(summaries);value=json.loads(summaries[-1].read_text(encoding="utf-8"));self.assertTrue(value["passed"]);self.assertTrue(value["probe"]["probeRootRemoved"])

if __name__=="__main__":unittest.main()
