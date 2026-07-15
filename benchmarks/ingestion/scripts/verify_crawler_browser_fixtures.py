"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Crawler and Browser Fixture Verification
Introduction: Verifies the deterministic local acquisition corpus before candidate execution.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import hashlib, json, subprocess, sys
from pathlib import Path
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[3]; SERVER=Path(__file__).with_name("crawler_browser_fixture_server.py")
ROUTES=["/static","/linked","/robots.txt","/sitemap.xml","/gzip","/wrong-content-type","/invalid-charset","/arabic","/bilingual","/large","/404","/429","/dynamic","/iframe","/worker.js","/download"]


def main()->None:
    server=subprocess.Popen([sys.executable,str(SERVER)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        port=json.loads(server.stdout.readline())["port"]; manifest=[]
        for route in ROUTES:
            try:
                with urlopen(f"http://127.0.0.1:{port}{route}",timeout=2) as response: body=response.read(); status=response.status
            except Exception as exc:
                if not hasattr(exc,"code"): raise
                body=exc.read(); status=exc.code
            manifest.append({"route":route,"status":status,"bytes":len(body),"sha256":hashlib.sha256(body).hexdigest()})
        if len({item["route"] for item in manifest})!=len(ROUTES): raise SystemExit("duplicate_fixture_route")
        print(json.dumps({"fixture_manifest":"crawler-browser-fixtures-v2","count":len(manifest),"fixtures":manifest},sort_keys=True))
    finally:
        server.terminate()
        try: server.wait(3)
        except subprocess.TimeoutExpired: server.kill(); server.wait(3)


if __name__=="__main__": main()
