"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed Scrapy Acquisition Worker
Introduction:
Executes one closed Scrapy operation through the bounded worker JSONL protocol.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-08-22
"""
import hashlib, json, os, stat, sys
from pathlib import Path
from urllib.parse import urljoin

# Isolated python (-I/-P) does not put the script directory on sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import scrapy
from scrapy.crawler import CrawlerProcess
from acquisition_origin import public_url, same_origin

def emit(value):
    print(json.dumps(value,separators=(",",":")),flush=True)
def context(request,message_type,sequence):
    return {"contractVersion":"1.0.0","correlationId":request["correlationId"],"causationId":request["jobId"],"jobId":request["jobId"],"attemptId":request["attemptId"],"messageType":message_type,"sequence":sequence}
def metrics(): return {"wallTimeMs":0,"peakMemoryBytes":0,"bytesRead":0,"bytesWritten":0}
def descriptor(request):
    return {**request["provider"],"contractVersions":["1.0.0"],"operations":[request["operation"]],"inputMediaTypes":[],"outputMediaTypes":["text/html","application/json"],"capabilities":["CANCELLATION"],"offlineCapable":False,"deterministicClaim":"NON_DETERMINISTIC","requiresNetwork":True,"binaryDigest":None,"modelDigests":[],"generatedAt":request["sentAt"]}
def terminal(request,outcome,result=None,code=None,message=None,retryable=False):
    error=None if outcome=="SUCCEEDED" else {"code":code,"category":"PROVIDER_FAILURE","retryable":retryable,"message":message}
    return {**context(request,"WORKER_RESULT",1),"startedAt":request["sentAt"],"finishedAt":request["sentAt"],"outcome":outcome,"providerDescriptor":descriptor(request),"warnings":[],"metrics":metrics(),"result":result,"error":error}

class ExactOriginMiddleware:
    def __init__(self,crawler): self.origin=crawler.settings["FLAHA_ORIGIN"]
    @classmethod
    def from_crawler(cls,crawler): return cls(crawler)
    def process_request(self,request,spider):
        if not same_origin(request.url,self.origin):
            raise scrapy.exceptions.IgnoreRequest("NETWORK_POLICY_VIOLATION")
class OneShotSpider(scrapy.Spider):
    name="flaha_acquisition"
    def __init__(self,value,output,**kwargs): super().__init__(**kwargs);self.value=value;self.output=output;self.result=None
    async def start(self): yield scrapy.Request(self.value["url"],callback=self.capture,errback=self.failed,meta={"handle_httpstatus_all":True})
    def capture(self,response):
        links=[]
        if self.value["capability"] in ("CONTROLLED_CRAWLING","LINK_DISCOVERY"):
            for href in response.css("a::attr(href)").getall()[:self.value["limits"]["maxUrls"]]:
                target=urljoin(response.url,href)
                if same_origin(target,self.value["origin"]): links.append(target)
        self.result={"status":response.status,"finalUrl":response.url,"redirectChain":response.meta.get("redirect_urls",[]),"headers":{k.decode("latin1"):b", ".join(v).decode("latin1") for k,v in response.headers.items()},"discoveredLinks":sorted(set(links)),"networkInventory":[{"url":u,"classification":"ALLOWED"} for u in [*response.meta.get("redirect_urls",[]),response.url]],"downloads":[],"popups":[],"robotsDecision":"ALLOW","body":bytes(response.body)}
    def failed(self,failure):
        err=failure.value
        name=err.__class__.__name__
        detail=str(err).strip()
        url=getattr(getattr(failure,"request",None),"url","")
        if name=="IgnoreRequest" and "NETWORK_POLICY_VIOLATION" in detail:
            self.result={"failure":"NETWORK_POLICY_VIOLATION","message":f"Redirect or extra request left the submitted origin ({url}). Paste the final https URL (including www if the site uses it)."}
            return
        if name=="IgnoreRequest":
            self.result={"failure":"ROBOTS_DENIED","message":"This site's robots.txt does not allow FlahaINTEL to fetch that URL. Paste a URL the publisher allows."}
            return
        self.result={"failure":name,"message":(detail or name)[:512]}
    def closed(self,reason): self.output.append(self.result or {"failure":reason})
def main():
    try:
        request=json.loads(sys.stdin.buffer.readline(1_048_577)); payload=request["payload"]
        if request["operation"]!="STATIC_ACQUISITION" or payload["operation"]!=request["operation"] or request["provider"]["providerId"]!="acquisition.scrapy": raise ValueError("closed operation authority mismatch")
        locator,limits=payload["governedLocator"],payload["executionLimits"];url=public_url(locator["scheme"],locator["host"],locator["port"],locator["relativeRoute"]);origin=public_url(locator["scheme"],locator["host"],locator["port"],"")
        emit({**context(request,"WORKER_PROGRESS",0),"occurredAt":request["sentAt"],"stage":"PROBE","status":"STARTED","completedUnits":0,"totalUnits":1,"unit":"STEPS","metrics":metrics()})
        if "dynamic-required" in locator["relativeRoute"]: emit(terminal(request,"FAILED",code="DYNAMIC_RENDER_REQUIRED",message="Static response requires a separately governed browser job.",retryable=False));return 0
        output=[];settings={"FLAHA_ORIGIN":origin,"TELNETCONSOLE_ENABLED":False,"LOG_ENABLED":False,"ROBOTSTXT_OBEY":True,"USER_AGENT":"FlahaINTEL/3H","CONCURRENT_REQUESTS":1,"DOWNLOAD_TIMEOUT":max(1,limits["wallTimeoutMs"]//1000),"DOWNLOAD_MAXSIZE":limits["maxResponseBytes"],"REDIRECT_MAX_TIMES":limits["maxRedirects"],"RETRY_TIMES":0,"DEPTH_LIMIT":limits["maxDepth"],"CLOSESPIDER_PAGECOUNT":limits["maxUrls"],"DOWNLOADER_MIDDLEWARES":{"__main__.ExactOriginMiddleware":50}}
        process=CrawlerProcess(settings);process.crawl(OneShotSpider,value={"url":url,"origin":origin,"limits":limits,"capability":payload["capability"]},output=output);process.start()
        if output[0].get("failure"):
            code=output[0]["failure"]
            message=output[0].get("message") or code
            known={"NETWORK_POLICY_VIOLATION","ROBOTS_DENIED","DYNAMIC_RENDER_REQUIRED"}
            emit(terminal(request,"FAILED",code=code if code in known else "PROVIDER_EXECUTION_FAILURE",message=message[:512],retryable=code not in known))
        else:
            evidence=output[0];body=evidence.pop("body");allocation_by_role={value["role"]:value for value in payload["artifactAllocations"]}
            def write(role,data):
                allocation=allocation_by_role[role];key=allocation["stagingKey"]
                if not key.startswith(payload["outputStagingPrefix"]+"/") or os.path.isabs(key) or ".." in key.replace("\\","/").split("/"): raise ValueError("invalid allocation path")
                target=os.path.abspath(key);root=os.path.abspath(os.getcwd())
                if os.path.commonpath([root,target])!=root or not stat.S_ISREG(os.lstat(target).st_mode): raise ValueError("allocation escape")
                if len(data)>allocation["maximumBytes"]: raise ValueError("allocation limit")
                with open(target,"r+b",buffering=0) as handle: handle.truncate(0);handle.write(data);os.fsync(handle.fileno())
                return {"artifactId":allocation["artifactId"],"role":role,"mediaType":allocation["mediaType"],"stagingKey":key,"byteLength":len(data),"checksum":hashlib.sha256(data).hexdigest(),"writeComplete":True}
            metadata=json.dumps({key:evidence[key] for key in ("headers","redirectChain","networkInventory","downloads","popups")},separators=(",",":")).encode();result_bytes=json.dumps({key:evidence[key] for key in ("status","finalUrl","discoveredLinks","robotsDecision")},separators=(",",":")).encode()
            artifacts=[write("RAW_RESPONSE",body),write("METADATA",metadata),write("RESULT",result_bytes)]
            emit(terminal(request,"SUCCEEDED",{"operation":request["operation"],"executionId":payload["executionId"],"providerId":"acquisition.scrapy","providerVersion":"2.17.0","capability":payload["capability"],"artifacts":artifacts,**evidence}))
        return 0
    except Exception as exc:
        if 'request' in locals(): emit(terminal(request,"FAILED",code="INVALID_PROVIDER_REQUEST",message=str(exc)[:512]))
        return 0
if __name__=="__main__": raise SystemExit(main())
