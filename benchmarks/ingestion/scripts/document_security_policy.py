"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed Document Security Policy
Introduction:
Classifies bounded hostile document signals before any candidate parser runs.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import zipfile
from pathlib import Path

MAX_BYTES=1_048_576
MAX_PAGES=50
MAX_PAGE_POINTS=14_400
MAX_ARCHIVE_ENTRIES=256
MAX_ARCHIVE_UNCOMPRESSED=8_388_608
ACTION_MARKERS={b'/JavaScript':'JAVASCRIPT_ACTION',b'/JS':'JAVASCRIPT_ACTION',b'/Launch':'LAUNCH_ACTION',b'/URI':'URI_ACTION'}


def inspect(path:Path,language:str='en')->dict[str,object]:
    data=path.read_bytes();signals=[]
    if language in {'ar','ar-en'}: return {'classification':'UNSUPPORTED_LANGUAGE_EXTRACTION','review':'REQUIRES_ANALYST_REVIEW','signals':['UNSUPPORTED_LANGUAGE']}
    if len(data)>MAX_BYTES: signals.append('OVERSIZED_DOCUMENT')
    suffix=path.suffix.lower()
    if suffix=='.pdf':
        pages=data.count(b'/Type /Page')-data.count(b'/Type /Pages')
        if pages>MAX_PAGES: signals.append('PAGE_LIMIT_EXCEEDED')
        if b'/MediaBox [0 0 99999 99999]' in data: signals.append('OVERSIZED_PAGE')
        if b'/EmbeddedFile' in data: signals.append('EMBEDDED_FILE')
        if b'/Encrypt' in data: signals.append('ENCRYPTED_DOCUMENT')
        for marker,label in ACTION_MARKERS.items():
            if marker in data: signals.append(label)
        if not data.startswith(b'%PDF-') or b'%%EOF' not in data[-1024:]: signals.append('MALFORMED_DOCUMENT')
    elif suffix in {'.docx','.pptx'}:
        try:
            with zipfile.ZipFile(path) as archive:
                infos=archive.infolist();total=sum(x.file_size for x in infos)
                if len(infos)>MAX_ARCHIVE_ENTRIES or total>MAX_ARCHIVE_UNCOMPRESSED: signals.append('ARCHIVE_LIMIT_EXCEEDED')
                if any(name.count('/')>12 for name in archive.namelist()): signals.append('ARCHIVE_RECURSION_LIMIT')
        except (OSError,zipfile.BadZipFile): signals.append('MALFORMED_DOCUMENT')
    dangerous={'JAVASCRIPT_ACTION','LAUNCH_ACTION','URI_ACTION','EMBEDDED_FILE','ENCRYPTED_DOCUMENT','MALFORMED_DOCUMENT','OVERSIZED_DOCUMENT','OVERSIZED_PAGE','PAGE_LIMIT_EXCEEDED','ARCHIVE_LIMIT_EXCEEDED','ARCHIVE_RECURSION_LIMIT'}
    return {'classification':'QUARANTINED' if dangerous.intersection(signals) else 'APPROVED_FOR_BOUNDED_PARSE','review':'REQUIRES_ANALYST_REVIEW' if signals else None,'signals':sorted(set(signals))}
