"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Crawler and Browser Benchmark Fixture Server
Introduction: Serves deterministic acquisition fixtures on an ephemeral IPv4 loopback port.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import gzip
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


STATIC = b"<!doctype html><html><head><title>Static</title></head><body><a href='/linked'>Linked</a><a href='/linked?b=2&a=1#part'>Variant</a><a href='http://example.invalid/blocked'>External</a></body></html>"
LINKED = b"<!doctype html><html><body><p>linked page</p><a href='/static'>home</a></body></html>"
ARABIC = "<!doctype html><html lang='ar' dir='rtl'><body>الزراعة الذكية والمياه</body></html>".encode()
BILINGUAL = "<!doctype html><html><body>Precision agriculture — الزراعة الدقيقة</body></html>".encode()
DYNAMIC = b"""<!doctype html><html><body><main id='content'>initial</main><iframe src='/iframe'></iframe><a id='nav' href='/client-target'>navigate</a><button id='popup' onclick=\"window.open('/popup-target')\">popup</button><a id='download' download href='/download'>download</a><script>document.querySelector('#content').textContent='rendered deterministic content';setTimeout(()=>{const p=document.createElement('p');p.id='lazy';p.textContent='lazy loaded';document.body.appendChild(p)},20);fetch('http://example.invalid/third-party').catch(()=>{});fetch('/missing-subresource').catch(()=>{});new Worker('/worker.js');try{new WebSocket('ws://169.254.169.254/socket')}catch(e){};console.error('fixture console error');</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    attempts: dict[str, int] = {}

    def log_message(self, *_: object) -> None:
        return

    def _send(self, status: int, body: bytes = b"", content_type: str = "text/html; charset=utf-8", headers: dict[str, str] | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        if path == "/reset": self.attempts.clear(); self._send(200, b"reset", "text/plain")
        elif path == "/static": self._send(200, STATIC)
        elif path == "/linked": self._send(200, LINKED)
        elif path == "/arabic": self._send(200, ARABIC)
        elif path == "/bilingual": self._send(200, BILINGUAL)
        elif path == "/robots.txt": self._send(200, b"User-agent: FlahaBenchmark\nDisallow: /robots-deny\nAllow: /robots-allow\n", "text/plain; charset=utf-8")
        elif path == "/robots-allow": self._send(200, b"allowed", "text/plain")
        elif path == "/robots-deny": self._send(200, b"denied", "text/plain")
        elif path == "/sitemap.xml": self._send(200, f"<urlset><url><loc>http://127.0.0.1:{self.server.server_port}/static</loc></url></urlset>".encode(), "application/xml")
        elif path == "/redirect-one": self._send(302, headers={"Location": "/redirect-two"})
        elif path == "/redirect-two": self._send(302, headers={"Location": "/static"})
        elif path == "/redirect-external": self._send(302, headers={"Location": "http://169.254.169.254/latest/meta-data"})
        elif path == "/redirect-loop": self._send(302, headers={"Location": "/redirect-loop"})
        elif path == "/gzip": self._send(200, gzip.compress(STATIC), headers={"Content-Encoding": "gzip"})
        elif path == "/wrong-content-type": self._send(200, STATIC, "application/octet-stream")
        elif path == "/invalid-charset": self._send(200, b"\xff\xfeinvalid", "text/html; charset=utf-8")
        elif path == "/large": self._send(200, b"x" * 262144, "application/octet-stream")
        elif path == "/slow": time.sleep(0.35); self._send(200, b"slow", "text/plain")
        elif path == "/404": self._send(404, b"missing", "text/plain")
        elif path == "/429": self._send(429, b"retry", "text/plain", {"Retry-After": "1"})
        elif path == "/500-then-success":
            count = self.attempts.get(path, 0); self.attempts[path] = count + 1
            self._send(500 if count == 0 else 200, b"transient" if count == 0 else b"success", "text/plain")
        elif path == "/dynamic": self._send(200, DYNAMIC)
        elif path == "/client-target": self._send(200, b"<html><body>client target</body></html>")
        elif path == "/popup-target": self._send(200, b"<html><body>popup target</body></html>")
        elif path == "/iframe": self._send(200, b"<html><body>governed iframe</body></html>")
        elif path == "/worker.js": self._send(200, b"fetch('http://10.0.0.1/worker-blocked').catch(()=>{});", "text/javascript")
        elif path == "/download": self._send(200, b"controlled-download\n", "application/octet-stream", {"Content-Disposition": "attachment; filename=fixture.txt"})
        elif path == "/missing-subresource": self._send(404, b"", "text/plain")
        else: self._send(404, b"unknown", "text/plain")


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    print(json.dumps({"host": "127.0.0.1", "port": server.server_port}), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
