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


def write_utf8_lf(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


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


def expanded_html() -> list[dict[str, object]]:
    deep = "<main>" + "".join(f"<div data-depth='{index}'>" for index in range(80)) + "Deep governed text" + "</div>" * 80 + "</main>"
    overlimit = "<main>" + "<div>" * 520 + "Bounded depth classification" + "</div>" * 520 + "</main>"
    long_attribute = "<article data-evidence='" + ("x" * 8192) + "'><h1>Long attribute</h1><p>Body remains bounded.</p></article>"
    values = [
        ("html-metadata-conflicts", "en", "html/metadata-conflicts.html", b"<html><head><title>First title</title><title>Second title</title><link rel='canonical' href='/first'><link rel='canonical' href='/second'><meta property='og:title' content='OG first'><meta property='og:title' content='OG second'><meta name='twitter:title' content='Twitter title'><meta name='author' content='Author One'><meta name='author' content='Author Two'></head><body><article><h1>Governed title</h1></article></body></html>", ["METADATA", "DUPLICATES"]),
        ("html-jsonld-multiple", "en", "html/jsonld-multiple.html", b"<article itemscope itemtype='https://schema.org/NewsArticle'><h1 itemprop='headline'>Structured story</h1><script type='application/ld+json'>{\"@type\":\"NewsArticle\",\"headline\":\"A\"}</script><script type='application/ld+json'>[{\"@type\":\"Person\",\"name\":\"B\"}]</script></article>", ["JSON_LD", "MICRODATA"]),
        ("html-jsonld-invalid", "en", "html/jsonld-invalid.html", b"<article><h1>Invalid structured data</h1><script type='application/ld+json'>{bad}</script></article>", ["JSON_LD", "MALFORMED_BEHAVIOR"]),
        ("html-table-spans", "en", "html/table-spans.html", b"<article><table><tr><th rowspan='2'>Crop</th><th colspan='2'>Yield</th></tr><tr><th>2025</th><th>2026</th></tr><tr><td>Wheat</td><td>9</td><td>12</td></tr></table></article>", ["TABLE_STRUCTURE"]),
        ("html-links-nested-table", "en", "html/links-nested-table.html", b"<article><a href='/relative'>Relative</a><a href='https://example.invalid/a'>HTTPS</a><a href='javascript:alert(1)'>Unsafe</a><table><tr><td><a href='mailto:test@example.invalid'>Mail</a></td><td><table><tr><td>Nested</td></tr></table></td></tr></table></article>", ["LINKS", "TABLE_STRUCTURE", "ADVERSARIAL"]),
        ("html-hidden-content", "en", "html/hidden-content.html", b"<body><nav>Navigation noise</nav><main><h1>Visible</h1><p>Body</p><div hidden>Hidden attribute</div><div aria-hidden='true'>ARIA hidden</div><script>secret()</script><style>.secret{}</style><template>template secret</template></main><footer>Footer noise</footer></body>", ["MAIN_CONTENT", "BOILERPLATE", "HIDDEN_CONTENT"]),
        ("html-comments-related", "en", "html/comments-related.html", b"<!-- comment --><header>Site header</header><main><article><h1>Primary report</h1><p>Primary body.</p></article><aside>Related noise</aside></main><footer>Site footer</footer>", ["MAIN_CONTENT", "BOILERPLATE", "COMMENTS"]),
        ("html-empty-body", "und", "html/empty-body.html", b"<!doctype html><html><head><title>Empty body</title></head><body></body></html>", ["EMPTY_BODY", "DOM"]),
        ("html-empty-elements", "en", "html/empty-elements.html", b"<main><h1>Empty elements</h1><form><input name='q'><button>Submit</button></form><img src='image.png' alt='Crop'><object data='file.bin'>Object fallback</object><embed src='file.bin'><iframe src='frame.html'></iframe><br><hr></main>", ["DOM", "EMBEDDED_REFERENCES"]),
        ("html-long-attribute", "en", "html/long-attribute.html", long_attribute.encode("utf-8"), ["BOUNDS", "ATTRIBUTES"]),
        ("html-deep-dom", "en", "html/deep-dom.html", deep.encode("utf-8"), ["BOUNDS", "DOM_DEPTH"]),
        ("html-overlimit-dom", "en", "html/overlimit-dom.html", overlimit.encode("utf-8"), ["BOUNDS", "DOM_DEPTH", "ADVERSARIAL"]),
        ("html-utf8-bom", "en", "html/encoding-utf8-bom.html", b"\xef\xbb\xbf<meta charset='utf-8'><article><h1>BOM</h1><p>Strict UTF-8.</p></article>", ["ENCODING"]),
        ("html-windows-1252", "en", "html/encoding-windows-1252.html", "<meta charset='windows-1252'><article><p>Café — irrigation</p></article>".encode("cp1252"), ["ENCODING", "LEGACY"]),
        ("html-iso-8859-1", "en", "html/encoding-iso-8859-1.html", "<meta charset='iso-8859-1'><article><p>Café irrigation</p></article>".encode("iso-8859-1"), ["ENCODING", "LEGACY"]),
        ("html-windows-1256", "ar", "html/encoding-windows-1256.html", "<meta charset='windows-1256'><article><p>الري الذكي</p></article>".encode("cp1256"), ["ENCODING", "LEGACY", "ARABIC"]),
        ("html-iso-8859-6", "ar", "html/encoding-iso-8859-6.html", "<meta charset='iso-8859-6'><article><p>الري</p></article>".encode("iso-8859-6"), ["ENCODING", "LEGACY", "ARABIC"]),
        ("html-conflicting-charsets", "en", "html/encoding-conflicting.html", b"<meta charset='utf-8'><meta charset='windows-1252'><article><p>First declaration wins.</p></article>", ["ENCODING", "CONFLICT"]),
        ("html-invalid-utf8", "und", "html/encoding-invalid-utf8.html", b"<article><p>invalid:\xff\xfe</p></article>", ["ENCODING", "MALFORMED_BEHAVIOR"]),
        ("html-unicode-whitespace", "ar-en", "html/unicode-whitespace.html", "<article><h1>Water\u00a0\u200fالمياه</h1><p>A\u0301\t B &amp; C</p></article>".encode("utf-8"), ["UNICODE", "NORMALIZATION", "BIDI"]),
        ("html-duplicate-attributes", "en", "html/duplicate-attributes.html", b"<article id='first' id='second'><h1 class='a' class='b'>Duplicate attributes</h1><svg viewBox='0 0 1 1'><text>SVG text</text></svg><math><mi>x</mi></math></article>", ["ATTRIBUTES", "SVG", "MATHML"]),
        ("html-realistic-english", "en", "html/realistic-english.html", b"<!doctype html><html><head><title>Irrigation outlook</title><meta name='author' content='Flaha Research'></head><body><header>Market</header><main><article><h1>Irrigation outlook</h1><p>Reservoir levels improved across the region.</p><h2>Operations</h2><p>Growers retained scheduled monitoring.</p></article><aside>Most read</aside></main></body></html>", ["REALISTIC", "MAIN_CONTENT", "HEADINGS"]),
        ("html-realistic-arabic", "ar", "html/realistic-arabic.html", "<!doctype html><html lang='ar' dir='rtl'><head><title>تقرير الري</title></head><body><main><article><h1>تقرير الري</h1><p>تحسنت كفاءة استخدام المياه.</p><h2>المتابعة</h2><p>تستمر مراقبة المحاصيل.</p></article></main></body></html>".encode("utf-8"), ["REALISTIC", "ARABIC", "RTL"]),
        ("html-realistic-bilingual", "ar-en", "html/realistic-bilingual.html", "<main><article><h1>Crop report | تقرير المحاصيل</h1><p dir='ltr'>Water efficiency improved.</p><p dir='rtl'>تحسنت كفاءة المياه.</p></article></main>".encode("utf-8"), ["REALISTIC", "BILINGUAL", "RTL_LTR"]),
    ]
    return [{"id": item_id, "language": language, "path": relative, "bytes": data, "dimensions": dimensions} for item_id, language, relative, data, dimensions in values]


def html_ground_truth(item_id: str, language: str) -> dict[str, object]:
    required = {
        "html-clean": ["Clean Article", "Efficient irrigation supports resilient crops."],
        "html-noisy": ["Harvest Report", "Wheat yield increased."],
        "html-nested": ["Nested Story", "Paragraph", "with emphasis", "."],
        "html-arabic": ["الري الذكي", "يحافظ على المياه."],
        "html-bilingual": ["Water المياه", "Efficient irrigation الري الفعال"],
        "html-malformed": ["Open heading", "Still parseable"],
        "html-metadata-hidden": ["Visible body."],
        "html-metadata-conflicts": ["Governed title"], "html-jsonld-multiple": ["Structured story"],
        "html-jsonld-invalid": ["Invalid structured data"], "html-table-spans": ["Crop", "Wheat", "12"],
        "html-links-nested-table": ["Relative", "HTTPS", "Nested"], "html-hidden-content": ["Visible", "Body"],
        "html-comments-related": ["Primary report", "Primary body."], "html-empty-body": [], "html-empty-elements": ["Empty elements", "Submit", "Object fallback"],
        "html-long-attribute": ["Long attribute", "Body remains bounded."], "html-deep-dom": ["Deep governed text"],
        "html-overlimit-dom": [], "html-utf8-bom": ["BOM", "Strict UTF-8."],
        "html-windows-1252": ["Café — irrigation"], "html-iso-8859-1": ["Café irrigation"],
        "html-windows-1256": ["الري الذكي"], "html-iso-8859-6": ["الري"],
        "html-conflicting-charsets": ["First declaration wins."], "html-invalid-utf8": [],
        "html-unicode-whitespace": ["Water ‏المياه", "Á B & C"], "html-duplicate-attributes": ["Duplicate attributes", "SVG text", "x"],
        "html-realistic-english": ["Irrigation outlook", "Reservoir levels improved across the region.", "Growers retained scheduled monitoring."],
        "html-realistic-arabic": ["تقرير الري", "تحسنت كفاءة استخدام المياه.", "تستمر مراقبة المحاصيل."],
        "html-realistic-bilingual": ["Crop report | تقرير المحاصيل", "Water efficiency improved.", "تحسنت كفاءة المياه."],
    }[item_id]
    prohibited = {
        "html-noisy": ["Menu Noise", "Footer Noise", "alert('noise')"],
        "html-metadata-hidden": ["Hidden body.", "secret"],
        "html-hidden-content": ["Navigation noise", "Hidden attribute", "ARIA hidden", "secret", "Footer noise"],
        "html-comments-related": ["Related noise", "Site footer"],
    }.get(item_id, ["script/style/template executable content"])
    title = {"html-clean": "Clean Article", "html-noisy": "Noisy Article", "html-arabic": "مقال زراعي", "html-malformed": "Malformed", "html-metadata-hidden": "Metadata Story", "html-realistic-english": "Irrigation outlook", "html-realistic-arabic": "تقرير الري", "html-metadata-conflicts": "First title"}.get(item_id)
    return {
        "requiredTextSpans": required,
        "prohibitedBoilerplate": prohibited,
        "acceptableOmissions": ["Form controls, embedded-object fallback text, SVG/MathML text, and boilerplate may be omitted when documented."],
        "titleExpectation": title,
        "authorExpectation": "Rafat" if item_id == "html-clean" else "Synthetic Author" if item_id == "html-metadata-hidden" else "Flaha Research" if item_id == "html-realistic-english" else None,
        "dateExpectation": "2026-07-15T00:00:00Z" if item_id == "html-metadata-hidden" else None,
        "paragraphOrder": required,
        "arabicPreservationRequired": language in {"ar", "ar-en"},
        "reviewerNotes": "Human-authored repository-owned expectation; candidate output is not used as ground truth."
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


def generate(corpus_root: Path = CORPUS) -> None:
    entries = []
    for item_id, title, category, language, fmt, relative, lines, dimensions in ITEMS:
        path = corpus_root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(pdf_bytes(lines))
        expected = {"expectedPlainText": "\n".join(lines), "expectedNormalizedText": "\n".join(lines), "expectedLanguage": language,
                    "expectedHeadings": [lines[0]], "expectedTableCells": lines if item_id == "doc-table" else [], "expectedErrorClassification": None}
        entries.append(entry(corpus_root, item_id, title, category, language, fmt, relative, expected, dimensions, "Dependency-free synthetic PDF; visual fidelity is limited."))
    for item_id, (language, relative, content, expected_text) in HTML.items():
        path = corpus_root / relative; write_utf8_lf(path, content)
        expected = {"expectedPlainText": expected_text, "expectedNormalizedText": expected_text, "expectedLanguage": language,
                    "expectedMetadata": {}, "expectedErrorClassification": None, "groundTruth": html_ground_truth(item_id, language)}
        entries.append(entry(corpus_root, item_id, item_id.replace("-", " ").title(), "HTML", language, "html", relative, expected,
                             ["MAIN_CONTENT", "BOILERPLATE", "UNICODE"], "Synthetic HTML parser fixture."))
    for spec in expanded_html():
        path = corpus_root / str(spec["path"])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(spec["bytes"])
        expected = {
            "expectedLanguage": spec["language"],
            "expectedErrorClassification": "UNDECODABLE_INPUT" if spec["id"] == "html-invalid-utf8" else None,
            "groundTruth": html_ground_truth(str(spec["id"]), str(spec["language"]))
        }
        entries.append(entry(corpus_root, str(spec["id"]), str(spec["id"]).replace("-", " ").title(), "HTML", str(spec["language"]), "html", str(spec["path"]), expected,
                             list(spec["dimensions"]), "Synthetic governed HTML edge-case fixture; no network acquisition."))
    for item_id, (language, relative, content, count, error) in DATASETS.items():
        path = corpus_root / relative; write_utf8_lf(path, content)
        expected = {"expectedRecordCount": count, "expectedLanguage": language, "expectedErrorClassification": error}
        entries.append(entry(corpus_root, item_id, item_id.replace("-", " ").title(), "DATASET", language, Path(relative).suffix[1:], relative, expected,
                             ["ROW_COUNT", "UNICODE", "MALFORMED_BEHAVIOR", "DETERMINISM"], "Synthetic bounded dataset."))
    write_utf8_lf(corpus_root / "manifest.json", json.dumps({"manifestVersion": "1.0.0", "items": entries}, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")


def entry(corpus_root: Path, item_id: str, title: str, category: str, language: str, fmt: str, relative: str, expected: dict, dimensions: list[str], limitations: str) -> dict:
    expected_relative = f"expected/{item_id}.json"
    expected_path = corpus_root / expected_relative
    write_utf8_lf(expected_path, json.dumps(expected, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    data = (corpus_root / relative).read_bytes()
    return {"id": item_id, "title": title, "category": category, "language": language, "format": fmt,
            "sourceOwnership": "Flaha Agri Tech", "synthetic": True, "sha256": hashlib.sha256(data).hexdigest(), "byteSize": len(data),
            "path": relative, "expectedOutputReference": expected_relative, "benchmarkDimensions": dimensions, "limitations": limitations,
            "createdDate": "2026-07-15", "lastModifiedDate": "2026-07-15"}


if __name__ == "__main__":
    generate()
