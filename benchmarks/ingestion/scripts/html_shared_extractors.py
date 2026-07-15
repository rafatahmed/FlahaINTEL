"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Candidate-Neutral HTML Extractors
Introduction:
Normalizes DOM observations into governed metadata, link, table, and text evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Iterable

from html_normalization import canonical_hash, normalize_text

EXCLUDED = {"script", "style", "template", "noscript"}
BOILERPLATE = {"nav", "footer", "aside"}
BLOCKS = {"article", "main", "section", "header", "div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "br", "title"}


@dataclass
class Node:
    tag: str
    attrs: list[tuple[str, str | None]] = field(default_factory=list)
    children: list["Node | str"] = field(default_factory=list)


class StdlibTree(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("#document")
        self.stack = [self.root]
        self.comments = 0
        self.max_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag.lower(), attrs)
        self.stack[-1].children.append(node)
        if tag.lower() not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append(node)
            self.max_depth = max(self.max_depth, len(self.stack) - 1)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.stack[-1].children.append(Node(tag.lower(), attrs))

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == lowered:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        self.stack[-1].children.append(data)

    def handle_comment(self, data: str) -> None:
        self.comments += 1


def parse_stdlib(text: str) -> tuple[Node, dict[str, int]]:
    parser = StdlibTree()
    parser.feed(text)
    parser.close()
    return parser.root, {"comments": parser.comments, "maxDepth": parser.max_depth}


def extract(root: Node, *, candidate: str, version: str, parser_evidence: dict[str, object], warnings: list[str] | None = None) -> dict[str, object]:
    warnings = list(warnings or [])
    nodes = list(walk(root))
    metadata: dict[str, object] = {}
    links: list[dict[str, object]] = []
    headings: list[dict[str, str]] = []
    structured: list[object] = []
    duplicate_attributes = 0
    for node in nodes:
        attrs, duplicates = attrs_map(node.attrs)
        duplicate_attributes += duplicates
        if node.tag == "title" and "title" not in metadata:
            metadata["title"] = visible_text(node)
        if node.tag == "meta":
            key = (attrs.get("name") or attrs.get("property") or "").lower()
            if key in {"author", "description", "article:published_time", "og:title", "og:description", "twitter:title", "twitter:description"} and attrs.get("content") is not None:
                metadata.setdefault(key, attrs["content"])
        if node.tag == "link" and (attrs.get("rel") or "").lower() == "canonical" and attrs.get("href"):
            metadata.setdefault("canonical", attrs["href"])
        if node.tag == "a" and attrs.get("href") is not None:
            href = attrs["href"] or ""
            scheme = href.split(":", 1)[0].lower() if ":" in href else None
            links.append({"href": href, "text": visible_text(node), "kind": "absolute-http" if scheme in {"http", "https"} else "unsafe-scheme" if scheme else "relative", "resolvedForm": None})
        if node.tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            headings.append({"level": node.tag, "text": visible_text(node)})
        if node.tag == "script" and (attrs.get("type") or "").lower() == "application/ld+json":
            raw = raw_text(node).strip()
            try:
                structured.append(json.loads(raw))
            except json.JSONDecodeError:
                warnings.append("INVALID_JSON_LD")
    tables = [table_value(node) for node in nodes if node.tag == "table"]
    content_roots = [node for node in nodes if node.tag in {"article", "main"}]
    content = normalize_text("\n".join(visible_text(node, boilerplate=True) for node in content_roots) if content_roots else visible_text(root, boilerplate=True))
    document_text = normalize_text(visible_text(root, boilerplate=False))
    output = {
        "candidate": candidate,
        "candidateVersion": version,
        "document": {"metadata": metadata, "text": document_text},
        "content": {"text": content, "headings": headings},
        "links": links,
        "tables": tables,
        "structuredData": structured,
        "domEvidence": {**parser_evidence, "nodeCount": len(nodes), "duplicateAttributeCount": duplicate_attributes},
        "evidence": {"retainedTree": True, "pythonObjectsRetainedDuringExtraction": True, "networkInputAccepted": False, "rawBytesModified": False},
        "warnings": sorted(set(warnings)),
    }
    output["canonicalOutputSha256"] = canonical_hash(output)
    return output


def walk(root: Node) -> Iterable[Node]:
    for child in root.children:
        if isinstance(child, Node):
            yield child
            yield from walk(child)


def attrs_map(attrs: list[tuple[str, str | None]]) -> tuple[dict[str, str | None], int]:
    result: dict[str, str | None] = {}
    duplicates = 0
    for key, value in attrs:
        key = key.lower()
        if key in result:
            duplicates += 1
        else:
            result[key] = value
    return result, duplicates


def raw_text(node: Node) -> str:
    return "".join(child if isinstance(child, str) else raw_text(child) for child in node.children)


def visible_text(node: Node, boilerplate: bool = False) -> str:
    attrs, _ = attrs_map(node.attrs)
    if node.tag in EXCLUDED or "hidden" in attrs or (attrs.get("aria-hidden") or "").lower() == "true":
        return ""
    if boilerplate and node.tag in BOILERPLATE:
        return ""
    values: list[str] = []
    for child in node.children:
        values.append(child if isinstance(child, str) else visible_text(child, boilerplate))
        if isinstance(child, Node) and child.tag in BLOCKS:
            values.append("\n")
    return normalize_text("".join(values))


def table_value(table: Node) -> dict[str, object]:
    rows: list[list[dict[str, object]]] = []
    for row in (node for node in walk(table) if node.tag == "tr"):
        cells = []
        for cell in (child for child in row.children if isinstance(child, Node) and child.tag in {"th", "td"}):
            attrs, _ = attrs_map(cell.attrs)
            cells.append({"text": visible_text(cell), "rowspan": int(attrs.get("rowspan") or 1), "colspan": int(attrs.get("colspan") or 1), "header": cell.tag == "th"})
        if cells:
            rows.append(cells)
    return {"rows": rows}
