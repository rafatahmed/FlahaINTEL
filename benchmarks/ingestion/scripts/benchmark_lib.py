"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Benchmark Framework Library
Introduction:
Provides safe paths, hashing, extraction, dataset loading, and result utilities.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
from html.parser import HTMLParser
from pathlib import Path

RUN_ID = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
ALLOWED_CATEGORIES = {"DOCUMENT", "HTML", "OCR", "DATASET"}
ALLOWED_LANGUAGES = {"en", "ar", "ar-en", "und"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(65536), b""):
            digest.update(block)
    return digest.hexdigest()


def safe_relative(root: Path, value: str) -> Path:
    if not value or "\\" in value or ":" in value or value.startswith(("/", "//")):
        raise ValueError("path must be a relative POSIX path")
    parts = value.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise ValueError("path contains an unsafe component")
    candidate = (root / Path(*parts)).resolve()
    base = root.resolve()
    if candidate != base and base not in candidate.parents:
        raise ValueError("path escapes its root")
    return candidate


def validate_run_id(run_id: str) -> None:
    if not RUN_ID.fullmatch(run_id):
        raise ValueError("invalid benchmark run ID")


class ArticleExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._excluded = 0
        self._article_depth = 0
        self._all: list[str] = []
        self._article: list[str] = []
        self.title = ""
        self._in_title = False
        self.metadata: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag in {"script", "style", "nav", "footer", "noscript"} or "hidden" in values or values.get("aria-hidden") == "true":
            self._excluded += 1
        if tag == "article":
            self._article_depth += 1
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            key = values.get("name") or values.get("property")
            content = values.get("content")
            if key and content and key.lower() in {"author", "date", "article:published_time", "og:title"}:
                self.metadata[key.lower()] = content

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "nav", "footer", "noscript"} and self._excluded:
            self._excluded -= 1
        if tag == "article" and self._article_depth:
            self._article_depth -= 1
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._excluded:
            return
        text = " ".join(data.split())
        if not text:
            return
        if self._in_title:
            self.title = f"{self.title} {text}".strip()
        self._all.append(text)
        if self._article_depth:
            self._article.append(text)

    def result(self) -> dict[str, object]:
        selected = self._article or self._all
        return {"title": self.title, "text": "\n".join(selected), "metadata": dict(sorted(self.metadata.items()))}


def extract_html(path: Path) -> dict[str, object]:
    parser = ArticleExtractor()
    parser.feed(path.read_text(encoding="utf-8", errors="strict"))
    parser.close()
    return parser.result()


def load_dataset(path: Path) -> dict[str, object]:
    suffix = path.suffix.lower()
    records: list[object] = []
    try:
        if suffix == ".csv":
            with path.open("r", encoding="utf-8", newline="") as stream:
                reader = csv.DictReader(stream)
                fields = reader.fieldnames or []
                for line, row in enumerate(reader, start=2):
                    if None in row or any(key not in fields for key in row):
                        raise ValueError(f"malformed CSV row {line}")
                    records.append(row)
        elif suffix == ".json":
            value = json.loads(path.read_text(encoding="utf-8"))
            records = value if isinstance(value, list) else [value]
        elif suffix == ".jsonl":
            for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError as error:
                    raise ValueError(f"malformed JSONL line {line_number}") from error
        else:
            raise ValueError("unsupported dataset format")
    except (csv.Error, json.JSONDecodeError, UnicodeError, ValueError) as error:
        return {"classification": "MALFORMED_INPUT", "error": str(error), "recordCount": 0, "records": []}
    normalized = json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return {"classification": "SUCCESS", "error": None, "recordCount": len(records), "records": records,
            "normalizedSha256": hashlib.sha256(normalized.encode("utf-8")).hexdigest()}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    os.replace(temporary, path)
