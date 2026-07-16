# Migration failure

1. Stop workers and API traffic (maintenance).
2. Capture `prisma migrate status` and error output (no secrets).
3. Restore from pre-migration backup if partial apply is unsafe.
4. Fix migration only on a new commit; never edit applied SQL in production.
5. Re-apply with migrator role after verification on a clone.
