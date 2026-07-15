"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: HTML Extraction Security Boundary Tests
Introduction:
Verifies the closed supervisor surface and excluded network, XML, browser, and shell APIs.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import socket
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from html_supervisor_probe import probe


class SecurityBoundaryTests(unittest.TestCase):
    def test_supervisor_is_closed_sanitized_and_creates_no_listener(self):
        before = (can_bind(3003), can_bind(5174))
        for name in ("stdlib", "lxml", "selectolax"):
            value = probe(name, "html/links-nested-table.html")
            self.assertEqual(value["returnCode"], 0)
            self.assertFalse(value["databaseUrlCopied"])
            self.assertFalse(value["urlArgumentAccepted"])
            self.assertFalse(value["shellUsed"])
            self.assertTrue(all(link["resolvedForm"] is None for link in value["stdout"]["links"]))
        self.assertEqual((can_bind(3003), can_bind(5174)), before)

    def test_candidate_sources_exclude_disallowed_capability_apis(self):
        forbidden = ("requests", "urllib.request", "http.client", "socket.", "playwright", "selenium", "subprocess", "os.system", "shell=True", "etree.XMLParser", "etree.parse", "etree.XSLT", "etree.XInclude", "etree.Resolver")
        for name in ("html_stdlib_adapter.py", "html_lxml_adapter.py", "html_selectolax_adapter.py"):
            source = (ROOT / "scripts" / name).read_text(encoding="utf-8")
            for token in forbidden:
                with self.subTest(file=name, token=token):
                    self.assertNotIn(token, source)

    def test_unsafe_artifact_key_is_rejected_before_candidate(self):
        for name in ("stdlib", "lxml", "selectolax"):
            self.assertNotEqual(probe(name, "../outside.html")["returnCode"], 0)


def can_bind(port: int) -> bool:
    with socket.socket() as listener:
        try:
            listener.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


if __name__ == "__main__":
    unittest.main()
