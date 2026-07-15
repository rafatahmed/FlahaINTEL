"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: pypdf Rejection Evidence Test
Introduction:
Preserves the governed expected rejection for pypdf Arabic logical text order.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import unittest
from pathlib import Path

from pypdf import PdfReader


class PypdfRejectionEvidenceTests(unittest.TestCase):
    def test_arabic_logical_order_is_expected_rejection(self) -> None:
        source = Path(__file__).resolve().parents[1] / "corpus" / "documents" / "ar-simple.pdf"
        observed = PdfReader(source, strict=True).pages[0].extract_text()
        expected_logical_span = "الزراعة"
        observed_reversed_span = "ةعارزلا"
        classification = "ARABIC_LOGICAL_ORDER_INVALID"

        self.assertNotIn(expected_logical_span, observed)
        self.assertIn(observed_reversed_span, observed)
        self.assertEqual(classification, "ARABIC_LOGICAL_ORDER_INVALID")


if __name__ == "__main__":
    unittest.main()
