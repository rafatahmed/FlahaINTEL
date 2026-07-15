"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: lxml HTML Benchmark Adapter
Introduction:
Exercises only the governed no-network lxml HTML parser surface.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from html_artifact_policy import governed_html
from html_encoding_policy import decode_html
from html_shared_extractors import Node, extract
import lxml
from lxml import etree, html


def load(root: Path, artifact_key: str, trusted_encoding: str | None = None, *, recovery: bool = True) -> dict[str, object]:
    started = time.perf_counter_ns()
    _, raw = governed_html(root, artifact_key)
    read_finished = time.perf_counter_ns()
    decoded = decode_html(raw, trusted_encoding)
    decode_finished = time.perf_counter_ns()
    parser = html.HTMLParser(encoding="utf-8", no_network=True, recover=recovery, huge_tree=False, remove_comments=False)
    try:
        document = html.document_fromstring(decoded.text.encode("utf-8"), parser=parser)
    except (etree.ParserError, etree.XMLSyntaxError) as error:
        return {"candidate": "lxml", "candidateVersion": lxml.__version__, "classification": "MALFORMED_INPUT", "errorCode": type(error).__name__}
    parse_finished = time.perf_counter_ns()
    count, depth = 0, 0

    def convert(element, level: int = 1) -> Node:
        nonlocal count, depth
        count += 1
        depth = max(depth, level)
        if count > 100_000 or depth > 512:
            raise ValueError("DOM_LIMIT_EXCEEDED")
        node = Node(str(element.tag).lower() if isinstance(element.tag, str) else "#comment", list(element.attrib.items()))
        if element.text:
            node.children.append(element.text)
        for child in element:
            if isinstance(child.tag, str):
                node.children.append(convert(child, level + 1))
            if child.tail:
                node.children.append(child.tail)
        return node

    tree = Node("#document", children=[convert(document)])
    warnings = ["PARSER_RECOVERY_USED"] if parser.error_log else []
    result = extract(tree, candidate="lxml", version=lxml.__version__, parser_evidence={"api": "lxml.html.HTMLParser", "noNetwork": True, "recovery": recovery, "parserErrors": len(parser.error_log), "maxDepth": depth}, warnings=warnings)
    extraction_finished = time.perf_counter_ns()
    result["encoding"] = {"selected": decoded.encoding, "reason": decoded.reason, "hadBom": decoded.had_bom}
    result["mode"] = "DOM_AND_VISIBLE_TEXT_WITH_SHARED_EXTRACTORS"
    result["phaseTimingsNs"] = {"artifactRead": read_finished - started, "decode": decode_finished - read_finished, "parse": parse_finished - decode_finished, "extractNormalizeHash": extraction_finished - parse_finished, "totalAdapter": extraction_finished - started}
    result["normalizedOutputByteCount"] = len(json.dumps({key: result[key] for key in ("document", "content", "links", "tables", "structuredData", "domEvidence", "evidence")}, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus-root", type=Path, required=True)
    parser.add_argument("--artifact-key", required=True)
    parser.add_argument("--trusted-encoding")
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--summary-only", action="store_true")
    args = parser.parse_args()
    value = load(args.corpus_root, args.artifact_key, args.trusted_encoding, recovery=not args.strict)
    if args.summary_only and value.get("classification") != "MALFORMED_INPUT":
        value = {"candidate": value["candidate"], "canonicalOutputSha256": value["canonicalOutputSha256"], "domEvidence": value["domEvidence"], "warnings": value["warnings"]}
    sys.stdout.buffer.write((json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8"))
