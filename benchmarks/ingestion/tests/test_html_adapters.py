"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: HTML Candidate Adapter Tests
Introduction:
Verifies isolated stdlib, lxml, and Lexbor extraction semantics and determinism.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from html_stdlib_adapter import load as stdlib_load

CANDIDATES = {
    "lxml": (REPO / ".benchmark-envs/html-lxml-6.1.1-py314/Scripts/python.exe", ROOT / "scripts/html_lxml_adapter.py"),
    "selectolax": (REPO / ".benchmark-envs/html-selectolax-0.4.10-py314/Scripts/python.exe", ROOT / "scripts/html_selectolax_adapter.py"),
}


def candidate(name: str, key: str) -> dict[str, object]:
    python, adapter = CANDIDATES[name]
    env = {"PATH": str(python.parent), "SYSTEMROOT": os.environ.get("SYSTEMROOT", r"C:\Windows"), "TEMP": os.environ.get("TEMP", ""), "PYTHONIOENCODING": "utf-8"}
    completed = subprocess.run([str(python), "-I", str(adapter), "--corpus-root", str(ROOT / "corpus"), "--artifact-key", key], capture_output=True, text=True, encoding="utf-8", env=env, shell=False, timeout=10, check=True)
    return json.loads(completed.stdout)


def lxml_mode(key: str, *, strict: bool) -> dict[str, object]:
    python, adapter = CANDIDATES["lxml"]
    env = {"PATH": str(python.parent), "SYSTEMROOT": os.environ.get("SYSTEMROOT", r"C:\Windows"), "TEMP": os.environ.get("TEMP", ""), "PYTHONIOENCODING": "utf-8"}
    command = [str(python), "-I", str(adapter), "--corpus-root", str(ROOT / "corpus"), "--artifact-key", key]
    if strict:
        command.append("--strict")
    return json.loads(subprocess.run(command, capture_output=True, text=True, encoding="utf-8", env=env, shell=False, timeout=10, check=True).stdout)


class AdapterTests(unittest.TestCase):
    def test_all_candidates_preserve_arabic_and_exclude_hidden_content(self):
        values = [stdlib_load(ROOT / "corpus", "html/hidden-content.html"), *(candidate(name, "html/hidden-content.html") for name in CANDIDATES)]
        for value in values:
            self.assertIn("Visible", value["content"]["text"])
            self.assertNotIn("secret", value["content"]["text"])
        arabic = [stdlib_load(ROOT / "corpus", "html/realistic-arabic.html"), *(candidate(name, "html/realistic-arabic.html") for name in CANDIDATES)]
        self.assertTrue(all("تحسنت كفاءة استخدام المياه" in value["content"]["text"] for value in arabic))

    def test_candidates_are_deterministic_and_lexbor_is_primary(self):
        for name in CANDIDATES:
            first = candidate(name, "html/table-spans.html")
            second = candidate(name, "html/table-spans.html")
            self.assertEqual(first["canonicalOutputSha256"], second["canonicalOutputSha256"])
        selectolax = candidate("selectolax", "html/clean-article.html")
        self.assertEqual(selectolax["domEvidence"]["backend"], "Lexbor")
        self.assertFalse(selectolax["domEvidence"]["legacyModestUsed"])

    def test_links_are_observed_without_resolution_or_fetching(self):
        for value in [stdlib_load(ROOT / "corpus", "html/links-nested-table.html"), *(candidate(name, "html/links-nested-table.html") for name in CANDIDATES)]:
            self.assertTrue(all(link["resolvedForm"] is None for link in value["links"]))
            self.assertIn("unsafe-scheme", {link["kind"] for link in value["links"]})

    def test_lxml_strict_and_recovery_modes_are_explicit(self):
        strict = lxml_mode("html/malformed-article.html", strict=True)
        recovery = lxml_mode("html/malformed-article.html", strict=False)
        self.assertEqual(strict["classification"], "MALFORMED_INPUT")
        self.assertIn("PARSER_RECOVERY_USED", recovery["warnings"])
        self.assertIn("Still parseable", recovery["content"]["text"])


if __name__ == "__main__":
    unittest.main()
