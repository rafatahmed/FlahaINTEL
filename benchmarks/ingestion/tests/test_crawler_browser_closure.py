"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Crawler and Browser Closure Evidence Tests
Introduction: Validates containment, artifact separation, reconstruction, resources, and determinism evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

import json, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]; REPORTS=ROOT/"benchmarks"/"ingestion"/"reports"; RESULTS=ROOT/"benchmarks"/"ingestion"/"results"/"crawler-browser"


class ClosureEvidenceTests(unittest.TestCase):
    def read(self,path): return json.loads(path.read_text(encoding="utf-8-sig"))

    def test_reconstructions_pass_and_clean(self):
        for name in ["crawler-browser-scrapy-reconstruction.json","crawler-browser-playwright-reconstruction.json"]:
            evidence=self.read(REPORTS/name); self.assertEqual(evidence["status"],"PASS"); self.assertTrue(evidence["destination_removed"])

    def test_determinism_is_closed(self):
        evidence=self.read(REPORTS/"crawler-browser-determinism.json"); self.assertEqual(evidence["runs"],2); self.assertEqual((evidence["hash_mismatches"],evidence["classification_mismatches"],evidence["policy_mismatches"]),(0,0,0)); self.assertEqual(len(evidence["run_ids"]),2)

    def test_browser_artifacts_and_containment(self):
        value=self.read(RESULTS/"run-1-playwright.json"); self.assertNotEqual(value["raw_sha256"],value["rendered_sha256"]); self.assertNotEqual(value["raw_artifact_key"],value["rendered_artifact_key"]); self.assertTrue(value["downloads"]); self.assertTrue(value["popups"]); self.assertTrue(value["iframes"]); self.assertTrue(value["web_workers"]); self.assertTrue(value["websockets"]); self.assertIn("http://example.invalid/third-party",value["policy_rejections"]); self.assertIn("http://10.0.0.1/worker-blocked",value["policy_rejections"])

    def test_scrapy_policy_and_artifacts(self):
        value=self.read(RESULTS/"run-1-scrapy.json"); results=value["results"]; self.assertTrue(all("sha256" in item and "response_headers" in item for item in results)); self.assertTrue(any(item["failure_classification"]=="ignorerequest" for item in results)); self.assertTrue(any(item["robots_result"]=="not_acquired" for item in results))

    def test_resource_tree_is_sampled_and_reserve_held(self):
        value=self.read(REPORTS/"crawler-browser-resource-evidence.json"); self.assertGreater(value["scrapy"]["process_tree"][0]["sample_count"],0); self.assertGreater(value["playwright"]["process_tree"][0]["peak_process_count"],1); self.assertGreater(value["playwright"]["process_tree"][0]["peak_process_tree_memory_bytes"],0); self.assertGreaterEqual(value["disk"]["lowest_observed_free_disk_bytes"],value["disk"]["required_reserve_bytes"])


if __name__=="__main__": unittest.main()
