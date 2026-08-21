"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Acquisition origin helper tests
Introduction: Default HTTPS port must match robots.txt and stripped-port redirects.

Created by: Rafat Al Khashan
Created date: 2026-08-21
Last modified: 2026-08-21
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from acquisition_origin import public_url, same_origin


class AcquisitionOriginTests(unittest.TestCase):
    def test_https_default_port_matches_robots_and_stripped_redirect(self):
        origin = public_url("https", "example.com", 443, "")
        self.assertEqual(origin, "https://example.com")
        self.assertTrue(same_origin("https://example.com/robots.txt", "https://example.com:443"))
        self.assertTrue(same_origin("https://example.com/", "https://example.com:443"))
        self.assertTrue(same_origin("https://example.com:443/page", "https://example.com"))

    def test_rejects_host_and_scheme_escape(self):
        origin = "https://example.com:443"
        self.assertFalse(same_origin("https://www.example.com/", origin))
        self.assertFalse(same_origin("http://example.com/", origin))
        self.assertFalse(same_origin("https://evil.test/", origin))


if __name__ == "__main__":
    unittest.main()
