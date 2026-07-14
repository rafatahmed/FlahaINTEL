"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Strict Streaming CSV Validator
Introduction:
Fail-closed pre-validates governed CSV streams before an engine may parse them.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CsvLimits:
    max_row_bytes: int = 1_048_576
    max_field_chars: int = 262_144
    max_columns: int = 512
    delimiter: str = ","


class CsvValidationError(ValueError):
    def __init__(self, code: str, line: int):
        super().__init__(code)
        self.code, self.line = code, line


def validate_csv(path: Path, limits: CsvLimits = CsvLimits()) -> dict[str, int]:
    try:
        raw = path.open("rb")
    except OSError as error:
        raise CsvValidationError("CSV_IO_ERROR", 0) from error
    rows = 0
    try:
        with raw:
            for number, binary in enumerate(raw, 1):
                if b"\0" in binary:
                    raise CsvValidationError("CSV_NUL_BYTE", number)
                if len(binary) > limits.max_row_bytes:
                    raise CsvValidationError("CSV_ROW_TOO_LONG", number)
                try:
                    text = binary.decode("utf-8-sig" if number == 1 else "utf-8")
                except UnicodeDecodeError as error:
                    raise CsvValidationError("CSV_INVALID_ENCODING", number) from error
                _validate_quote_placement(text, limits.delimiter, number)
                # A physical record must be complete: governed CSV forbids embedded newlines.
                try:
                    parsed = list(csv.reader([text], delimiter=limits.delimiter, strict=True))
                except csv.Error as error:
                    code = "CSV_UNTERMINATED_QUOTE" if text.count('"') % 2 else "CSV_MALFORMED_QUOTE"
                    raise CsvValidationError(code, number) from error
                if len(parsed) != 1:
                    raise CsvValidationError("CSV_UNEXPECTED_NEWLINE", number)
                fields = parsed[0]
                if any(token in text for token in ("\t", ";")) and len(fields) == 1:
                    raise CsvValidationError("CSV_DELIMITER_AMBIGUITY", number)
                if len(fields) > limits.max_columns:
                    raise CsvValidationError("CSV_TOO_MANY_COLUMNS", number)
                if any(len(field) > limits.max_field_chars for field in fields):
                    raise CsvValidationError("CSV_FIELD_TOO_LONG", number)
                if number == 1:
                    columns = len(fields)
                    if columns < 1:
                        raise CsvValidationError("CSV_EMPTY_HEADER", number)
                elif len(fields) != columns:
                    raise CsvValidationError("CSV_INCONSISTENT_FIELDS", number)
                rows += 1
    except CsvValidationError:
        raise
    return {"columns": columns, "dataRows": max(0, rows - 1)}


def _validate_quote_placement(text: str, delimiter: str, line: int) -> None:
    quoted, field_start, index = False, True, 0
    while index < len(text):
        char = text[index]
        if char == '"':
            if quoted and index + 1 < len(text) and text[index + 1] == '"':
                index += 2; field_start = False; continue
            if quoted:
                quoted = False
                following = text[index + 1:index + 2]
                if following not in {delimiter, "\r", "\n", ""}: raise CsvValidationError("CSV_MALFORMED_QUOTE", line)
            elif field_start: quoted = True
            else: raise CsvValidationError("CSV_MALFORMED_QUOTE", line)
        elif not quoted and char == delimiter: field_start = True; index += 1; continue
        elif char not in "\r\n": field_start = False
        index += 1
    if quoted: raise CsvValidationError("CSV_UNTERMINATED_QUOTE", line)
