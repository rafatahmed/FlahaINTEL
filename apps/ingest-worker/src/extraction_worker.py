"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed Extraction Worker
Introduction:
Runs one closed offline HTML or document extraction operation and writes only allocated staging outputs.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""
from __future__ import annotations
import hashlib,json,os,stat,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; BENCH=ROOT/'benchmarks/ingestion/scripts';sys.path.insert(0,str(BENCH))
def emit(v): print(json.dumps(v,ensure_ascii=False,separators=(',',':')),flush=True)
def ctx(r,t,s): return {'contractVersion':'1.0.0','correlationId':r['correlationId'],'causationId':r['jobId'],'jobId':r['jobId'],'attemptId':r['attemptId'],'messageType':t,'sequence':s}
def metrics(): return {'wallTimeMs':0,'peakMemoryBytes':0,'bytesRead':0,'bytesWritten':0}
def descriptor(r): return {**r['provider'],'contractVersions':['1.0.0'],'operations':[r['operation']],'inputMediaTypes':[r['payload']['inputArtifact']['mediaType']],'outputMediaTypes':['text/plain','application/json'],'capabilities':['CANCELLATION'],'offlineCapable':True,'deterministicClaim':'DETERMINISTIC','requiresNetwork':False,'binaryDigest':None,'modelDigests':[],'generatedAt':r['sentAt']}
def terminal(r,outcome,result=None,code=None,message=None,retryable=False):
 error=None if outcome=='SUCCEEDED' else {'code':code,'category':'PROVIDER_FAILURE','retryable':retryable,'message':message}
 return {**ctx(r,'WORKER_RESULT',1),'startedAt':r['sentAt'],'finishedAt':r['sentAt'],'outcome':outcome,'providerDescriptor':descriptor(r),'warnings':[],'metrics':metrics(),'result':result,'error':error}
def governed(key,prefix=None):
 key=key.replace('\\','/');target=(Path.cwd()/key).resolve();root=Path.cwd().resolve()
 if key.startswith('/') or '..' in key.split('/') or not target.is_relative_to(root) or (prefix and not key.startswith(prefix+'/')): raise ValueError('FILESYSTEM_POLICY_VIOLATION')
 info=target.lstat()
 if not stat.S_ISREG(info.st_mode) or target.is_symlink(): raise ValueError('FILESYSTEM_POLICY_VIOLATION')
 return target
def write_outputs(payload,values):
 results=[]
 for allocation in payload['outputAllocations']:
  role=allocation['role'];data=values.get(role,b'')
  if isinstance(data,str): data=data.encode('utf-8')
  if not isinstance(data,bytes) or len(data)>allocation['maximumBytes']: raise ValueError('RESOURCE_LIMIT_EXCEEDED')
  target=governed(allocation['stagingKey'],payload['outputStagingPrefix'])
  with target.open('r+b',buffering=0) as handle: handle.truncate(0);handle.write(data);os.fsync(handle.fileno())
  results.append({'artifactId':allocation['artifactId'],'role':role,'mediaType':allocation['mediaType'],'stagingKey':allocation['stagingKey'],'byteLength':len(data),'checksum':hashlib.sha256(data).hexdigest(),'writeComplete':True})
 return results
