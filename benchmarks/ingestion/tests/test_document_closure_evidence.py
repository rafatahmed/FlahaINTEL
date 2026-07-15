"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3E-H Closure Evidence Tests
Introduction:
Verifies locked artifacts, reconstruction, determinism, and runtime integrity evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""
from __future__ import annotations
import hashlib,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];CONFIG=ROOT/'benchmarks/ingestion/config';REPORTS=ROOT/'benchmarks/ingestion/reports'
class ClosureEvidenceTests(unittest.TestCase):
 def test_docling_lock_and_models(self):
  lock=json.loads((CONFIG/'document-docling-slim-isolated-environment-lock.json').read_text(encoding='utf-8'));self.assertEqual(lock['wheelCount'],75);self.assertEqual(lock['sdistCount'],0);self.assertEqual(lock['sourceBuildCount'],0);self.assertEqual(lock['ocrPackages'],[]);self.assertEqual(len(lock['distributions']),75)
  wheelhouse=ROOT/'.benchmark-wheelhouse/document-docling-slim-2.111.0-py314-win-amd64';self.assertEqual(len(list(wheelhouse.glob('*.whl'))),75)
  for item in lock['distributions']:
   path=wheelhouse/item['wheel'];self.assertEqual(path.stat().st_size,item['bytes']);self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),item['sha256'])
  models=json.loads((CONFIG/'document-docling-slim-model-lock.json').read_text(encoding='utf-8'))
  for item in models['models']:
   path=ROOT/models['artifactsRoot']/item['path'];self.assertEqual(path.stat().st_size,item['bytes']);self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),item['sha256'])
 def test_reconstruction_and_determinism(self):
  reconstruction=json.loads((REPORTS/'document-docling-offline-reconstruction.json').read_text());self.assertEqual(reconstruction['installExitCode'],0);self.assertEqual(reconstruction['pipCheckExitCode'],0);self.assertTrue(reconstruction['temporaryEnvironmentCleaned']);self.assertEqual(reconstruction['profileCacheChanges'],[])
  comparison=json.loads((REPORTS/'document-comparative-determinism.json').read_text());self.assertEqual(comparison['hashMismatches'],0);self.assertEqual(comparison['classificationMismatches'],0);self.assertEqual(comparison['determinismFailures'],0)
 def test_tika_runtime_hashes(self):
  runtime=ROOT/'.benchmark-runtime/document-tika-3.3.1';jar=runtime/'tika-app-3.3.1.jar';jre=runtime/'OpenJDK21U-jre_x64_windows_hotspot_21.0.11_10.zip';self.assertEqual(jar.stat().st_size,65460062);self.assertEqual(hashlib.sha512(jar.read_bytes()).hexdigest(),'33fc9b566368273607ec997518760e0ae34953169a6b82aca5a45347546002df92dda0cc2205e6f0ba1b093e47b6fc1373d587be18a224657d961a22fc26acc2');self.assertEqual(hashlib.sha256(jre.read_bytes()).hexdigest(),'be26677aaa20b39a62edcaab4c8857a8b76673b0f45abc0b6143b142b62717e4')
if __name__=='__main__':unittest.main()
