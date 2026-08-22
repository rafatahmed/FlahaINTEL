/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Runtime binary path tests
 * Introduction: Isolated workers only receive absolute Playwright paths from the host env.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-22
 * Last modified: 2026-08-22
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { absoluteEnvPath, playwrightWorkerEnv } from "./runtimeBins.js";

describe("playwrightWorkerEnv", () => {
  it("copies only absolute Playwright paths", () => {
    const chromium = path.resolve("/opt/flahaintel/runtimes/ms-playwright/chrome-headless-shell");
    const env = playwrightWorkerEnv({
      PLAYWRIGHT_CHROMIUM_PATH: chromium,
      PLAYWRIGHT_BROWSERS_PATH: "relative/ms-playwright",
      PLAYWRIGHT_MODULE: "",
      HOME: "/var/lib/flahaintel",
    });
    expect(env.PLAYWRIGHT_CHROMIUM_PATH).toBe(chromium);
    expect(env.PLAYWRIGHT_BROWSERS_PATH).toBeUndefined();
    expect(env.PLAYWRIGHT_MODULE).toBeUndefined();
  });

  it("rejects relative paths", () => {
    expect(absoluteEnvPath("ms-playwright/chrome")).toBeUndefined();
    expect(absoluteEnvPath("")).toBeUndefined();
  });
});
