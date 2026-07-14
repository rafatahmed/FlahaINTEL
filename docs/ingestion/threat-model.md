# FlahaINGEST threat model

## Assets and trust boundaries

Protected assets are source governance, PostgreSQL job/audit state, immutable raw evidence, normalized versions, analyst decisions, credentials, provider binaries/models, and local availability. Boundaries exist at external fetch, hostile artifact parsing, TypeScript-to-worker stdio, worker staging-to-artifact promotion, filesystem-to-database reconciliation, and processing-to-review.

Workers are untrusted processors. They are database-blind, receive a sanitized environment and scoped staging allocation, and have no approval authority.

## Threats, controls, and evidence

| Threat | Required controls | Verification |
| --- | --- | --- |
| SSRF | explicit scheme/host/port/path allowlists; reject credentials/private destinations | IPv4/IPv6 reserved-address fixtures |
| DNS rebinding | resolve immediately, reject any unsafe answer, pin connection | changed/mixed DNS-answer tests |
| Redirect abuse | revalidate every hop; bound redirects/bytes/time | cross-host, loop and scheme fixtures |
| Path traversal | relative keys plus resolved-root containment | encoded `..` and separator attacks |
| Windows ADS | reject colon in key components | `file.txt:stream` fixture |
| UNC/device paths | reject leading separators, drives and device namespaces | UNC, `C:\\`, `\\?\\`, `\\.\\` fixtures |
| Reserved devices | reject `CON`, `NUL`, `AUX`, `PRN`, `COM1-9`, `LPT1-9` components | case/extension variants |
| Symlinks/reparse points | inspect every component; no-follow; same-volume promotion | symlink/junction/reparse tests |
| Archive bombs | entry/depth/expanded-byte/ratio budgets | nested and high-ratio archives |
| Decompression bombs | separately bound compressed and decoded streams | gzip/deflate expansion fixtures |
| Malicious PDFs | no script/action/attachment execution; external resources off; object/page limits | malformed, encrypted, active PDFs |
| XML external entities | disable DTD and external entities | XXE/entity expansion fixtures |
| Browser subresource escape | policy-check every request; block downloads, sockets and unapproved hosts | script/image/font/websocket escapes |
| Worker compromise | low privilege, no DB credentials, scoped staging, process/memory/time limits | environment/filesystem escape tests |
| Binary/model tampering | exact versions and SHA-256 inventory; fail closed offline | modified binary/model fixtures |
| Log/secret leakage | structured bounded logs, redaction, no environment dumps | seeded token/cookie/URL tests |
| Disk exhaustion | per-job/global quotas, reserved promotion space, bounded logs | near-full disk simulation |
| Stale leases | heartbeat, expiry, fencing, attempt identity | killed/paused worker tests |
| Duplicate execution | idempotency/concurrency keys and single accepted fenced result | concurrent claim and late result tests |
| Partial promotion | staging, seal, verify, same-volume atomic move, manifest last | crash at each promotion point |
| DB/filesystem divergence | reconciliation, checksum audit, coordinated backup | orphan/missing/corrupt artifacts |

## Invariants and residual risk

Network denial is the default worker posture. Unknown protocol input fails closed. Workers cannot select final keys, overwrite raw evidence, update PostgreSQL, or approve content. Processing success remains separate from analyst review.

Residual risks include operating-system resolver behavior, administrator compromise, hardware/filesystem failure, antivirus locking, and the limits of application controls without a stronger OS sandbox. Later gates must document any changed residual risk.
