# Emergency shutdown

1. Stop Caddy public listener or block firewall.
2. Stop all worker units.
3. Stop API.
4. Leave PostgreSQL up unless compromise requires isolation.
5. Snapshot disks; preserve logs for forensics.
