"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: PyArrow Isolated Environment Tests
Introduction:
Verifies exact isolated distribution, wheel lock, native containment, and secrets.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import hashlib,importlib.metadata as md,importlib.util,json,os,pathlib,site,socket,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[3]
class IsolationTests(unittest.TestCase):
 def test_exact_version_runtime_and_containment(self):
  import pyarrow
  self.assertEqual(pyarrow.__version__,"25.0.0");self.assertIn(".benchmark-envs",pyarrow.__file__);info=pyarrow.runtime_info();self.assertTrue(info.simd_level);self.assertTrue(info.detected_simd_level);self.assertTrue(pyarrow.default_memory_pool().backend_name);site_root=pathlib.Path(pyarrow.__file__).parents[1];native=[str(p) for p in site_root.rglob("*.pyd")]+[str(p) for p in site_root.rglob("*.dll")];self.assertEqual(len(native),33);self.assertTrue(all(".benchmark-envs" in p for p in native))
 def test_isolation_inventory_and_secrets(self):
  self.assertFalse(site.ENABLE_USER_SITE);self.assertNotIn(site.getusersitepackages(),sys.path)
  for name in ("numpy","pandas","polars","cffi","fsspec"):self.assertIsNone(importlib.util.find_spec(name))
  self.assertNotIn("DATABASE_URL",os.environ);self.assertEqual({d.metadata["Name"].lower() for d in md.distributions()},{"pip","pyarrow"});self.assertFalse(list(pathlib.Path(sys.prefix,"Lib/site-packages").glob("*.pth")))
 def test_no_listener(self):
  for port in (3003,5174):
   with socket.socket() as value:value.bind(("127.0.0.1",port))
 def test_wheel_hash_lock(self):
  lock=json.loads((ROOT/"benchmarks/ingestion/config/pyarrow-isolated-environment-lock.json").read_text());package=lock["distributions"][0];wheelhouse=ROOT/".benchmark-wheelhouse/pyarrow-25.0.0-py314-win-amd64";self.assertEqual({p.name for p in wheelhouse.iterdir()},{package["wheel"]});path=wheelhouse/package["wheel"];self.assertEqual(path.stat().st_size,package["byteSize"]);self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),package["sha256"]);self.assertEqual(package["requiresDist"],[])
if __name__=="__main__":unittest.main()
