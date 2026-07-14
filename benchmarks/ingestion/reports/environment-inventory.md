<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Phase 3E Environment Inventory
Introduction:
Records the redacted benchmark host and detected candidate prerequisites.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Environment inventory

Inventory date: 2026-07-15. Usernames and absolute user paths are omitted.

| Item | Detection |
| --- | --- |
| Operating system | Microsoft Windows 11 Pro, 64-bit, build 10.0.26200 |
| CPU | 11th Gen Intel Core i7-1165G7 at 2.80 GHz |
| Logical cores | 8 |
| RAM | 16,885,276,672 bytes total; 7,290,294,272 bytes available during audit |
| Disk | 301,055,602,688 bytes total; approximately 6.0 GB free during baseline inventory |
| Node | v24.4.1 |
| npm | 11.6.2 in interactive audit; sanitized subprocess reported 11.4.2, requiring reconciliation before candidate runs |
| Python | CPython 3.14.0, explicitly configured executable redacted in results |
| Java | Not installed/discoverable |
| Tesseract | Not installed/discoverable |
| Arabic Tesseract data | Not installed |
| Docker | Not installed/discoverable; not required |
| ImageMagick | 7.1.1-34 available, inventory-only |
| pdftotext, qpdf, LibreOffice | Not installed/discoverable |
| Internet | Not tested; benchmark policy treated it as unavailable and used no network |

Relevant Python packages detected: pandas 2.3.3. Docling, Trafilatura,
PaddleOCR, Polars, PyArrow, and DuckDB were not installed. Apache Tika and
Tesseract command runtimes were absent. The global Python environment contains
other unrelated packages, but they were neither imported nor copied into results.

The portable standard-library inventory cannot measure total/available RAM, so
those fields are explicitly `null` in generated environment JSON. The values above
came from a separate read-only Windows CIM audit. No `DATABASE_URL` value or
ambient secret was copied.

Machine limitation: free disk is low for model-heavy engines and should be
reassessed before any approved Docling, OCR, Java/Tika, or multi-engine install.
