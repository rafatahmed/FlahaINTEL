"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Ingestion Benchmark Framework Tests
Introduction:
Verifies corpus governance, path containment, baselines, and reproducibility.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import copy
import json
import os
import pathlib
import shutil
import socket
import sys
import unittest
import uuid
from contextlib import contextmanager

ROOT = pathlib.Path(__file__).resolve().parents[1]
TEMP_ROOT = ROOT / "results"
sys.path.insert(0, str(ROOT / "scripts"))
from benchmark_lib import extract_html, load_dataset, safe_relative, validate_run_id
from inspect_environment import inventory
from run_baselines import run
from summarize_results import summarize
from verify_corpus import verify


class CorpusTests(unittest.TestCase):
    def setUp(self):
        self.corpus = ROOT / "corpus"
        self.manifest = json.loads((self.corpus / "manifest.json").read_text(encoding="utf-8"))

    def mutate_manifest(self, mutation):
        temporary = test_directory()
        base = temporary.__enter__()
        root = base / "corpus"
        shutil.copytree(self.corpus, root)
        value = copy.deepcopy(self.manifest); mutation(value)
        (root / "manifest.json").write_text(json.dumps(value), encoding="utf-8")
        return temporary, verify(root)

    def test_manifest_files_hashes_and_expected_outputs(self):
        self.assertEqual(verify(self.corpus), [])
        self.assertGreaterEqual(len(self.manifest["items"]), 20)

    def test_duplicate_ids_are_rejected(self):
        temporary, errors = self.mutate_manifest(lambda value: value["items"].append(copy.deepcopy(value["items"][0])))
        self.addCleanup(temporary.__exit__, None, None, None); self.assertTrue(any("duplicate corpus ID" in error for error in errors))

    def test_unsafe_absolute_and_parent_paths_are_rejected(self):
        for unsafe in ("../outside", "/absolute", "C:\\absolute", "//server/share"):
            with self.assertRaises(ValueError): safe_relative(self.corpus, unsafe)

    def test_unsafe_manifest_path_is_rejected(self):
        temporary, errors = self.mutate_manifest(lambda value: value["items"][0].update(path="../outside.pdf"))
        self.addCleanup(temporary.__exit__, None, None, None); self.assertTrue(any("unsafe path" in error for error in errors))

    def test_unsupported_category_and_language_are_rejected(self):
        temporary, errors = self.mutate_manifest(lambda value: value["items"][0].update(category="VIDEO", language="xx"))
        self.addCleanup(temporary.__exit__, None, None, None)
        self.assertTrue(any("unsupported category" in error for error in errors))
        self.assertTrue(any("unsupported language" in error for error in errors))


class BaselineTests(unittest.TestCase):
    def test_html_is_deterministic_and_malformed_input_is_tolerated(self):
        path = ROOT / "corpus/html/malformed-article.html"
        self.assertEqual(extract_html(path), extract_html(path))
        self.assertIn("Still parseable", str(extract_html(path)["text"]))

    def test_html_excludes_noise_and_preserves_arabic(self):
        noisy = extract_html(ROOT / "corpus/html/noisy-article.html")
        arabic = extract_html(ROOT / "corpus/html/arabic-article.html")
        self.assertNotIn("Menu Noise", noisy["text"]); self.assertNotIn("alert", noisy["text"])
        self.assertIn("يحافظ على المياه", arabic["text"])

    def test_dataset_baselines_preserve_unicode_and_classify_malformed_inputs(self):
        valid = load_dataset(ROOT / "corpus/datasets/records.jsonl")
        malformed = [load_dataset(ROOT / f"corpus/datasets/malformed.{suffix}") for suffix in ("csv", "json", "jsonl")]
        self.assertIn("قمح", json.dumps(valid, ensure_ascii=False))
        self.assertTrue(all(value["classification"] == "MALFORMED_INPUT" for value in malformed))
        self.assertEqual(malformed, [load_dataset(ROOT / f"corpus/datasets/malformed.{suffix}") for suffix in ("csv", "json", "jsonl")])

    def test_run_ids_are_strict(self):
        validate_run_id("20260715T010203Z-abcdef12")
        for invalid in ("latest", "../run", "20260715-abcdef12"):
            with self.assertRaises(ValueError): validate_run_id(invalid)

    def test_result_writes_stay_inside_root_and_json_is_valid(self):
        with test_directory() as root:
            run_root = run(2, "20260715T010203Z-abcdef12", root)
            self.assertEqual(run_root.parent, root.resolve())
            for path in run_root.rglob("*.json"):
                json.loads(path.read_text(encoding="utf-8"))
            for line in (run_root / "engine-results.jsonl").read_text(encoding="utf-8").splitlines():
                json.loads(line)
            summary = summarize(run_root)
            self.assertEqual(summary["determinismFailures"], 0)
            self.assertEqual(summary["expectationFailures"], 0)
            self.assertEqual(summary["resultCount"], 14)

    def test_existing_result_directory_is_immutable(self):
        with test_directory() as root:
            run(2, "20260715T010203Z-abcdef12", root)
            with self.assertRaises(FileExistsError): run(2, "20260715T010203Z-abcdef12", root)

    def test_environment_inventory_copies_no_secrets(self):
        prior = os.environ.get("DATABASE_URL"); os.environ["DATABASE_URL"] = "postgresql://secret"
        try:
            value = inventory(); encoded = json.dumps(value)
            self.assertNotIn("secret", encoded); self.assertNotIn("DATABASE_URL", encoded)
            self.assertFalse(value["databaseUrlPresent"]); self.assertFalse(value["sensitiveEnvironmentCopied"])
        finally:
            if prior is None: del os.environ["DATABASE_URL"]
            else: os.environ["DATABASE_URL"] = prior

    def test_no_listener_is_created(self):
        before = can_bind(3003), can_bind(5174)
        extract_html(ROOT / "corpus/html/clean-article.html")
        self.assertEqual((can_bind(3003), can_bind(5174)), before)


def can_bind(port: int) -> bool:
    with socket.socket() as listener:
        try:
            listener.bind(("127.0.0.1", port)); return True
        except OSError:
            return False


@contextmanager
def test_directory():
    path = TEMP_ROOT / f".test-{uuid.uuid4().hex}"
    path.mkdir()
    try:
        yield path
    finally:
        shutil.rmtree(path)


if __name__ == "__main__":
    unittest.main()
