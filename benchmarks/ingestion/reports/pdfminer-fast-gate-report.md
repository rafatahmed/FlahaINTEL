<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: pdfminer.six Arabic-First Fast-Gate Report
Introduction:
Records artifact integrity, isolated installation, and the decisive Arabic rejection.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# pdfminer.six Arabic-first fast-gate report

## Artifact and isolated installation

The current stable release reviewed from official PyPI metadata was
`pdfminer.six 20260107`, released 2026-01-07 under MIT with Python `>=3.10`.
The pure `pdfminer_six-20260107-py3-none-any.whl` is 6,592,252 bytes with
SHA-256 `366585ba97e80dffa8f00cebe303d2f381884d8637af4ce422f1df3ef38111a9`.

The binary-only Python 3.14 Windows graph contained five reviewed wheels:
pdfminer.six 20260107, charset-normalizer 3.4.9, cryptography 49.0.0, cffi
2.1.0, and pycparser 3.0. Their licences are MIT, MIT, Apache-2.0 OR
BSD-3-Clause, MIT-0, and BSD-3-Clause respectively. Pillow and other optional
extras were excluded. No sdist or source compilation was used.

The separate isolated environment passed `pip check`, imported pdfminer from
its own site-packages, disabled user and system site, contained no external
`.pth`, and had the exact five packages plus pip 25.2. The environment measured
34,922,969 bytes and its five-wheel wheelhouse measured 10,801,183 bytes. No
listener or surviving child process was created. Production registration is
not authorized.

## Arabic-first result

Fixture: governed `documents/ar-simple.pdf`.

Expected logical Arabic:

```text
اختبار عربي
تحسين كفاءة المياه يدعم الزراعة.
```

Exact extracted text:

```text
(cid:1575)(cid:1582)(cid:1578)(cid:1576)(cid:1575)(cid:1585)(cid:32)(cid:1593)(cid:1585)(cid:1576)(cid:1610)

(cid:1578)(cid:1581)(cid:1587)(cid:1610)(cid:1606)(cid:32)(cid:1603)(cid:1601)(cid:1575)(cid:1569)(cid:1577)(cid:32)(cid:1575)(cid:1604)(cid:1605)(cid:1610)(cid:1575)(cid:1607)(cid:32)(cid:1610)(cid:1583)(cid:1593)(cid:1605)(cid:32)(cid:1575)(cid:1604)(cid:1586)(cid:1585)(cid:1575)(cid:1593)(cid:1577)(cid:46)
```

The output contains ASCII CID placeholders rather than Arabic Unicode code
points. Required span `الزراعة` is absent. Classification:
`ARABIC_UNDECODABLE_GLYPHS`.

```text
PDFMINER ARABIC GATE: FAIL
```

The bilingual gate, offline reconstruction, corpus expansion, full correctness
benchmark, and resource benchmark were not performed after this mandatory
failure. General document text extraction is **REJECT**. The narrow artifacts
remain uncommitted for separate authorization.
