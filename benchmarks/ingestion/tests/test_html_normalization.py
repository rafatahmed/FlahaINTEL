"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: HTML Normalization Tests
Introduction:
Verifies deterministic Unicode and canonical JSON comparison behavior.

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
from html_normalization import canonical_hash, normalize_text


class NormalizationTests(unittest.TestCase):
    def test_unicode_line_endings_and_nbsp_are_normalized(self):
        self.assertEqual(normalize_text(" A\u0301\r\nWater\u00a0  المياه\t"), "Á\nWater المياه")

    def test_hash_is_key_order_independent_and_array_order_sensitive(self):
        self.assertEqual(canonical_hash({"b": 2, "a": 1}), canonical_hash({"a": 1, "b": 2}))
        self.assertNotEqual(canonical_hash([1, 2]), canonical_hash([2, 1]))


if __name__ == "__main__":
    unittest.main()
