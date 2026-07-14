"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Pandas Benchmark Adapter
Introduction:
Loads governed local datasets with pandas and produces deterministic safe values.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import math
import time
import warnings
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from benchmark_lib import safe_relative

SUPPORTED_SUFFIXES = {".csv", ".json", ".jsonl"}


def identity() -> dict[str, object]:
    return {
        "engine": "pandas",
        "pandasVersion": pd.__version__,
        "numpyVersion": np.__version__,
        "pandasImportPath": _redacted_import_path(Path(pd.__file__)),
        "numpyImportPath": _redacted_import_path(Path(np.__file__)),
        "memoryMetric": None,
        "memoryMetricReason": "Reliable native-allocation peak memory is unavailable without isolated OS measurement.",
    }


def load(corpus_root: Path, relative_path: str, *, chunksize: int | None = None) -> dict[str, object]:
    source = safe_relative(corpus_root, relative_path)
    if not source.is_file() or source.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise ValueError("input must be a supported governed dataset file")
    if chunksize is not None and (source.suffix.lower() != ".csv" or chunksize < 1 or chunksize > 1024):
        raise ValueError("chunksize is permitted only for CSV and must be between 1 and 1024")
    started = time.perf_counter_ns()
    captured: list[dict[str, str]] = []
    try:
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            frame = _read(source, chunksize)
        captured = [{"category": warning.category.__name__, "message": _sanitize(str(warning.message), corpus_root)} for warning in caught]
        records = [{str(key): normalize(value) for key, value in row.items()} for row in frame.to_dict(orient="records")]
        return {
            "classification": "SUCCESS",
            "exceptionType": None,
            "records": records,
            "recordCount": len(records),
            "inferredDtypes": {str(column): str(dtype) for column, dtype in frame.dtypes.items()},
            "warnings": captured,
            "chunksize": chunksize,
            "elapsedNanoseconds": time.perf_counter_ns() - started,
            "peakMemoryBytes": None,
        }
    except (ValueError, TypeError, UnicodeError, pd.errors.ParserError) as error:
        return {
            "classification": "MALFORMED_INPUT",
            "exceptionType": type(error).__name__,
            "records": [],
            "recordCount": 0,
            "inferredDtypes": {},
            "warnings": captured,
            "chunksize": chunksize,
            "elapsedNanoseconds": time.perf_counter_ns() - started,
            "peakMemoryBytes": None,
        }


def normalize(value: Any) -> object:
    if value is None or value is pd.NA or value is pd.NaT:
        return None
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (bool, int, str)):
        return value
    if pd.isna(value):
        return None
    raise TypeError(f"unsupported normalized scalar type: {type(value).__name__}")


def _read(source: Path, chunksize: int | None) -> pd.DataFrame:
    suffix = source.suffix.lower()
    if suffix == ".csv":
        options = {"encoding": "utf-8", "engine": "python", "keep_default_na": True, "on_bad_lines": "error"}
        if chunksize is None:
            return pd.read_csv(source, **options)
        return pd.concat(list(pd.read_csv(source, chunksize=chunksize, **options)), ignore_index=True)
    return pd.read_json(source, lines=suffix == ".jsonl", encoding="utf-8", orient=None)


def _redacted_import_path(path: Path) -> str:
    parts = [part.lower() for part in path.parts]
    if "site-packages" in parts:
        index = parts.index("site-packages")
        return "<user-site>/" + "/".join(path.parts[index + 1 :])
    return f"<python-install>/{path.name}"


def _sanitize(message: str, corpus_root: Path) -> str:
    return message.replace(str(corpus_root), "<corpus>").replace(str(Path.home()), "<user>")[:512]
