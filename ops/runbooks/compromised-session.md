# Compromised session

1. Force logout (revokes session id).
2. Rotate `FLAHA_SESSION_SECRET` (invalidates all sessions).
3. Review auth failure metrics and access logs.
4. Re-issue membership access as needed.
