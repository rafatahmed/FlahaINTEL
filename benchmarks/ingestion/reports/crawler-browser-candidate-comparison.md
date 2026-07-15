<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Crawler and Browser Candidate Comparison
Introduction:
Records the Phase 3E-J pre-install audit, controlled benchmark evidence, decisions, and architecture boundary.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# Crawler and browser candidate comparison

## Scope and assumptions

Phase 3E-J evaluates acquisition only. It does not extract article content, write to PostgreSQL or Prisma, register production providers, or authorize public crawling. The benchmark fixture origin is the only allowed network destination. Raw response bytes and browser-serialized rendered HTML are distinct artifacts.

The benchmark assumes the repository's Node 24.4.1 runtime and CPython 3.14.0 on Windows x64. Results apply to the deterministic local corpus, not arbitrary internet content.

## Pre-install audit

| Boundary | Scrapy | Playwright |
| --- | --- | --- |
| Exact release | 2.17.0, uploaded 2026-07-07 | 1.61.1, published 2026-06-23 |
| Licence | BSD-3-Clause | Apache-2.0; bundled browser notices remain separately applicable |
| Runtime compatibility | Python >=3.10; CPython 3.14 classifier and Windows wheels verified | Node >=18; repository Node 24.4.1 accepted |
| Pinned engine | Twisted 26.4.0 | Chromium headless shell 149.0.7827.55, revision 1228 |
| Native boundary | CPython 3.14 wheels for cffi, lxml, charset-normalizer and zope.interface; abi3 cryptography wheel; no source build | Signed npm packages plus pinned Chromium, FFmpeg 1011 and Winldd 1007 archives |
| Crypto/XML boundary | cryptography 49.0.0, pyOpenSSL 26.3.0 / OpenSSL 4.0.1, lxml 6.1.1 / libxml2 2.11.9 | Chromium TLS/network stack; no repository OpenSSL linkage |
| Offline reconstruction | 34-wheel, SHA-256-locked wheelhouse with `--no-index --find-links --require-hashes`; reconstruction passed | integrity-locked npm graph plus local 124,119,186-byte browser archive; empty-destination reconstruction and governed launch passed |
| Windows sandbox | Process isolation is external to Scrapy | Playwright launches Chromium with `--no-sandbox` on Windows; OS account, supervisor, network policy and process-tree containment remain mandatory |

The npm identities are `sha512-DWnY...kzPQ==` for `playwright` and `sha512-h7Ql...SpLkg==` for `playwright-core`; both registry records include npm signatures and SLSA provenance attestations. The audited browser archives total 120,640,247 compressed bytes for the selected headless-only installation. The pre-download conservative projection was 634,560,988 bytes, below the usable disk margin.

## Controlled boundary

Inputs are restricted to an ephemeral `127.0.0.1` fixture origin, safe relative routes, closed candidate/mode choices and fixed limits. The shared policy rejects non-HTTP schemes, credentials, DNS names, alternate ports, IPv6 aliases, metadata/link-local/private/public addresses, authority-relative routes and fragments. Scrapy validates each downloader request, including redirects. Playwright intercepts every browser-context request and blocks any URL outside the exact fixture origin.

Scrapy disables Telnet, feeds, cache and external logging; bounds concurrency, response bytes, redirects, retries, depth, URL count and time. Playwright uses headless Chromium, a Playwright-created temporary profile under the candidate cache, empty permissions, blocked service workers, controlled downloads, closed popups and context-wide interception. The cache/profile and download staging directories are removed after each run. No surviving Chromium process was observed after the campaign.

## Comparative evidence

Two unchanged runs produced identical candidate-neutral structures after excluding only elapsed time, timestamps, process counts and the standard HTTP `Date` response header. Response bytes, response/rendered hashes, meaningful headers, links, request classifications, policy rejections and failure classes remained included.

```text
hash mismatches: 0
classification mismatches: 0
policy mismatches: 0
```

