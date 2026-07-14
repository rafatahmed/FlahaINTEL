"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Pandas Benchmark Tests
Introduction:
Verifies governed parsing, normalization, isolation, comparison, and determinism.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import json
import os
import pathlib
import shutil
import socket
import sys
import unittest
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
CORPUS = ROOT / "corpus"
sys.path.insert(0, str(ROOT / "scripts"))
import pandas_adapter
from pandas_adapter import identity, load, normalize
from run_pandas_benchmark import run


class PandasAdapterTests(unittest.TestCase):
    def test_exact_identity_is_recorded_and_redacted(self):
        value = identity()
        self.assertEqual(value["pandasVersion"], "2.3.3")
        self.assertEqual(value["numpyVersion"], "2.3.5")
        self.assertEqual(value["pandasImportPath"], "<user-site>/pandas/__init__.py")
        self.assertEqual(value["numpyImportPath"], "<user-site>/numpy/__init__.py")

    def test_valid_formats_parse(self):
        self.assertEqual(load(CORPUS, "datasets/records.csv")["recordCount"], 3)
        self.assertEqual(load(CORPUS, "datasets/records.json")["recordCount"], 3)
        self.assertEqual(load(CORPUS, "datasets/records.jsonl")["recordCount"], 2)

    def test_arabic_null_mixed_types_and_duplicates_are_preserved(self):
        value = load(CORPUS, "datasets/records.json")
        encoded = json.dumps(value["records"], ensure_ascii=False, allow_nan=False)
        self.assertIn("قمح", encoded)
        self.assertIn("null", encoded)
        self.assertEqual(value["records"][1], value["records"][2])
        self.assertIn("value", value["inferredDtypes"])

    def test_scalar_normalization_is_strict_json_compatible(self):
        import numpy as np
        import pandas as pd
        self.assertIsNone(normalize(pd.NA)); self.assertIsNone(normalize(np.nan)); self.assertIsNone(normalize(pd.NaT))
        self.assertEqual(normalize(np.int64(4)), 4); self.assertEqual(normalize(np.bool_(True)), True)
        self.assertEqual(normalize(pd.Timestamp("2026-07-15T00:00:00Z")), "2026-07-15T00:00:00+00:00")
        with self.assertRaises(TypeError): normalize(object())

    def test_malformed_inputs_are_deterministic(self):
        for name in ("malformed.csv", "malformed.json", "malformed.jsonl"):
            first = load(CORPUS, f"datasets/{name}")
            second = load(CORPUS, f"datasets/{name}")
            first.pop("elapsedNanoseconds"); second.pop("elapsedNanoseconds")
            self.assertEqual(first, second)
        self.assertEqual(load(CORPUS, "datasets/malformed.json")["classification"], "MALFORMED_INPUT")
        self.assertEqual(load(CORPUS, "datasets/malformed.jsonl")["classification"], "MALFORMED_INPUT")

    def test_unsafe_and_remote_inputs_are_rejected(self):
        for unsafe in ("C:/absolute.csv", "/absolute.csv", "../outside.csv", "https://example.test/data.csv", "file://data.csv"):
            with self.assertRaises(ValueError): load(CORPUS, unsafe)

    def test_symlink_escape_is_rejected_when_supported(self):
        with test_root() as root:
            link = root / "escape.csv"
            try: link.symlink_to(CORPUS / "datasets/records.csv")
            except OSError: self.skipTest("symlink creation unavailable")
            with self.assertRaises(ValueError): load(root, "escape.csv")

    def test_chunksize_and_full_load_are_equivalent(self):
        full = load(CORPUS, "datasets/streaming.csv")
        chunked = load(CORPUS, "datasets/streaming.csv", chunksize=64)
        self.assertEqual(full["records"], chunked["records"])
        self.assertEqual(chunked["chunksize"], 64)

    def test_forbidden_execution_paths_do_not_exist(self):
        source = pathlib.Path(pandas_adapter.__file__).read_text(encoding="utf-8").lower()
        for forbidden in ("read_pickle", "to_pickle", "eval(", "query(", "read_sql", "to_sql", "subprocess", "http://", "https://"):
            self.assertNotIn(forbidden, source)


class PandasRunnerTests(unittest.TestCase):
    def test_two_runs_are_equivalent_and_results_are_valid(self):
        with test_root() as root:
            first = run("20260715T010203Z-abcdef12", root)
            second = run("20260715T010204Z-abcdef13", root)
            first_results = read_results(first); second_results = read_results(second)
            self.assertEqual(normalized_results(first_results), normalized_results(second_results))
            self.assertTrue(all(result["deterministic"] for result in first_results))
            self.assertTrue(all("comparison" in result for result in first_results))
            self.assertNotIn("DATABASE_URL", (first / "environment.json").read_text(encoding="utf-8"))
            for path in first.rglob("*.json"):
                json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)

    def test_output_root_escape_and_duplicate_run_are_rejected(self):
        with test_root() as root:
            run("20260715T010203Z-abcdef12", root)
            with self.assertRaises(FileExistsError): run("20260715T010203Z-abcdef12", root)
            with self.assertRaises(ValueError): run("../escape", root)

    def test_ambient_secret_is_not_copied(self):
        prior = os.environ.get("DATABASE_URL"); os.environ["DATABASE_URL"] = "postgresql://secret"
        try:
            with test_root() as root:
                run_root = run("20260715T010203Z-abcdef12", root)
                combined = "".join(path.read_text(encoding="utf-8") for path in run_root.rglob("*.json*"))
                self.assertNotIn("postgresql://secret", combined)
        finally:
            if prior is None: del os.environ["DATABASE_URL"]
            else: os.environ["DATABASE_URL"] = prior

    def test_no_listener_or_process_is_created(self):
        before = can_bind(3003), can_bind(5174)
        load(CORPUS, "datasets/records.csv")
        self.assertEqual((can_bind(3003), can_bind(5174)), before)


def read_results(root: pathlib.Path) -> list[dict[str, object]]:
    return [json.loads(line, parse_constant=reject_constant) for line in (root / "engine-results.jsonl").read_text(encoding="utf-8").splitlines()]


def normalized_results(results: list[dict[str, object]]) -> list[dict[str, object]]:
    return [{key: value for key, value in result.items() if key not in {"runId", "timestampUtc", "elapsedNanoseconds"}} for result in results]


def reject_constant(value: str):
    raise ValueError(f"non-standard JSON constant: {value}")


class test_root:
    def __enter__(self):
        self.path = ROOT / "results" / f".pandas-test-{uuid.uuid4().hex}"
        self.path.mkdir(); return self.path
    def __exit__(self, *_):
        shutil.rmtree(self.path)


def can_bind(port: int) -> bool:
    with socket.socket() as listener:
        try: listener.bind(("127.0.0.1", port)); return True
        except OSError: return False


if __name__ == "__main__":
    unittest.main()
