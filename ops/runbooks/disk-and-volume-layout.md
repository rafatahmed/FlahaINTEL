<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Disk and Volume Layout Runbook
Introduction:
Operator guidance for placing artifacts, backups, and runtimes so the system volume does not fill.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Disk and volume layout (Windows)

**Goal:** Keep FlahaINTEL usable. Artifact growth and backups must not fill the OS drive (C:).

## Recommended layout

| Role | Example path | Notes |
|------|----------------|-------|
| Application code | `C:\Users\...\FlahaINTEL` or install dir | Source + node_modules only |
| Artifacts | **Separate volume** e.g. `D:\flahaintel\artifacts` | Set `ARTIFACT_STORE_ROOT` / `FLAHA_ARTIFACT_ROOT` |
| State | Same volume as artifacts e.g. `D:\flahaintel\state` | `FLAHA_STATE_DIR` (sessions, last-backup marker) |
| Local backups | e.g. `D:\flahaintel\backups` | `FLAHA_BACKUP_ROOT` |
| Off-host copy | Network share / second disk / cloud vault | Required for RPO; not only under repo |
| Runtimes / browsers | Prefer non-system if large | Already under `.benchmark-*` / ms-playwright |

## Minimum free space

| Volume | Target |
|--------|--------|
| OS (C:) | ≥ **15%** free (absolute minimum ≥ 10 GB) |
| Artifact volume | ≥ **15%** free; block submissions below app `DISK_BLOCK_FREE_RATIO` |
| Backup volume | Space for ≥ **7** daily backups + dump growth |

## Operator actions when space is low

1. Run `ops/scripts/check-free-space.ps1`
2. Follow [disk-full.md](./disk-full.md)
3. Move `ARTIFACT_STORE_ROOT` and `FLAHA_BACKUP_ROOT` off C: if they still live under the repo
4. Purge old local backup stamps after off-host copy is confirmed
5. Do **not** delete ArtifactStore promoted content without reconciliation + approval

## Config reminder

See `ops/config/production.env.example`. Development may use repo-relative `.flaha-artifacts-prod` only when disk is healthy.
