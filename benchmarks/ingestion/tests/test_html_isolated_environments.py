"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: HTML Candidate Environment Tests
Introduction:
Verifies exact candidate versions and isolated forbidden-package boundaries.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


class IsolatedEnvironmentTests(unittest.TestCase):
    def test_exact_candidate_inventories(self):
        expected = {
            "html-lxml-6.1.1-py314": {"lxml": "6.1.1", "pip": "25.2"},
            "html-selectolax-0.4.10-py314": {"selectolax": "0.4.10", "pip": "25.2"},
        }
        for environment, wanted in expected.items():
            python = REPO / f".benchmark-envs/{environment}/Scripts/python.exe"
            completed = subprocess.run([str(python), "-I", "-m", "pip", "list", "--format=json"], capture_output=True, text=True, check=True)
            actual = {item["name"].lower(): item["version"] for item in json.loads(completed.stdout)}
            self.assertEqual(actual, wanted)

    def test_candidate_environments_are_isolated(self):
        code = "import importlib.util,site,json;print(json.dumps({'user':site.ENABLE_USER_SITE,'system':site.getsitepackages(),'forbidden':{n:importlib.util.find_spec(n) is not None for n in ['trafilatura','requests','psycopg','prisma','playwright','selenium']}}))"
        for environment in ("html-lxml-6.1.1-py314", "html-selectolax-0.4.10-py314"):
            python = REPO / f".benchmark-envs/{environment}/Scripts/python.exe"
            value = json.loads(subprocess.run([str(python), "-I", "-c", code], capture_output=True, text=True, check=True).stdout)
            self.assertFalse(value["user"])
            self.assertFalse(any(value["forbidden"].values()))


if __name__ == "__main__":
    unittest.main()
