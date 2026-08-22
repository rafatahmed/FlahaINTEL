<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Chromium failure
Introduction: Browser acquisition fails when Playwright cannot launch the pinned Chromium binary.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-08-22
-->

# Chromium failure

Symptom: `browserType.launch: Executable doesn't exist at …/ms-playwright/chromium_headless_shell-1228/…`.

The browser worker runs with an isolated environment. It only sees `PLAYWRIGHT_CHROMIUM_PATH`, `PLAYWRIGHT_BROWSERS_PATH`, and `PLAYWRIGHT_MODULE`. If those are unset, Playwright looks in the service-user cache (`/var/lib/flahaintel/.cache/ms-playwright`), not `/opt/flahaintel/runtimes/ms-playwright`.

1. Confirm the provisioned binary exists and runs:

   `ls -l "$PLAYWRIGHT_CHROMIUM_PATH" && "$PLAYWRIGHT_CHROMIUM_PATH" --version`

2. If missing, re-run `ops/scripts/linux/provision-runtimes.sh` (installs `chromium` and `chromium-headless-shell` under `/opt/flahaintel/runtimes/ms-playwright` and rewrites those env keys).

3. Restart the pipeline oneshot / API so workers inherit the new env. Do not resubmit the same URL until Chromium `--version` works.

4. Prefer static Scrapy (`STATIC_HTTP_ACQUISITION`) when the page does not require JavaScript. Chromium on the 2 GB droplet is for governed dynamic pages only.

5. Clear orphan Chromium processes if a previous launch leaked.
