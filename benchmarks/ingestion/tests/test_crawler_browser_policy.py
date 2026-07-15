"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Crawler and Browser Network Policy Tests
Introduction: Proves the Phase 3E-J closed URL boundary and redirect validation semantics.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from crawler_browser_policy import FixturePolicy, PolicyRejection


class FixturePolicyTests(unittest.TestCase):
    def setUp(self): self.policy = FixturePolicy(43123)

    def test_only_exact_fixture_origin_is_allowed(self):
        self.assertEqual(self.policy.validate("http://127.0.0.1:43123/static#x"), "http://127.0.0.1:43123/static")

    def test_rejects_unsafe_destinations(self):
        values=["https://127.0.0.1:43123/x","http://localhost:43123/x","http://[::1]:43123/x","http://127.0.0.1:80/x","http://user:pass@127.0.0.1:43123/x","http://169.254.169.254/x","file:///etc/passwd","data:text/plain,x","javascript:alert(1)","http://10.0.0.1/x"]
        for value in values:
            with self.subTest(value=value), self.assertRaises((PolicyRejection, ValueError)): self.policy.validate(value)

    def test_rejects_arbitrary_or_authority_relative_routes(self):
        for value in ["http://example.invalid", "//example.invalid/x", "static", "file:///x"]:
            with self.subTest(value=value), self.assertRaises(PolicyRejection): self.policy.governed_url(value)


if __name__ == "__main__": unittest.main()
