"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Comparative Document Corpus Generator
Introduction:
Adds deterministic, candidate-independent document fixtures to the governed corpus.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import hashlib
import json
import zipfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "corpus"


def _pdf(pages: list[list[str]], *, info: bool = False) -> bytes:
    objects: list[bytes] = []
    page_numbers: list[int] = []
    objects.extend([b"", b""])
    for lines in pages:
        commands = ["BT", "/F1 12 Tf", "50 790 Td"]
        for index, line in enumerate(lines):
            if index:
                commands.append("0 -24 Td")
            commands.append(f"<{line.encode('utf-16-be').hex().upper()}> Tj")
        commands.append("ET")
        stream = "\n".join(commands).encode("ascii")
        page_no = len(objects) + 1
        content_no = page_no + 1
        page_numbers.append(page_no)
        objects.extend([
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 99 0 R >> >> /Contents {content_no} 0 R >>".encode(),
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        ])
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[1] = f"<< /Type /Pages /Kids [{' '.join(f'{n} 0 R' for n in page_numbers)}] /Count {len(page_numbers)} >>".encode()
    while len(objects) < 98:
        objects.append(b"null")
    objects.append(b"<< /Type /Font /Subtype /Type0 /BaseFont /Arial /Encoding /Identity-H /DescendantFonts [100 0 R] >>")
    objects.append(b"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Arial /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> >>")
    if info:
        objects.append(b"<< /Title (Governed Metadata) /Author (Flaha Agri Tech) /Subject (Document benchmark) >>")
    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for number, value in enumerate(objects, 1):
        offsets.append(len(output)); output.extend(f"{number} 0 obj\n".encode() + value + b"\nendobj\n")
    xref = len(output); output.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]: output.extend(f"{offset:010d} 00000 n \n".encode())
    trailer = f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R" + (f" /Info {len(objects)} 0 R" if info else "") + f" >>\nstartxref\n{xref}\n%%EOF\n"
    output.extend(trailer.encode()); return bytes(output)


def _zip(parts: dict[str, str]) -> bytes:
    target = BytesIO()
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(parts):
            item = zipfile.ZipInfo(name, (2026, 7, 16, 0, 0, 0)); item.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(item, parts[name].encode("utf-8"))
    return target.getvalue()


def _docx(paragraphs: list[str], table: bool = False) -> bytes:
    rows = "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Crop</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Yield</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Wheat</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>12</w:t></w:r></w:p></w:tc></w:tr></w:tbl>" if table else ""
    body = "".join(f'<w:p><w:r><w:t xml:space="preserve">{text}</w:t></w:r></w:p>' for text in paragraphs) + rows
    return _zip({
        "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        "word/document.xml": f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body}<w:sectPr/></w:body></w:document>',
    })


