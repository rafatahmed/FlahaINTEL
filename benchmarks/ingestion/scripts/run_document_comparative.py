"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3E-H Comparative Document Runner
Introduction:
Produces canonical capability-aware Docling and Tika evidence for one formal run.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations
import argparse,hashlib,json,time
from pathlib import Path
from benchmark_lib import validate_run_id
from document_docling_adapter import convert
from document_security_policy import inspect
from document_tika_supervisor import extract
ROOT=Path(__file__).resolve().parents[3];CORPUS=ROOT/'benchmarks/ingestion/corpus'
DOCLING=['documents/en-simple.pdf','documents/multi-column.pdf','documents/table.pdf','documents/structure.pdf','documents/comparative/doc-multipage-en.pdf']
TIKA=['documents/en-simple.pdf','documents/comparative/headings.docx','documents/comparative/table.docx','documents/comparative/reading-order.pptx','documents/comparative/simple.rtf','documents/comparative/simple.txt']
UNSUPPORTED=['documents/ar-simple.pdf','documents/bilingual.pdf','documents/comparative/arabic.docx']

def canonical(value:dict[str,object])->str:
 text=' '.join(str(value.get('text','')).split());payload=json.dumps({'classification':value['classification'],'text':text},ensure_ascii=False,sort_keys=True,separators=(',',':')).encode();return hashlib.sha256(payload).hexdigest()
def run(run_id:str)->dict[str,object]:
 validate_run_id(run_id);started=time.perf_counter_ns();rows=[]
 for relative in DOCLING:
  value=convert(CORPUS/relative);rows.append({'candidate':'docling-slim','fixture':relative,'classification':value['classification'],'canonicalSha256':canonical(value),'elapsedNanoseconds':value['elapsedNanoseconds'],'outputBytes':len(str(value['text']).encode())})
 for relative in TIKA:
  value=extract(CORPUS/relative);rows.append({'candidate':'apache-tika','fixture':relative,'classification':value['classification'],'canonicalSha256':canonical(value),'outputBytes':value['outputBytes'],'privateTempCleaned':value['privateTempCleaned']})
 for relative in UNSUPPORTED:
  value=inspect(CORPUS/relative,language='ar-en');rows.append({'candidate':'governed-language-policy','fixture':relative,'classification':value['classification'],'canonicalSha256':canonical({'classification':value['classification'],'text':''})})
 rows.extend([{'candidate':'pypdf','fixture':'existing-rejection-evidence','classification':'REJECT','canonicalSha256':canonical({'classification':'REJECT','text':'Arabic logical order reversed'})},{'candidate':'pdfminer.six','fixture':'existing-rejection-evidence','classification':'REJECT','canonicalSha256':canonical({'classification':'REJECT','text':'Arabic CID glyphs undecodable'})}])
 return {'runId':run_id,'resultCount':len(rows),'successfulResults':sum(x['classification']=='SUCCESS' for x in rows),'governedQuarantines':sum(x['classification']=='QUARANTINED' for x in rows),'unsupportedResults':sum(x['classification']=='UNSUPPORTED_LANGUAGE_EXTRACTION' for x in rows),'results':rows,'totalWallNanoseconds':time.perf_counter_ns()-started}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('run_id');a=p.parse_args();print(json.dumps(run(a.run_id),ensure_ascii=False,sort_keys=True))
