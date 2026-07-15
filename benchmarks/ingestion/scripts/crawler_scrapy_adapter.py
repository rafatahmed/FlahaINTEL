"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Scrapy Acquisition Benchmark Adapter
Introduction: Captures bounded static responses and link-policy evidence without extraction or persistence.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

import scrapy
from scrapy.crawler import CrawlerProcess

sys.path.insert(0, str(Path(__file__).resolve().parent))
from crawler_browser_policy import FixturePolicy, PolicyRejection


def canonical_link(value: str) -> str:
    parsed = urlsplit(value)._replace(fragment="")
    query = "&".join(sorted(filter(None, parsed.query.split("&"))))
    return urlunsplit(parsed._replace(query=query))


class ClosedNetworkMiddleware:
    def __init__(self, crawler):
        self.policy = FixturePolicy(crawler.settings.getint("FLAHA_FIXTURE_PORT"))

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler)

    def process_request(self, request, spider):
        try:
            self.policy.validate(request.url)
        except (PolicyRejection, ValueError) as exc:
            raise scrapy.exceptions.IgnoreRequest(f"network_policy:{exc}") from exc


class ClosedSpider(scrapy.Spider):
    name = "flaha_closed_static"
    custom_settings = {
        "TELNETCONSOLE_ENABLED": False, "LOG_ENABLED": False, "ROBOTSTXT_OBEY": True,
        "USER_AGENT": "FlahaBenchmark/3E-J", "CONCURRENT_REQUESTS": 1,
        "DOWNLOAD_TIMEOUT": 2, "DOWNLOAD_MAXSIZE": 131072, "DOWNLOAD_WARNSIZE": 65536,
        "REDIRECT_MAX_TIMES": 3, "RETRY_TIMES": 1, "DEPTH_LIMIT": 2,
        "CLOSESPIDER_PAGECOUNT": 20, "HTTPCACHE_ENABLED": False,
        "EXTENSIONS": {}, "FEEDS": {},
        "DOWNLOADER_MIDDLEWARES": {"__main__.ClosedNetworkMiddleware": 50},
    }

    def __init__(self, *, policy: FixturePolicy, routes: list[str], output: Path, **kwargs: object):
        super().__init__(**kwargs); self.policy = policy; self.routes = routes; self.output = output; self.results: list[dict[str, object]] = []

    async def start(self):
        for route in self.routes:
            yield scrapy.Request(self.policy.governed_url(route), callback=self.parse_capture, errback=self.capture_error, dont_filter=True, meta={"handle_httpstatus_all": True, "started": time.perf_counter(), "route": route})

    def parse_capture(self, response: scrapy.http.Response):
        if 300 <= response.status < 400 and response.headers.get("Location"):
            target=urljoin(response.url,response.headers["Location"].decode("latin1")); chain=list(response.meta.get("flaha_redirect_chain",[]))+[response.url]
            try: governed=self.policy.validate(target)
            except (PolicyRejection,ValueError):
                self.results.append({"candidate":"scrapy","mode":"static","requested_url":self.policy.governed_url(response.meta["route"]),"final_url":response.url,"redirect_chain":chain,"status":response.status,"response_headers":{k.decode("latin1"):b", ".join(v).decode("latin1") for k,v in response.headers.items()},"content_type":response.headers.get("Content-Type",b"").decode("latin1"),"charset_evidence":getattr(response,"encoding",None),"artifact_key":None,"artifact_byte_size":0,"sha256":None,"discovered_links":[],"network_request_inventory":[{"url":response.url,"classification":"allowed"},{"url":target,"classification":"blocked"}],"policy_rejections":[target],"timestamps":{"started":"excluded-from-determinism"},"elapsed_ms":round((time.perf_counter()-response.meta["started"])*1000,3),"warnings":[],"failure_classification":"policy_blocked_redirect","retry_count":response.meta.get("retry_times",0),"robots_result":"allowed"}); return
            if len(chain)>self.policy.max_redirects:
                raise scrapy.exceptions.CloseSpider("redirect_limit")
            yield scrapy.Request(governed,callback=self.parse_capture,errback=self.capture_error,dont_filter=True,meta={**response.meta,"flaha_redirect_chain":chain,"handle_httpstatus_all":True})
            return
        rejected: list[str] = []; accepted: list[str] = []
        for href in response.css("a::attr(href)").getall():
            target = urljoin(response.url, href)
            try: accepted.append(canonical_link(self.policy.validate(target)))
            except (PolicyRejection, ValueError): rejected.append(canonical_link(target))
        redirects = list(response.meta.get("flaha_redirect_chain", []))
        self.results.append({"candidate":"scrapy","mode":"static","requested_url":self.policy.governed_url(response.meta["route"]),"final_url":response.url,"redirect_chain":redirects,"status":response.status,"response_headers":{k.decode("latin1"):b", ".join(v).decode("latin1") for k,v in response.headers.items()},"content_type":response.headers.get("Content-Type",b"").decode("latin1"),"charset_evidence":getattr(response,"encoding",None),"artifact_key":f"raw/{response.meta['route'].strip('/') or 'root'}.bin","artifact_byte_size":len(response.body),"sha256":hashlib.sha256(response.body).hexdigest(),"discovered_links":sorted(set(accepted)),"network_request_inventory":[{"url":response.url,"classification":"allowed"}],"policy_rejections":sorted(set(rejected)),"timestamps":{"started":"excluded-from-determinism"},"elapsed_ms":round((time.perf_counter()-response.meta["started"])*1000,3),"warnings":[],"failure_classification":None,"retry_count":response.meta.get("retry_times",0),"robots_result":"allowed"})

    def capture_error(self, failure):
        request = failure.request
        classification = "policy_blocked_redirect" if "169.254.169.254" in str(failure.value) else failure.value.__class__.__name__.lower()
        self.results.append({"candidate":"scrapy","mode":"static","requested_url":request.url,"final_url":None,"redirect_chain":list(request.meta.get("redirect_urls",[])),"status":None,"response_headers":{},"content_type":None,"charset_evidence":None,"artifact_key":None,"artifact_byte_size":0,"sha256":None,"discovered_links":[],"network_request_inventory":[],"policy_rejections":[],"timestamps":{"started":"excluded-from-determinism"},"elapsed_ms":round((time.perf_counter()-request.meta["started"])*1000,3),"warnings":[],"failure_classification":classification,"retry_count":request.meta.get("retry_times",0),"robots_result":"not_acquired"})

    def closed(self, reason: str):
        self.output.write_text(json.dumps({"candidate":"scrapy","close_reason":reason,"results":sorted(self.results,key=lambda x:x["requested_url"])},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


def main() -> None:
    parser=argparse.ArgumentParser(); parser.add_argument("--port",type=int,required=True); parser.add_argument("--output",type=Path,required=True); args=parser.parse_args()
    policy=FixturePolicy(args.port); routes=["/static","/linked","/arabic","/bilingual","/redirect-one","/redirect-external","/gzip","/wrong-content-type","/invalid-charset","/404","/429","/500-then-success","/robots-deny"]
    args.output.parent.mkdir(parents=True,exist_ok=True); process=CrawlerProcess({"FLAHA_FIXTURE_PORT":args.port}); process.crawl(ClosedSpider,policy=policy,routes=routes,output=args.output); process.start()


if __name__ == "__main__": main()
