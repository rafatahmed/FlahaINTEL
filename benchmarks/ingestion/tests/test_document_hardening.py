"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3E-H Document Hardening Tests
Introduction:
Verifies hostile-signal quarantine and bounded one-shot Tika termination.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations
import sys,tempfile,unittest,zipfile
from pathlib import Path
from uuid import uuid4
SCRIPTS=Path(__file__).resolve().parents[1]/'scripts';sys.path.insert(0,str(SCRIPTS))
from document_security_policy import inspect
from document_tika_supervisor import extract

class HardeningTests(unittest.TestCase):
 def fixture(self,suffix: str,data: bytes)->Path:
  parent=Path(__file__).resolve().parents[1]/'generated-corpus';parent.mkdir(exist_ok=True)
  root=parent/uuid4().hex;root.mkdir();path=root/f'fixture{suffix}';path.write_bytes(data);self.addCleanup(lambda:__import__('shutil').rmtree(root,ignore_errors=True));return path
 def test_pdf_actions_and_embedded_content_are_quarantined(self):
  for marker,label in [(b'/JavaScript','JAVASCRIPT_ACTION'),(b'/Launch','LAUNCH_ACTION'),(b'/URI','URI_ACTION'),(b'/EmbeddedFile','EMBEDDED_FILE')]:
   value=inspect(self.fixture('.pdf',b'%PDF-1.4\n'+marker+b'\n%%EOF'));self.assertEqual(value['classification'],'QUARANTINED');self.assertIn(label,value['signals'])
 def test_size_page_malformed_encrypted_and_language_policy(self):
  cases=[(b'%PDF-1.4\n/MediaBox [0 0 99999 99999]\n%%EOF','OVERSIZED_PAGE'),(b'%PDF-1.4\n'+b'/Type /Page\n'*51+b'%%EOF','PAGE_LIMIT_EXCEEDED'),(b'%PDF-1.4\n/Encrypt\n%%EOF','ENCRYPTED_DOCUMENT'),(b'%PDF-1.4\ntruncated','MALFORMED_DOCUMENT')]
  for data,label in cases:self.assertIn(label,inspect(self.fixture('.pdf',data))['signals'])
  self.assertEqual(inspect(self.fixture('.pdf',b'%PDF-1.4\n%%EOF'),language='ar')['classification'],'UNSUPPORTED_LANGUAGE_EXTRACTION')
 def test_malformed_and_recursive_ooxml_are_quarantined(self):
  self.assertIn('MALFORMED_DOCUMENT',inspect(self.fixture('.docx',b'not zip'))['signals'])
  path=self.fixture('.docx',b'');
  with zipfile.ZipFile(path,'w') as archive:archive.writestr('/'.join(['nested']*14)+'/x.xml','x')
  self.assertIn('ARCHIVE_RECURSION_LIMIT',inspect(path)['signals'])
 def test_tika_output_and_timeout_are_bounded(self):
  source=Path(__file__).resolve().parents[1]/'corpus/documents/comparative/simple.txt'
  limited=extract(source,maximum_output=1);self.assertEqual(limited['classification'],'OUTPUT_LIMIT');self.assertLessEqual(len(limited['text'].encode()),1)
  timed=extract(source,timeout_seconds=0);self.assertEqual(timed['classification'],'TIMEOUT')

if __name__=='__main__':unittest.main()
