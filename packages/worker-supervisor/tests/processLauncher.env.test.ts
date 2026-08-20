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
 * Last modified: 2026-08-19
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pickRuntimePathEnv } from "../src/processLauncher.js";

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
});
