# Java / Tika failure

Document text extraction is Apache Tika only. Docling is rejected and is not a fallback.

1. Confirm env: `JAVA_BIN`, `TIKA_JAR`, `TIKA_ALLOWLIST` (absolute paths).
2. `java -version` and `java -jar $TIKA_JAR --help`.
3. Confirm the allowlist XML exists and is the repo parser allowlist.
4. Restart the extraction worker; quarantine bad inputs.
5. On the 2 GB host, leftover Docling trees may be deleted — see `small-host-update-and-migrate.md`.
