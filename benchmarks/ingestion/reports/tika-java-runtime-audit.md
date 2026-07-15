<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Apache Tika and Java Runtime Audit
Introduction:
Records provenance and the bounded one-shot architecture for a future Tika evaluation.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# Apache Tika and Java runtime audit

## Tika artifact provenance

The latest stable release is Apache Tika 3.3.1, released 2026-05-26 under
Apache-2.0. The preferred application artifact is
`tika-app-3.3.1.jar`, published through Apache mirrors:

- byte size: 65,460,062;
- SHA-512:
  `33fc9b566368273607ec997518760e0ae34953169a6b82aca5a45347546002df92dda0cc2205e6f0ba1b093e47b6fc1373d587be18a224657d961a22fc26acc2`;
- PGP `.asc` signature: published;
- Apache KEYS and SHA-512 sidecars: published;
- Java requirement: Tika 3.x requires Java 11 or newer.

The Tika Server artifacts are not authorized. `tika-app` standard CLI mode can
parse one file to stdout and exit without a listener. URL, GUI, Pipes, server,
gRPC, fetcher, emitter, and directory modes must be excluded.

## Portable Java candidate

The runtime candidate is Eclipse Temurin JRE 21.0.11+10 LTS, HotSpot,
Windows x64:

- archive: `OpenJDK21U-jre_x64_windows_hotspot_21.0.11_10.zip`;
- byte size: 49,005,708;
- SHA-256: `be26677aaa20b39a62edcaab4c8857a8b76673b0f45abc0b6143b142b62717e4`;
- licence: GPLv2 with the Classpath Exception;
- portable archive: yes; no installer or system PATH modification required;
- upstream update cadence: quarterly security/maintenance releases;
- Temurin Java 21 community availability: at least December 2029.

The future runtime must be extracted below a candidate-specific ignored path
and invoked by its exact `java.exe`; it must not modify system Java settings.
Neither Java nor Tika was downloaded during this audit.

## Required inventory and security review

Before installation authorization, the exact JAR must be verified with both
SHA-512 and PGP, then inventoried as an archive/SBOM. The review must enumerate
every contained component and licence, including exact PDFBox, Apache POI,
commons-compress/archive, XML, image/media, Bouncy Castle, and logging versions;
scan the resulting SBOM against current CVE sources; and compare findings with
Apache Tika security advisories. This exact contained-library and CVE review is
not yet complete.

The initial parser allowlist must admit only PDF, DOCX, PPTX, RTF, and plain
text. XLSX may be gated only as a fallback comparison. All other media types
and parsers must fail closed. TesseractOCRParser, external-process parsers,
network/fetcher parsers, executables, archives, mail, database, Pipes, and
plugins must be explicitly excluded. Macro and embedded extraction must be
disabled or tightly inventoried rather than executed.

## One-shot architecture

Future execution must be:

```text
fixed portable java.exe
→ fixed -Xms/-Xmx and stack size
→ private per-run temp directory
→ fixed verified tika-app-3.3.1.jar
→ fixed parser allowlist configuration
→ one governed local artifact
→ bounded stdout or controlled staging file
→ process exit and process-tree cleanup
```

The supervisor must enforce wall timeout, heap, stack, output bytes, page
count, embedded depth/count, decompression ratio, temporary disk, child-process
denial, environment sanitization, no external executables, OS-level network
denial, and cleanup verification. No listener, server, daemon, shared temp
directory, caller-selected URL, or caller-selected configuration is permitted.

## Decision

Runtime provenance is identified and the portable one-shot design is viable,
but the exact JAR SBOM, parser configuration, CVE inventory, and runtime
redistribution review have not been completed.

```text
TIKA RUNTIME REQUIRES TECHNICAL REVIEW
```

No Java runtime, Tika JAR, `.benchmark-runtime/`, lock file, or production
registration was created.
