<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: HTML Shortlist Installation Report
Introduction:
Records exact wheels, licences, isolated environments, and the Trafilatura stop decision.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-16
-->

# HTML shortlist installation report

The baseline was `93a05219e7423f0b0b1e4fb41f093d7d2a328070` on
`phase-3e-g-html-extraction`. Windows AMD64 and CPython 3.14.0 (`cp314`,
`win_amd64`) matched the authorization. The accepted pandas, Polars, PyArrow,
and DuckDB environments passed isolated imports and `pip check` before download.

Only official PyPI was queried. lxml and selectolax were downloaded as exact
binary wheels and installed separately, offline, with hashes enforced:

| Candidate | Exact wheel | Bytes | SHA-256 | Licence |
| --- | --- | ---: | --- | --- |
| lxml 6.1.1 | `lxml-6.1.1-cp314-cp314-win_amd64.whl` | 4,064,497 | `b2d444f2e66624d68e9c6b211e28a76e22fff5fcabcfff4deac18b529b7d4137` | BSD-3-Clause |
| selectolax 0.4.10 | `selectolax-0.4.10-cp314-cp314-win_amd64.whl` | 1,970,092 | `ab07fc342cf477c0320d22fac52917b824871caf5ab177a0fd94377a901ab657` | MIT |

The lxml wheel has 178 RECORD entries, 177 hashed entries verified, seven AMD64
`.pyd` files, and no separate native DLL. Bundled header evidence identifies
libxml2 2.11.9, libxslt 1.1.45, and libexslt 0.8.25. PE imports are limited to
Python 3.14 and normal Windows runtime/system libraries. The selectolax wheel has
28 RECORD entries, 27 hashed entries verified, and AMD64 Lexbor and Modest native
extensions. Lexbor is the benchmark API; Modest is present but unused.

The isolated lxml environment contains only lxml 6.1.1 and pip 25.2 (1,078 files,
21,179,472 bytes). The selectolax environment contains only selectolax 0.4.10 and
pip 25.2 (900 files, 22,345,537 bytes). Both have user site disabled, no external
`.pth`, no editable install, no unrelated candidate, network client, browser, or
database package, and both pass `pip check`. Offline reconstruction succeeded once
per lock; ignored evidence is retained at
`results/html-offline-reconstruction/{lxml,selectolax}/summary.json`, and both
temporary reconstruction environments were removed.

The retained reconstruction summaries do not contain formal timestamped `runId`
fields. This is an evidence-format limitation; it does not change the recorded
offline installation, probe, `pip check`, cleanup, or `passed: true` results.

## Trafilatura resolver audit

The resolver selected 18 binary wheels and no sdist. This differed from the
provisional inventory because it selected regex 2026.7.10 and tzdata 2026.3.

