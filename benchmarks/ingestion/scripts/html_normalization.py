"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: HTML Benchmark Normalization
Introduction:
Creates candidate-neutral Unicode-normalized comparison values and hashes.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFC", value.replace("\r\n", "\n").replace("\r", "\n").replace("\xa0", " "))
    lines = [re.sub(r"[\t\v\f ]+", " ", line).strip() for line in value.split("\n")]
    return "\n".join(line for line in lines if line)


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def canonical_hash(value: object) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()