def html_extract(provider,path):
 from html_encoding_policy import decode_html
 from html_shared_extractors import Node,extract,parse_stdlib
 decoded=decode_html(path.read_bytes())
 if provider=='html.stdlib-htmlparser': tree,evidence=parse_stdlib(decoded.text);value=extract(tree,candidate='stdlib-html.parser',version=sys.version.split()[0],parser_evidence={'api':'html.parser.HTMLParser',**evidence})
 elif provider=='html.lxml':
  import lxml
  from lxml import html
  parser=html.HTMLParser(encoding='utf-8',no_network=True,recover=True,huge_tree=False,remove_comments=False);document=html.document_fromstring(decoded.text.encode('utf-8'),parser=parser);count=0
  def convert(element,level=1):
   nonlocal count
   count+=1
   if count>100000 or level>512: raise ValueError('DOM_LIMIT_EXCEEDED')
   node=Node(str(element.tag).lower() if isinstance(element.tag,str) else '#comment',list(element.attrib.items()))
   if element.text: node.children.append(element.text)
   for child in element:
    if isinstance(child.tag,str): node.children.append(convert(child,level+1))
    if child.tail: node.children.append(child.tail)
   return node
  value=extract(Node('#document',children=[convert(document)]),candidate='lxml',version=lxml.__version__,parser_evidence={'api':'lxml.html.HTMLParser','noNetwork':True,'recovery':True,'parserErrors':len(parser.error_log)})
 elif provider=='html.selectolax':
  import importlib.metadata
  from selectolax.lexbor import LexborHTMLParser
  parser=LexborHTMLParser(decoded.text);count=0
  def convert(source,level=1):
   nonlocal count
   count+=1
   if count>100000 or level>512: raise ValueError('DOM_LIMIT_EXCEEDED')
   if source.is_text_node:return source.text(deep=False)
   if source.is_comment_node:return None
   node=Node(source.tag.lower(),list(source.attributes.items()));child=source.child
   while child is not None:
    converted=convert(child,level+1)
    if converted is not None:node.children.append(converted)
    child=child.next
   return node
  converted=convert(parser.root);value=extract(Node('#document',children=[converted] if isinstance(converted,Node) else []),candidate='selectolax-lexbor',version=importlib.metadata.version('selectolax'),parser_evidence={'api':'selectolax.lexbor.LexborHTMLParser','backend':'Lexbor','legacyModestUsed':False})
 else: raise ValueError('INVALID_PROVIDER_REQUEST')
 value['encoding']={'selected':decoded.encoding,'reason':decoded.reason,'hadBom':decoded.had_bom};text=value.get('content',{}).get('text','');metadata={'document':value.get('document',{}).get('metadata',{}),'links':value.get('links',[]),'encoding':value.get('encoding',{}),'warnings':value.get('warnings',[])};structure={'headings':value.get('content',{}).get('headings',[]),'domEvidence':value.get('domEvidence',{}),'structuredData':value.get('structuredData',[])}
 return {'EXTRACTED_TEXT':text,'METADATA':json.dumps(metadata,ensure_ascii=False,separators=(',',':')),'STRUCTURE':json.dumps(structure,ensure_ascii=False,separators=(',',':')),'TABLE':json.dumps(value.get('tables',[]),ensure_ascii=False,separators=(',',':')),'RESULT':json.dumps({'textLength':len(text),'linkCount':len(value.get('links',[])),'tableCount':len(value.get('tables',[]))},separators=(',',':'))},{'linkCount':len(value.get('links',[])),'tableCount':len(value.get('tables',[]))}
