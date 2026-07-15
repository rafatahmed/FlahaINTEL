<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Bounded HTML Resource Results
Introduction:
Records generated-page process measurements and their measurement limitations.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-16
-->

# Bounded HTML resource results

Ignored generated pages of 5,462 bytes (100 paragraphs) and 142,862 bytes (2,500
paragraphs) were processed successfully by all three candidates. Wall times were:

| Candidate | Small | Medium |
| --- | ---: | ---: |
| stdlib HTMLParser | 1.215 s | 1.171 s |
| lxml 6.1.1 | 1.127 s | 1.162 s |
| selectolax Lexbor 0.4.10 | 1.141 s | 1.111 s |

The Windows sampler returned no reliable CPU or peak-working-set values, so memory
and CPU evidence are pending. Wall figures include interpreter start, adapter work,
and sampler overhead; they cannot rank parser speed. The 10 MiB maximum,
large-table, structured-data-heavy, and deepest process-safety tiers were not run
because reliable memory termination is not yet present. Generated pages and raw
results remain ignored.

The accepted resource-evidence classification is therefore `LIMITED`.

An initial medium run blocked because the helper waited for a child blocked writing
a large captured JSON document. Only its benchmark-created PIDs 16080 and 17580 were
terminated. Adapters now support bounded summary output, and the successful rerun
left no benchmark-created process.
