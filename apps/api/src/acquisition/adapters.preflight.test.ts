/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Browser runtime preflight tests
 * Introduction: JavaScript acquisition must fail closed when Chromium is missing, without launching Playwright.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-22
 * Last modified: 2026-08-22
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { missingBrowserRuntime } from "./adapters.js";

describe("missingBrowserRuntime", () => {
  it("fails closed in production when Chromium path is unset", async () => {
    const result = await missingBrowserRuntime({ NODE_ENV: "production" });
    expect(result).toMatchObject({ outcome: "FAILED", code: "BROWSER_RUNTIME_MISSING", retryable: false });
  });

  it("fails closed when the configured Chromium binary does not exist", async () => {
    const missing = path.resolve("/opt/flahaintel/runtimes/ms-playwright/does-not-exist");
    const result = await missingBrowserRuntime({ PLAYWRIGHT_CHROMIUM_PATH: missing });
    expect(result).toMatchObject({ outcome: "FAILED", code: "BROWSER_RUNTIME_MISSING" });
    expect(result?.message).toContain(missing);
  });

  it("does not block local tests when Chromium path is unset", async () => {
    expect(await missingBrowserRuntime({ NODE_ENV: "test" })).toBeNull();
  });
});
