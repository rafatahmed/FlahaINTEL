"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Isolated Environment Tests
Introduction:
Verifies the exact wheel, runtime inventory, native containment, and isolation.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import hashlib,importlib.metadata as md,importlib.util,json,os,pathlib,site,socket,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[3]
class DuckDBIsolationTests(unittest.TestCase):
 def test_version_native_and_containment(self):
  import duckdb,_duckdb
  self.assertEqual(duckdb.__version__,"1.5.4");self.assertIn(".benchmark-envs",duckdb.__file__);self.assertIn(".benchmark-envs",_duckdb.__file__);self.assertTrue(_duckdb.__file__.endswith(".pyd"))
 def test_inventory_and_absence(self):
  self.assertFalse(site.ENABLE_USER_SITE);self.assertNotIn(site.getusersitepackages(),sys.path)
  for name in ("numpy","pandas","polars","pyarrow","fsspec","sqlalchemy"):self.assertIsNone(importlib.util.find_spec(name))
  self.assertEqual({d.metadata["Name"].lower() for d in md.distributions()},{"pip","duckdb"});self.assertFalse(list(pathlib.Path(sys.prefix,"Lib/site-packages").glob("*.pth")))
 def test_no_secret_or_listener(self):
  self.assertNotIn("DATABASE_URL",os.environ)
  for port in (3003,5174):
   with socket.socket() as value:value.bind(("127.0.0.1",port))
 def test_wheel_lock(self):
  lock=json.loads((ROOT/"benchmarks/ingestion/config/duckdb-isolated-environment-lock.json").read_text());package=lock["distributions"][0];wheelhouse=ROOT/".benchmark-wheelhouse/duckdb-1.5.4-py314-win-amd64";files=[p for p in wheelhouse.iterdir() if p.is_file()];self.assertEqual({p.name for p in files},{package["wheel"]});path=files[0];self.assertEqual(path.stat().st_size,package["byteSize"]);self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),package["sha256"])
 def test_latest_retained_gate_a_result_parses(self):
  summaries=sorted((ROOT/"benchmarks/ingestion/results/duckdb-gate-a").glob("*/summary.json"));self.assertTrue(summaries);value=json.loads(summaries[-1].read_text(encoding="utf-8"));self.assertTrue(value["passed"]);self.assertEqual(value["probe"]["wheel"]["topLevelDownloadedArtifacts"],["duckdb-1.5.4-cp314-cp314-win_amd64.whl"])
 def test_latest_offline_reconstruction_result_parses(self):
  summaries=sorted((ROOT/"benchmarks/ingestion/results/duckdb-offline-reconstruction").glob("*/summary.json"));self.assertTrue(summaries);value=json.loads(summaries[-1].read_text(encoding="utf-8"));runtime=value["validation"]["evidence"]["runtime"]
  self.assertTrue(value["passed"]);self.assertTrue(value["installationCommand"]["noIndex"]);self.assertTrue(value["installationCommand"]["requireHashes"]);self.assertEqual(value["install"]["exitCode"],0);self.assertEqual(value["pipCheck"]["exitCode"],0);self.assertEqual(runtime["distributionInventory"],[["duckdb","1.5.4"],["pip","25.2"]]);self.assertFalse(any(runtime["forbiddenModulesImportable"].values()));self.assertTrue(value["cleanup"]["temporaryEnvironmentRemoved"]);self.assertFalse(pathlib.Path(value["temporaryEnvironment"]).exists())
if __name__=="__main__":unittest.main()
