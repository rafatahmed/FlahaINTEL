<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Apache Tika 3.3.1 Contained-Library Inventory
Introduction:
Records the bounded dependency and parser review for the approved document surface.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# Apache Tika 3.3.1 contained-library inventory

Artifact: `tika-app-3.3.1.jar`, 65,460,062 bytes, SHA-512
`33fc9b566368273607ec997518760e0ae34953169a6b82aca5a45347546002df92dda0cc2205e6f0ba1b093e47b6fc1373d587be18a224657d961a22fc26acc2`.
The shaded JAR contains 114 Maven property/licence/notice records. Versions below
come from its embedded `META-INF/DEPENDENCIES` and Maven metadata.

| Area | Contained components | Licence | Approved use |
|---|---|---|---|
| Tika | core, PDF, Microsoft, miscellaneous-office, text parsers 3.3.1 | Apache-2.0 | PDF, DOCX, PPTX, RTF, TXT |
| PDF | PDFBox, FontBox, pdfbox-io/tools, XmpBox 3.0.7; JBIG2 ImageIO 3.0.5; JempBox 1.8.17 | Apache-2.0 | PDF only |
| Office | Apache POI, poi-ooxml, full schemas, scratchpad 5.5.1; XMLBeans 5.3.0 | Apache-2.0 | DOCX, PPTX, RTF |
| Archives | Commons Compress 1.28.0; junrar 7.6.0; XZ 1.12; Brotli 0.1.2 | Apache-2.0 / UnRAR / public-domain-like | Package mechanics only; generic archive parsing excluded |
| XML | Jakarta XML Bind 4.0.5; JAXB core/runtime/TXW2 4.0.8; JDK XML stack | EPL-2.0/GPL-2.0 with Classpath Exception and related notices | OOXML internals only |
| Images/media | metadata-extractor 2.20.0; jai-imageio-core 1.4.0; JBIG2 3.0.5; audio/video parser modules 3.3.1 | Apache-2.0/BSD-family | Embedded rendering support only; media parser surface excluded |
| External process | Commons Exec 1.6.0; Tika OCR module 3.3.1 | Apache-2.0 | Excluded; no external executable or OCR configuration |
| Logging | Log4j core/API/SLF4J bridge 2.26.0 | Apache-2.0 | Local bounded diagnostics |

The JAR also contains Apple, audio/video, CAD, code, crypto, font, HTML, image,
mail, news, OCR, package/archive, WARC, XML, language-detection, batch, async,
emitter and serialization modules. They are outside the approved benchmark
surface. The explicit parser allowlist is the enforcement point; JAR presence is
not authorization.

Relevant published advisories reviewed on 2026-07-16:

- Tika XFA/PDF XXE CVE-2025-54988/CVE-2025-66516 affects releases through
  3.2.1; 3.3.1 is outside the published range.
- Commons Compress 1.28.0 is newer than fixes for CVE-2023-42503,
  CVE-2024-25710 and CVE-2024-26308. Generic archive parsing remains excluded.
- POI advises separate-process parsing, heap limits and private temp storage for
  untrusted documents. The one-shot supervisor follows that guidance.
- Parser vulnerabilities and unknown defects remain possible. This inventory
  supports the allowlist and is not a claim that Tika is a security boundary.
