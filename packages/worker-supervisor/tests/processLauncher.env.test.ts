/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Worker Runtime Path Env Tests
 * Introduction: Confirms only absolute runtime paths are copied into the isolated worker environment.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-22
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compactEnv, pickRuntimePathEnv } from "../src/processLauncher.js";

describe("pickRuntimePathEnv", () => {
  it("copies absolute runtime paths and ignores relative or missing values", () => {
    const java = path.resolve("/usr/bin/java");
    const picked = pickRuntimePathEnv({
      JAVA_BIN: java,
      TIKA_JAR: "relative/tika.jar",
      TIKA_ALLOWLIST: "",
      DATABASE_URL: "postgresql://forbidden",
    });
    expect(picked.JAVA_BIN).toBe(java);
    expect(picked.TIKA_JAR).toBeUndefined();
    expect(picked.TIKA_ALLOWLIST).toBeUndefined();
  });

  it("lets explicit supervisor overrides win when they are absolute", () => {
    const jar = path.resolve("/opt/flahaintel/runtimes/tika/tika-app-3.3.1.jar");
    const picked = pickRuntimePathEnv(
      { TIKA_JAR: path.resolve("/tmp/ignored.jar") },
      { TIKA_JAR: jar },
    );
    expect(picked.TIKA_JAR).toBe(jar);
  });

  it("copies absolute Playwright runtime paths into the isolated worker env", () => {
    const chromium = path.resolve("/opt/flahaintel/runtimes/ms-playwright/chrome-headless-shell");
    const browsers = path.resolve("/opt/flahaintel/runtimes/ms-playwright");
    const modulePath = path.resolve("/opt/flahaintel/runtimes/playwright/node_modules/playwright");
    const picked = pickRuntimePathEnv({
      PLAYWRIGHT_CHROMIUM_PATH: chromium,
      PLAYWRIGHT_BROWSERS_PATH: browsers,
      PLAYWRIGHT_MODULE: modulePath,
      HOME: "/var/lib/flahaintel",
    });
    expect(picked.PLAYWRIGHT_CHROMIUM_PATH).toBe(chromium);
    expect(picked.PLAYWRIGHT_BROWSERS_PATH).toBe(browsers);
    expect(picked.PLAYWRIGHT_MODULE).toBe(modulePath);
    expect(picked).not.toHaveProperty("HOME");
  });

  it("omits undefined runtime keys so spawn never receives empty path values", () => {
    const env = compactEnv({
      JAVA_BIN: path.resolve("/usr/bin/java"),
      PLAYWRIGHT_CHROMIUM_PATH: undefined,
      TIKA_JAR: "",
    });
    expect(env.JAVA_BIN).toBe(path.resolve("/usr/bin/java"));
    expect(env).not.toHaveProperty("PLAYWRIGHT_CHROMIUM_PATH");
    expect(env).not.toHaveProperty("TIKA_JAR");
  });
});