| Distribution / exact wheel | Version | Bytes | SHA-256 | Declared licence |
| --- | ---: | ---: | --- | --- |
| babel / `babel-2.18.0-py3-none-any.whl` | 2.18.0 | 10,196,845 | `e2b422b277c2b9a9630c1d7903c2a00d0830c409c59ac8cae9081c92f1aeba35` | BSD-3-Clause |
| certifi / `certifi-2026.6.17-py3-none-any.whl` | 2026.6.17 | 133,289 | `2227dcbaafe0d2f59279d1762ddddc37783ed4354594f194ffc31d20f41fc3db` | MPL-2.0 |
| charset-normalizer / `charset_normalizer-3.4.9-cp314-cp314-win_amd64.whl` | 3.4.9 | 162,796 | `16b65ea0f2465b6fb52aa22de5eca612aa964ddfec00a912e26f4656cbef890b` | MIT |
| courlan / `courlan-1.4.0-py3-none-any.whl` | 1.4.0 | 34,193 | `ad1dbdefd912ca7238d4607dc855df5df097f56bac175dd662c84eed3802f49e` | Apache-2.0 |
| dateparser / `dateparser-1.4.1-py3-none-any.whl` | 1.4.1 | 300,503 | `f25d4e051a84be27a35bd297e3e1dc59ff78373701b89be352ba80372d22d0d0` | BSD-3-Clause |
| htmldate / `htmldate-1.10.0-py3-none-any.whl` | 1.10.0 | 31,561 | `9211dae35ab94147c8ed9e5fc2c9287a5cf31d2394cb7857e7f5dd814eb2aad6` | Apache-2.0 |
| jusText / `justext-3.0.2-py2.py3-none-any.whl` | 3.0.2 | 837,940 | `62b1c562b15c3c6265e121cc070874243a443bfd53060e869393f09d6b6cc9a7` | BSD-2-Clause text |
| lxml / `lxml-6.1.1-cp314-cp314-win_amd64.whl` | 6.1.1 | 4,064,497 | `b2d444f2e66624d68e9c6b211e28a76e22fff5fcabcfff4deac18b529b7d4137` | BSD-3-Clause |
| lxml-html-clean / `lxml_html_clean-0.4.5-py3-none-any.whl` | 0.4.5 | 14,573 | `c76fcadd1e5bfb9b8bafc2200d51e4e78eb0dad67f56881c21dfb6484c7e7746` | BSD-3-Clause |
| python-dateutil / `python_dateutil-2.9.0.post0-py2.py3-none-any.whl` | 2.9.0.post0 | 229,892 | `a8b2bc7bffae282281c8140a97d3aa9c14da0b136dfe83f850eea9a5f7470427` | Dual License |
| pytz / `pytz-2026.2-py2.py3-none-any.whl` | 2026.2 | 510,141 | `04156e608bee23d3792fd45c94ae47fae1036688e75032eea2e3bf0323d1f126` | MIT |
| regex / `regex-2026.7.10-cp314-cp314-win_amd64.whl` | 2026.7.10 | 280,796 | `2129e4a5e86f26926982d883dff815056f2e98220fdf630e59f961b578a26c43` | Apache-2.0 AND CNRI-Python |
| six / `six-1.17.0-py2.py3-none-any.whl` | 1.17.0 | 11,050 | `4721f391ed90541fddacab5acf947aa0d3dc7d27b2e1e8eda2be8970586c3274` | MIT |
| tld / `tld-0.13.2-py2.py3-none-any.whl` | 0.13.2 | 296,743 | `9b8fdbdb880e7ba65b216a4937f2c94c49a7226723783d5838fc958ac76f4e0c` | MPL-1.1 OR GPL-2.0-only OR LGPL-2.1-or-later |
| trafilatura / `trafilatura-2.1.0-py3-none-any.whl` | 2.1.0 | 134,600 | `0eded5207a806445ddebbe36eae30b9035fe6a2f233c36f6fe82663fca8b9d30` | Apache-2.0 |
| tzdata / `tzdata-2026.3-py2.py3-none-any.whl` | 2026.3 | 348,168 | `dc096730c87af6cab1b171c9d532be840741ff5d459015e7f6947bd7d7e54931` | Apache-2.0 |
| tzlocal / `tzlocal-5.4.4-py3-none-any.whl` | 5.4.4 | 18,115 | `aae09f0126a8a86fa736be266eb4a471380d26a0de3bc14844e7821fee3e2a15` | MIT |
| urllib3 / `urllib3-2.7.0-py3-none-any.whl` | 2.7.0 | 131,087 | `9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897` | MIT |

Direct dependency relationships were read from wheel METADATA: Trafilatura pulls
certifi, charset-normalizer, courlan, htmldate, jusText, lxml, and urllib3; their
transitive requirements produce the remaining set. Native code appears in lxml,
charset-normalizer, and regex. The disjunctive `tld` expression requires business/
legal interpretation. The mandatory classification is therefore:

```text
TRAFILATURA DEPENDENCY SET REQUIRES LICENCE REVIEW
```

No final Trafilatura wheelhouse, lock, requirements file, environment, install, or
adapter was created. Resolver wheels remain ignored evidence only.
