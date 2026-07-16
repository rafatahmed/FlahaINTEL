# Chromium failure

1. Confirm `PLAYWRIGHT_CHROMIUM_PATH` binary runs (`--version`).
2. Ensure browsers were preinstalled offline (no download during jobs).
3. Clear orphan Chromium processes.
4. Restart Playwright acquisition path; prefer static Scrapy when possible.