def document_extract(provider,path,payload):
 if provider=='document.docling-slim':
  os.environ.update({'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','HF_DATASETS_OFFLINE':'1','DO_NOT_TRACK':'1','NO_PROXY':'*','no_proxy':'*'});from docling.datamodel.accelerator_options import AcceleratorDevice,AcceleratorOptions;from docling.datamodel.base_models import InputFormat;from docling.datamodel.pipeline_options import PdfPipelineOptions;from docling.document_converter import DocumentConverter,PdfFormatOption
  options=PdfPipelineOptions(artifacts_path=ROOT/'.benchmark-models/document-docling-slim-2.111.0',do_ocr=False,do_table_structure=True,enable_remote_services=False,allow_external_plugins=False,accelerator_options=AcceleratorOptions(device=AcceleratorDevice.CPU,num_threads=2));doc=DocumentConverter(format_options={InputFormat.PDF:PdfFormatOption(pipeline_options=options)}).convert(path).document;text=doc.export_to_text();markdown=doc.export_to_markdown();meta={'pages':len(doc.pages),'ocrEnabled':False,'remoteServicesEnabled':False};structure={'markdown':markdown};tables=[]
 elif provider=='document.apache-tika':
  runtime=ROOT/'.benchmark-runtime/document-tika-3.3.1';java=next((runtime/'jre').glob('*/bin/java.exe'));jar=runtime/'tika-app-3.3.1.jar';config=ROOT/'benchmarks/ingestion/config/document-tika-parser-allowlist.xml';temp=Path(os.environ['TEMP']);command=[str(java),'-Xms64m','-Xmx512m',f'-Djava.io.tmpdir={temp}',f'-Dpdfbox.fontcache={temp}',f'-Duser.home={temp}','-Djava.awt.headless=true','-jar',str(jar),f'--config={config}','-t',str(path)];completed=subprocess.run(command,capture_output=True,timeout=max(1,payload['executionLimits']['wallTimeoutMs']//1000),check=False);text=completed.stdout.decode('utf-8','replace');meta={'exitCode':completed.returncode};structure={};tables=[]
  if completed.returncode!=0: raise RuntimeError('TIKA_PARSE_FAILURE')
 elif provider=='document.pypdf-inspection':
  from pypdf import PdfReader
  reader=PdfReader(path);text='';meta={'pages':len(reader.pages),'encrypted':reader.is_encrypted,'metadata':{str(k):str(v) for k,v in (reader.metadata or {}).items()}};structure={'annotations':sum(len(page.get('/Annots') or []) for page in reader.pages)};tables=[]
 else: raise ValueError('INVALID_PROVIDER_REQUEST')
 return {'EXTRACTED_TEXT':text,'METADATA':json.dumps(meta,ensure_ascii=False,separators=(',',':')),'STRUCTURE':json.dumps(structure,ensure_ascii=False,separators=(',',':')),'TABLE':json.dumps(tables,separators=(',',':')),'RESULT':json.dumps({'textLength':len(text),'pages':meta.get('pages',0),'tableCount':len(tables)},separators=(',',':'))},{'pages':meta.get('pages',0),'tableCount':len(tables)}
def main():
 try:
  request=json.loads(sys.stdin.buffer.readline(1_048_577));payload=request['payload'];provider=request['provider']['providerId']
  if payload['operation']!=request['operation'] or payload['executionId']!=request['attemptId']: raise ValueError('INVALID_PROVIDER_REQUEST')
  emit({**ctx(request,'WORKER_PROGRESS',0),'occurredAt':request['sentAt'],'stage':'EXTRACT','status':'STARTED','completedUnits':0,'totalUnits':1,'unit':'STEPS','metrics':metrics()})
  input_ref=payload['inputArtifact'];source=governed(input_ref['key']);data=source.read_bytes()
  if len(data)!=input_ref['byteLength'] or hashlib.sha256(data).hexdigest()!=input_ref['checksum'] or len(data)>payload['executionLimits']['maxInputBytes']: raise ValueError('ARTIFACT_HASH_MISMATCH')
  values,evidence=html_extract(provider,source) if request['operation']=='HTML_EXTRACTION' else document_extract(provider,source,payload);artifacts=write_outputs(payload,values)
  result={'operation':request['operation'],'executionId':payload['executionId'],'providerId':provider,'providerVersion':request['provider']['providerVersion'],'capability':payload['capability'],'policyVersion':payload['policyVersion'],'artifacts':artifacts,'evidence':evidence,'runtimeEvidence':f'{provider}/{request["provider"]["providerVersion"]}'};emit(terminal(request,'SUCCEEDED',result));return 0
 except Exception as exc:
  if 'request' in locals(): emit(terminal(request,'FAILED',code='EXTRACTION_FAILURE',message=str(exc)[:512],retryable=not isinstance(exc,ValueError)))
  return 0
if __name__=='__main__': raise SystemExit(main())
