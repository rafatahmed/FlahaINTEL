# Artifact corruption

1. Run artifact reconciliation.
2. Quarantine mismatched checksums.
3. Restore affected artifacts from coordinated backup with matching DB snapshot.
4. Never expose filesystem paths to clients.