| Measure | Scrapy 2.17.0 | Playwright 1.61.1 / Chromium r1228 |
| --- | ---: | ---: |
| Download/runtime bytes | 13,229,277 wheelhouse | 17,582,425 npm runtime + 286,315,753 browser; local reconstruction archive 124,119,186 |
| Installed environment bytes | 80,697,923 | 303,898,178 runtime + browser |
| Cold total wall time, min/median/max | 1,611.569 / 1,654.760 / 1,697.952 ms | 2,371.038 / 2,375.778 / 2,380.517 ms |
| First/rendered acquisition, min/median/max | 132.444 / 133.842 / 135.240 ms | 584.575 / 587.774 / 590.972 ms |
| Warm subsequent/static navigation, min/median/max | 124.421 / 129.920 / 386.091 ms, 24 samples | 92.076 / 94.149 / 96.221 ms, 2 fresh contexts |
| Peak process-tree memory | 78,106,624 bytes | 355,049,472 bytes |
| Average process-tree memory | 59,333,242 bytes across two runs | 191,852,323 bytes across two runs |
| Peak process count | 2 Python process observations | 5 Node/Chromium processes |
| Temporary disk growth | 1 byte maximum in measured results root | 46,977 bytes maximum in browser cache |
| Output evidence bytes | 32,475 | 7,915 |
| Work represented | 13 bounded static routes, response bytes and link policy | JavaScript render, network idle, lazy content, popup and download detection |

The timings intentionally do not equate a static request with a rendered page. Windows Toolhelp and process-memory sampling covered the Node parent and complete observed Chromium tree at 20 ms intervals; short-lived crash-handler or utility processes could evade a sampling interval and are therefore not claimed absent. Starting free disk was 3,016,011,776 bytes, the lowest observed value was 3,015,913,472, and ending free disk was 3,015,880,704, preserving an 868,397,056-byte margin above the 2 GiB reserve.

Scrapy reconstruction created a timestamped empty virtual environment, installed 34 wheels with zero sdists using the three required offline flags, passed `pip check`, disabled user site, started the Twisted reactor, acquired 13 governed fixtures and removed the environment. Playwright reconstruction restored archive `playwright-chromium-headless-shell-149.0.7827.55-r1228-win64.zip` (SHA-256 `7b1530d802c2e1261e4184fc61871fa561c56880a8cfcd632f0b545be3a0d168`) into an empty destination, verified executable SHA-256 `28016df6864d302434c9231e1f9f1a8a7ecc512cb2fe3faabb2a36130b96bcf1`, launched the governed dynamic fixture, closed the tree and removed the destination.

## Capability decisions

| Capability | Decision | Basis |
| --- | --- | --- |
| Static HTTP acquisition, controlled crawling, link discovery | ADOPT AS PRIMARY — Scrapy | Correct deterministic byte capture and governed links with materially lower runtime cost |
| Robots policy, redirects, retries, rate limiting | ADOPT — Scrapy benchmark architecture | Native controls passed the closed fixture scope; future policy remains use-case specific |
| Response-byte capture, Arabic and bilingual HTML | ADOPT AS PRIMARY — Scrapy | Exact bytes and hashes preserved without extraction |
| JavaScript rendering and rendered DOM | ADOPT AS FALLBACK — Playwright | Dynamic/lazy content and deterministic serialization passed |
| Network interception and download detection | ADOPT AS FALLBACK — Playwright | Context-wide request classification and controlled cancellation passed |
| Popup/new-tab containment | ADOPT | Popup/new-tab attempts are inventoried and closed in the benchmark boundary |
| Large-response handling | BENCHMARK FURTHER | Bounded rejection exists; maximum-scale resource evidence is limited |
| Offline reproducibility | ADOPT | Hashed Scrapy rebuild and local Chromium archive restoration both passed from empty destinations |
| Production crawler provider | DEFER | Phase does not authorize production registration |
| Production browser provider | DEFER | Process-tree, Windows sandbox and capacity hardening remain |

Detailed decisions: Scrapy static acquisition, governed crawling, link discovery and raw response capture are `ADOPT AS PRIMARY`; redirects, retries, robots policy and rate limits are `ADOPT`. Playwright JavaScript rendering, rendered DOM, network interception, download detection, popup/new-tab containment, process-tree containment and offline reconstruction are `ADOPT AS FALLBACK`. The shared network policy is `ADOPT`. Large-response handling remains `BENCHMARK FURTHER`. Production crawler and browser providers remain `DEFER`.

## Recommended architecture

```text
governed acquisition request
├── static/crawl → Scrapy → immutable raw response artifact
└── dynamic fallback → Playwright → raw response artifact + separate rendered HTML artifact
                                      ↓
                                  FlahaHTML
```

Scrapy is the primary static acquirer and link-discovery engine. Playwright is the dynamic fallback, rendered-DOM engine, browser network-policy enforcement point and download-detection engine. Candidate adapters remain benchmark-only and cannot write databases or arbitrary output paths.