def _pptx() -> bytes:
    return _zip({
        "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
        "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>',
        "ppt/presentation.xml": '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
        "ppt/_rels/presentation.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
        "ppt/slides/slide1.xml": '<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/><p:sp><p:nvSpPr/><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>First reading item</a:t></a:r></a:p><a:p><a:r><a:t>Second reading item</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    })


def main() -> None:
    pdfs = {
        "doc-multipage-en": ([['Multi-page English', 'Page one body'], ['Page two body']], ['Multi-page English', 'Page one body', 'Page two body'], ['MULTI_PAGE','TEXT_ACCURACY']),
        "doc-three-columns": ([['Column A1','Column B1','Column C1','Column A2','Column B2','Column C2']], ['Column A1','Column B1','Column C1'], ['LAYOUT','READING_ORDER']),
        "doc-repeated-header-footer": ([['Flaha Header','Page one','Page Footer'],['Flaha Header','Page two','Page Footer']], ['Flaha Header','Page one','Page two','Page Footer'], ['HEADERS_FOOTERS']),
        "doc-borderless-table": ([['Crop Yield','Wheat 12','Barley 9']], ['Crop','Yield','Wheat','12'], ['TABLE_STRUCTURE']),
        "doc-merged-table": ([['Region | Crop | Yield','North | Wheat | 12','North | Barley | 9']], ['Region','North','Wheat','Barley'], ['TABLE_STRUCTURE','MERGED_CELLS']),
        "doc-multipage-table": ([['Crop | Yield','Wheat | 12'],['Crop | Yield','Barley | 9']], ['Crop','Yield','Wheat','Barley'], ['TABLE_STRUCTURE','MULTI_PAGE']),
        "doc-metadata": ([['Metadata fixture']], ['Metadata fixture'], ['METADATA']),
        "doc-annotations": ([['Annotation inventory fixture']], ['Annotation inventory fixture'], ['ANNOTATIONS']),
        "doc-embedded-image": ([['Embedded image marker']], ['Embedded image marker'], ['EMBEDDED_IMAGE']),
        "doc-embedded-file": ([['Embedded file marker']], ['Embedded file marker'], ['EMBEDDED_ARTIFACTS']),
        "doc-hybrid": ([['Hybrid digital layer','Image region requires OCR']], ['Hybrid digital layer'], ['OCR_ASSESSMENT']),
        "doc-hidden-duplicate-layer": ([['Visible text','Visible text']], ['Visible text'], ['DUPLICATE_TEXT']),
    }
    additions=[]
    for item_id,(pages,required,dimensions) in pdfs.items():
        data=_pdf(pages, info=item_id=='doc-metadata'); additions.append((item_id,'en','pdf',f'documents/comparative/{item_id}.pdf',data,required,dimensions,None))
    additions.extend([
        ('doc-malformed','und','pdf','documents/comparative/malformed.pdf',_pdf([['Malformed bounded fixture']])[:-28],[],['MALFORMED_BEHAVIOR'],'MALFORMED_INPUT'),
        ('doc-image-only','und','pdf','documents/comparative/image-only.pdf',_pdf([[]]),[],['OCR_ASSESSMENT'],'OCR_REQUIRED'),
        ('doc-docx-headings','en','docx','documents/comparative/headings.docx',_docx(['1. Irrigation','Body paragraph','2. Soil']),['1. Irrigation','Body paragraph','2. Soil'],['HEADINGS','SECTIONS'],None),
        ('doc-docx-table','en','docx','documents/comparative/table.docx',_docx(['Governed table'],True),['Crop','Yield','Wheat','12'],['TABLE_STRUCTURE'],None),
        ('doc-docx-arabic','ar','docx','documents/comparative/arabic.docx',_docx(['الزراعة','تحسين كفاءة المياه']),['الزراعة','تحسين كفاءة المياه'],['ARABIC'],None),
        ('doc-pptx-reading-order','en','pptx','documents/comparative/reading-order.pptx',_pptx(),['First reading item','Second reading item'],['READING_ORDER'],None),
        ('doc-rtf','en','rtf','documents/comparative/simple.rtf',b'{\\rtf1\\ansi Governed RTF text.}', ['Governed RTF text.'],['TEXT_ACCURACY'],None),
        ('doc-plain-text','ar-en','txt','documents/comparative/simple.txt','Plain text benchmark.\nنص زراعي.\n'.encode(),['Plain text benchmark.','نص زراعي.'],['TEXT_ACCURACY','ARABIC'],None),
    ])
    try:
        from pypdf import PdfReader, PdfWriter
        encrypted = BytesIO(); writer = PdfWriter(clone_from=PdfReader(BytesIO(_pdf([['Encrypted fixture']])))); writer.encrypt('governed-password'); writer.write(encrypted)
        additions.append(('doc-encrypted','en','pdf','documents/comparative/encrypted.pdf',encrypted.getvalue(),[],['ENCRYPTED_HANDLING'],'ENCRYPTED_INPUT'))
    except ImportError as error:
        if not (CORPUS/'documents/comparative/encrypted.pdf').exists():
            raise RuntimeError('Run this generator in the locked pypdf benchmark environment to create the encrypted fixture.') from error
    manifest_path=CORPUS/'manifest.json'; manifest=json.loads(manifest_path.read_text(encoding='utf-8')); ids={x['id'] for x in manifest['items']}
    for item_id,language,fmt,relative,data,required,dimensions,error in additions:
        path=CORPUS/relative; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)
        expected_ref=f'expected/{item_id}.json'; expected={'requiredTextSpans':required,'expectedLanguage':language,'expectedErrorClassification':error,'reviewerNotes':'Candidate-independent, repository-owned ground truth.'}
        (CORPUS/expected_ref).write_text(json.dumps(expected,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
        entry={'id':item_id,'title':item_id.replace('-',' ').title(),'category':'DOCUMENT','language':language,'format':fmt,'sourceOwnership':'Flaha Agri Tech','synthetic':True,'sha256':hashlib.sha256(data).hexdigest(),'byteSize':len(data),'path':relative,'expectedOutputReference':expected_ref,'benchmarkDimensions':dimensions,'limitations':'Deterministic synthetic capability fixture; visual fidelity is intentionally bounded.','createdDate':'2026-07-16','lastModifiedDate':'2026-07-16'}
        if item_id in ids: manifest['items']=[entry if x['id']==item_id else x for x in manifest['items']]
        else: manifest['items'].append(entry)
    manifest['items'].sort(key=lambda x:x['id']); manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')


if __name__ == '__main__': main()
