<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: HTML Extraction Security Boundary Report
Introduction:
Records trust-boundary controls, probes, exclusions, and residual limitations.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# HTML extraction security boundary report

The benchmark reads only an internally selected corpus root plus a relative artifact
key. It rejects absolute POSIX and Windows paths, UNC/device paths, traversal,
Windows ADS, reserved device components, unsupported suffixes, symlinks/reparse
points, containment escapes, missing files, and inputs over 10 MiB before parsing.
Raw bytes remain unchanged.

The supervisor accepts a closed candidate enum and artifact key. It uses an argument
array with `shell=False`, supplies a minimal environment without `DATABASE_URL`, and
passes no URL, root, import name, callable, browser option, database connection, or
shell input. All candidates processed HTTP, relative, JavaScript, and mail links
without resolving or fetching them; link results retain source spelling and a null
resolved form.

The stdlib and Lexbor adapters import no network, browser, database, subprocess, or
shell facility. The lxml surface is limited to `lxml.html.HTMLParser` with
`no_network=True`, `huge_tree=False`, and controlled recovery. The adapter exposes
no XML parser, resolver, entity, DTD, XInclude, XSLT, or HTML-cleaner API. None of
the adapters executes JavaScript, loads subresources, creates persistent state,
writes artifacts, starts a listener, or launches a child process.

Security tests passed for unsafe keys, minimal environment, forbidden source APIs,
null link resolution, and unchanged bindability of ports 3003 and 5174. Candidate
processes exited and the unrelated Python 3.10 process was not touched. During
resource-harness development, two hung Python 3.14 benchmark processes (PIDs 16080
and 17580) were specifically terminated; bounded summary output fixed the harness.

These are application-level controls, not an OS network sandbox. `no_network=True`
does not prove kernel-level egress denial, native parsers remain attack surfaces, and
wall-clock/memory termination belongs to the future production supervisor. No
production security approval follows from this benchmark.
