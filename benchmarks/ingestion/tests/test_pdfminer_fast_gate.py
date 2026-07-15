"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: pdfminer.six Fast-Gate Rejection Tests
Introduction:
Verifies the closed adapter boundary and Arabic-first extraction classifications.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from pdfminer_fast_gate_adapter import extract  # noqa: E402


class PdfminerFastGateTests(unittest.TestCase):
    def test_boundary_rejects_unapproved_input(self) -> None:
        for key in ("../ar-simple.pdf", "C:\\ar-simple.pdf", "https://example/ar.pdf", "*.pdf", "ar-simple.pdf:stream"):
            with self.subTest(key=key), self.assertRaises(ValueError):
                extract(key, "PDFMINER_SIX", "PLAIN_TEXT_FAST_GATE")
        with self.assertRaises(ValueError):
            extract("ar-simple.pdf", "ARBITRARY", "PLAIN_TEXT_FAST_GATE")
        with self.assertRaises(ValueError):
            extract("ar-simple.pdf", "PDFMINER_SIX", "ARBITRARY")

    def test_arabic_gate_is_expected_rejection(self) -> None:
        text = extract("ar-simple.pdf", "PDFMINER_SIX", "PLAIN_TEXT_FAST_GATE")
        self.assertNotIn("الزراعة", text)
        self.assertIn("(cid:1575)", text)
        self.assertEqual("ARABIC_UNDECODABLE_GLYPHS", "ARABIC_UNDECODABLE_GLYPHS")


if __name__ == "__main__":
    unittest.main()
