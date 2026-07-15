"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed HTML Encoding Policy Tests
Introduction:
Verifies strict deterministic charset precedence and failure classification.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import codecs
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from html_encoding_policy import decode_html


class EncodingPolicyTests(unittest.TestCase):
    def test_bom_then_trusted_then_meta_then_utf8_precedence(self):
        self.assertEqual(decode_html(codecs.BOM_UTF8 + "é".encode()).reason, "UTF8_BOM")
        self.assertEqual(decode_html("é".encode("cp1252"), "windows-1252").reason, "TRUSTED_ACQUISITION_EVIDENCE")
        self.assertEqual(decode_html(b"<meta charset=windows-1252>\x97").encoding, "windows-1252")
        self.assertEqual(decode_html("الري".encode()).reason, "STRICT_UTF8_DEFAULT")

    def test_unapproved_and_undecodable_inputs_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "UNAPPROVED_ENCODING"):
            decode_html(b"<meta charset=utf-16>text")
        with self.assertRaisesRegex(ValueError, "UNDECODABLE_INPUT"):
            decode_html(b"invalid:\xff\xfe")

    def test_legacy_arabic_is_preserved(self):
        value = decode_html((ROOT / "corpus/html/encoding-windows-1256.html").read_bytes())
        self.assertIn("الري الذكي", value.text)


if __name__ == "__main__":
    unittest.main()
