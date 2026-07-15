"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: pdfminer.six Plain-Text Fast-Gate Adapter
Introduction:
Provides a closed, governed three-fixture text extraction gate for pdfminer.six.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path, PureWindowsPath

from pdfminer.high_level import extract_text

CORPUS_ROOT = Path(__file__).resolve().parents[1] / "corpus" / "documents"
ALLOWED_ARTIFACTS = {"ar-simple.pdf", "bilingual.pdf", "en-simple.pdf"}


class Candidate(str, Enum):
    PDFMINER_SIX = "PDFMINER_SIX"


class Mode(str, Enum):
    PLAIN_TEXT_FAST_GATE = "PLAIN_TEXT_FAST_GATE"


def extract(artifact_key: str, candidate: str, mode: str) -> str:
    if Candidate(candidate) is not Candidate.PDFMINER_SIX:
        raise ValueError("CANDIDATE_REJECTED")
    if Mode(mode) is not Mode.PLAIN_TEXT_FAST_GATE:
        raise ValueError("MODE_REJECTED")
    if not isinstance(artifact_key, str) or artifact_key not in ALLOWED_ARTIFACTS:
        raise ValueError("ARTIFACT_REJECTED")
    value = PureWindowsPath(artifact_key)
    if value.is_absolute() or value.drive or any(part in ("", ".", "..") for part in value.parts):
        raise ValueError("ARTIFACT_REJECTED")
    root = CORPUS_ROOT.resolve(strict=True)
    source = (root / artifact_key).resolve(strict=True)
    if root not in source.parents or source.is_symlink() or not source.is_file():
        raise ValueError("ARTIFACT_REJECTED")
    return extract_text(source).replace("\r\n", "\n").replace("\r", "\n").strip()
