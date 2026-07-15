"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed HTML Artifact Policy Tests
Introduction:
Verifies path, type, and byte-bound enforcement before candidate parsing.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from html_artifact_policy import governed_html


class ArtifactPolicyTests(unittest.TestCase):
    def test_governed_relative_html_is_accepted(self):
        path, data = governed_html(ROOT / "corpus", "html/clean-article.html")
        self.assertEqual(path.name, "clean-article.html")
        self.assertTrue(data.startswith(b"<!doctype html>"))

    def test_windows_and_posix_attacks_are_rejected(self):
        attacks = ["../x.html", "/x.html", "C:/x.html", r"C:\x.html", r"\\server\share\x.html", "//server/share/x.html", r"\\?\C:\x.html", "html/x.html:secret", "html/CON.html", "html/aux.txt.html", "html//x.html", "html/./x.html"]
        for value in attacks:
            with self.subTest(value=value), self.assertRaises(ValueError):
                governed_html(ROOT / "corpus", value)

    def test_size_and_suffix_are_enforced(self):
        with self.assertRaisesRegex(ValueError, "ARTIFACT_TOO_LARGE"):
            governed_html(ROOT / "corpus", "html/clean-article.html", max_bytes=1)
        with self.assertRaises(ValueError):
            governed_html(ROOT / "corpus", "manifest.json")


if __name__ == "__main__":
    unittest.main()
