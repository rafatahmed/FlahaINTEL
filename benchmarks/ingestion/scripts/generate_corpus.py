"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Synthetic Corpus Generator
Introduction:
Generates deterministic repository-owned benchmark inputs and expected outputs.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "corpus"


def pdf_bytes(lines: list[str]) -> bytes:
    safe_lines = [line.encode("utf-16-be").hex().upper() for line in lines]
    commands = ["BT", "/F1 12 Tf", "50 790 Td"]
    for index, encoded in enumerate(safe_lines):
        if index:
            commands.append("0 -24 Td")
        commands.append(f"<{encoded}> Tj")
    commands.append("ET")
    stream = "\n".join(commands).encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type0 /BaseFont /Arial /Encoding /Identity-H /DescendantFonts [6 0 R] >>",
        b"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Arial /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> >>",
    ]
    output = bytearray(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
    offsets = [0]
    for number, value in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{number} 0 obj\n".encode("ascii") + value + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode("ascii"))
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.extend(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    return bytes(output)


ITEMS = [
    ("doc-en-simple", "Simple English digital document", "DOCUMENT", "en", "pdf", "documents/en-simple.pdf", ["English Benchmark", "Water efficiency improves crop resilience."], ["TEXT_ACCURACY", "HEADINGS"]),
    ("doc-ar-simple", "Simple Arabic digital document", "DOCUMENT", "ar", "pdf", "documents/ar-simple.pdf", ["اختبار عربي", "تحسين كفاءة المياه يدعم الزراعة."], ["ARABIC", "TEXT_ACCURACY"]),
    ("doc-bilingual", "Bilingual Arabic English document", "DOCUMENT", "ar-en", "pdf", "documents/bilingual.pdf", ["Agriculture الزراعة", "Water المياه"], ["BILINGUAL", "READING_ORDER"]),
    ("doc-columns", "Synthetic multi-column layout", "DOCUMENT", "en", "pdf", "documents/multi-column.pdf", ["Left column A", "Right column B", "Left column C", "Right column D"], ["READING_ORDER", "LAYOUT"]),
    ("doc-table", "Synthetic table document", "DOCUMENT", "en", "pdf", "documents/table.pdf", ["Crop | Yield", "Wheat | 12", "Barley | 9"], ["TABLE_STRUCTURE"]),
    ("doc-structure", "Headings paragraphs headers and footers", "DOCUMENT", "en", "pdf", "documents/structure.pdf", ["Flaha Header", "1. Irrigation", "First paragraph.", "2. Soil", "Second paragraph.", "Page 1 Footer"], ["HEADINGS", "PARAGRAPHS", "HEADERS_FOOTERS"]),
    ("ocr-scan-placeholder", "Synthetic scan placeholder", "OCR", "ar-en", "pdf", "ocr/synthetic-scan-placeholder.pdf", ["SYNTHETIC SCAN PLACEHOLDER", "English Arabic OCR benchmark"], ["OCR", "BILINGUAL"]),
]

HTML = {
    "html-clean": ("en", "html/clean-article.html", "<!doctype html><html><head><title>Clean Article</title><meta name=author content='Rafat'></head><body><article><h1>Clean Article</h1><p>Efficient irrigation supports resilient crops.</p></article></body></html>", "Clean Article\nEfficient irrigation supports resilient crops."),
    "html-noisy": ("en", "html/noisy-article.html", "<html><head><title>Noisy Article</title><style>.x{}</style></head><body><nav>Menu Noise</nav><article><h1>Harvest Report</h1><p>Wheat yield increased.</p></article><footer>Footer Noise</footer><script>alert('noise')</script></body></html>", "Harvest Report\nWheat yield increased."),
    "html-nested": ("en", "html/nested-elements.html", "<main><article><header><h1>Nested Story</h1></header><section><p>Paragraph <strong>with emphasis</strong>.</p></section></article></main>", "Nested Story\nParagraph\nwith emphasis\n."),
    "html-arabic": ("ar", "html/arabic-article.html", "<html lang='ar' dir='rtl'><head><title>مقال زراعي</title></head><body><article><h1>الري الذكي</h1><p>يحافظ على المياه.</p></article></body></html>", "الري الذكي\nيحافظ على المياه."),
    "html-bilingual": ("ar-en", "html/bilingual-article.html", "<article><h1>Water المياه</h1><p>Efficient irrigation الري الفعال</p></article>", "Water المياه\nEfficient irrigation الري الفعال"),
    "html-malformed": ("en", "html/malformed-article.html", "<html><head><title>Malformed</title></head><body><article><h1>Open heading<p>Still parseable<script>hidden", "Open heading\nStill parseable"),
    "html-metadata-hidden": ("en", "html/metadata-hidden.html", "<html><head><title>Metadata Story</title><meta name='author' content='Synthetic Author'><meta property='article:published_time' content='2026-07-15T00:00:00Z'></head><body><article><p>Visible body.</p><div hidden>Hidden body.</div><style>secret</style><script>secret</script></article></body></html>", "Visible body."),
}

DATASETS = {
    "dataset-csv": ("en", "datasets/records.csv", "id,name,value\n1,Wheat,12\n2,Barley,\n3,Rice,8\n", 3, None),
    "dataset-json": ("ar-en", "datasets/records.json", json.dumps([{"id": 1, "name": "قمح", "value": 12}, {"id": 2, "name": "Wheat", "value": None}, {"id": 2, "name": "Wheat", "value": None}], ensure_ascii=False, separators=(",", ":")) + "\n", 3, None),
    "dataset-jsonl": ("ar-en", "datasets/records.jsonl", "{\"id\":1,\"name\":\"قمح\"}\n{\"id\":2,\"name\":\"Barley\"}\n", 2, None),
    "dataset-malformed-csv": ("en", "datasets/malformed.csv", "id,name\n1,Wheat,EXTRA\n", 0, "MALFORMED_INPUT"),
    "dataset-malformed-json": ("und", "datasets/malformed.json", "[{\"id\":1},]\n", 0, "MALFORMED_INPUT"),
    "dataset-malformed-jsonl": ("und", "datasets/malformed.jsonl", "{\"id\":1}\n{bad}\n", 0, "MALFORMED_INPUT"),
    "dataset-streaming": ("ar-en", "datasets/streaming.csv", "id,name,value\n" + "".join(f"{i},{'قمح' if i % 2 else 'Wheat'},{i % 17}\n" for i in range(1, 257)), 256, None),
}


def main() -> None:
    entries = []
    for item_id, title, category, language, fmt, relative, lines, dimensions in ITEMS:
        path = CORPUS / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(pdf_bytes(lines))
        expected = {"expectedPlainText": "\n".join(lines), "expectedNormalizedText": "\n".join(lines), "expectedLanguage": language,
                    "expectedHeadings": [lines[0]], "expectedTableCells": lines if item_id == "doc-table" else [], "expectedErrorClassification": None}
        entries.append(entry(item_id, title, category, language, fmt, relative, expected, dimensions, "Dependency-free synthetic PDF; visual fidelity is limited."))
    for item_id, (language, relative, content, expected_text) in HTML.items():
        path = CORPUS / relative; path.parent.mkdir(parents=True, exist_ok=True); path.write_text(content, encoding="utf-8")
        expected = {"expectedPlainText": expected_text, "expectedNormalizedText": expected_text, "expectedLanguage": language,
                    "expectedMetadata": {}, "expectedErrorClassification": None}
        entries.append(entry(item_id, item_id.replace("-", " ").title(), "HTML", language, "html", relative, expected,
                             ["MAIN_CONTENT", "BOILERPLATE", "UNICODE"], "Synthetic HTML parser fixture."))
    for item_id, (language, relative, content, count, error) in DATASETS.items():
        path = CORPUS / relative; path.parent.mkdir(parents=True, exist_ok=True); path.write_text(content, encoding="utf-8", newline="")
        expected = {"expectedRecordCount": count, "expectedLanguage": language, "expectedErrorClassification": error}
        entries.append(entry(item_id, item_id.replace("-", " ").title(), "DATASET", language, Path(relative).suffix[1:], relative, expected,
                             ["ROW_COUNT", "UNICODE", "MALFORMED_BEHAVIOR", "DETERMINISM"], "Synthetic bounded dataset."))
    (CORPUS / "manifest.json").write_text(json.dumps({"manifestVersion": "1.0.0", "items": entries}, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")


def entry(item_id: str, title: str, category: str, language: str, fmt: str, relative: str, expected: dict, dimensions: list[str], limitations: str) -> dict:
    expected_relative = f"expected/{item_id}.json"
    expected_path = CORPUS / expected_relative
    expected_path.parent.mkdir(parents=True, exist_ok=True)
    expected_path.write_text(json.dumps(expected, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    data = (CORPUS / relative).read_bytes()
    return {"id": item_id, "title": title, "category": category, "language": language, "format": fmt,
            "sourceOwnership": "Flaha Agri Tech", "synthetic": True, "sha256": hashlib.sha256(data).hexdigest(), "byteSize": len(data),
            "path": relative, "expectedOutputReference": expected_relative, "benchmarkDimensions": dimensions, "limitations": limitations,
            "createdDate": "2026-07-15", "lastModifiedDate": "2026-07-15"}


if __name__ == "__main__":
    main()
