"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Polars Isolated Environment Tests
Introduction:
Verifies exact isolated distributions, native runtime containment, and secret absence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import hashlib,importlib.metadata as md,json,os,pathlib,site,socket,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[3]
class IsolationTests(unittest.TestCase):
 def test_exact_versions_and_containment(self):
  import polars
  self.assertEqual(polars.__version__,"1.42.1");self.assertEqual(md.version("polars-runtime-32"),"1.42.1");self.assertIn(".benchmark-envs",polars.__file__);site_root=pathlib.Path(polars.__file__).parents[1];native=[str(p) for p in site_root.rglob("*.pyd")];self.assertTrue(native);self.assertTrue(all(".benchmark-envs" in p for p in native))
 def test_isolation_inventory_and_secrets(self):
  self.assertFalse(site.ENABLE_USER_SITE);self.assertNotIn(site.getusersitepackages(),sys.path);self.assertIsNone(__import__("importlib.util").util.find_spec("pandas"));self.assertIsNone(__import__("importlib.util").util.find_spec("numpy"));self.assertNotIn("DATABASE_URL",os.environ);self.assertEqual({d.metadata["Name"].lower() for d in md.distributions()},{"pip","polars","polars-runtime-32"})
 def test_no_listener(self):
  for port in (3003,5174):
   with socket.socket() as value:value.bind(("127.0.0.1",port))
 def test_wheel_hash_lock(self):
  lock=json.loads((ROOT/"benchmarks/ingestion/config/polars-isolated-environment-lock.json").read_text());wheelhouse=ROOT/".benchmark-wheelhouse/polars-1.42.1-py314-win-amd64";self.assertEqual({p.name for p in wheelhouse.iterdir()},{p["wheel"] for p in lock["packages"]})
  for package in lock["packages"]:
   path=wheelhouse/package["wheel"];self.assertEqual(path.stat().st_size,package["byteSize"]);self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),package["sha256"])
if __name__=="__main__":unittest.main()
