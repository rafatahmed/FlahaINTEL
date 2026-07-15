"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed HTML Encoding Policy
Introduction:
Selects deterministic strict HTML decoding before candidate execution.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import codecs
import re
from dataclasses import dataclass

LEGACY = {"windows-1252", "iso-8859-1", "windows-1256", "iso-8859-6"}
ALIASES = {"cp1252": "windows-1252", "cp1256": "windows-1256", "latin-1": "iso-8859-1", "latin1": "iso-8859-1"}
META = re.compile(br"<meta\s+[^>]{0,1024}(?:charset\s*=\s*[\"']?\s*([A-Za-z0-9._-]+)|content\s*=\s*[\"'][^\"']{0,512}charset\s*=\s*([A-Za-z0-9._-]+))", re.I)


@dataclass(frozen=True)
class DecodedHtml:
    text: str
    encoding: str
    reason: str
    had_bom: bool


def decode_html(data: bytes, trusted_encoding: str | None = None) -> DecodedHtml:
    if data.startswith(codecs.BOM_UTF8):
        return DecodedHtml(data[len(codecs.BOM_UTF8):].decode("utf-8", "strict"), "utf-8", "UTF8_BOM", True)
    if trusted_encoding:
        encoding = _allowed(trusted_encoding)
        return DecodedHtml(data.decode(encoding, "strict"), encoding, "TRUSTED_ACQUISITION_EVIDENCE", False)
    match = META.search(data[:4096])
    if match:
        encoding = _allowed((match.group(1) or match.group(2)).decode("ascii", "strict"))
        return DecodedHtml(data.decode(encoding, "strict"), encoding, "BOUNDED_META_CHARSET", False)
    try:
        return DecodedHtml(data.decode("utf-8", "strict"), "utf-8", "STRICT_UTF8_DEFAULT", False)
    except UnicodeDecodeError as error:
        raise ValueError("UNDECODABLE_INPUT") from error


def _allowed(value: str) -> str:
    normalized = ALIASES.get(value.strip().lower(), value.strip().lower())
    if normalized == "utf-8":
        return normalized
    if normalized not in LEGACY:
        raise ValueError("UNAPPROVED_ENCODING")
    return normalized
