/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Intake root path tests
 * Introduction: Production file land must not write under the git checkout.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-19
 */
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { intakeRoot } from "./service.js";

const keys = ["FLAHA_INTAKE_ROOT", "FLAHA_STATE_DIR", "ARTIFACT_STORE_ROOT", "FLAHA_ARTIFACT_ROOT"] as const;
const saved: Record<string, string | undefined> = {};

describe("intakeRoot", () => {
  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("prefers FLAHA_INTAKE_ROOT", () => {
    for (const key of keys) saved[key] = process.env[key];
    process.env.FLAHA_INTAKE_ROOT = "/var/lib/flahaintel/intakes";
    process.env.FLAHA_STATE_DIR = "/var/lib/flahaintel/state";
    expect(intakeRoot()).toBe("/var/lib/flahaintel/intakes");
  });

  it("falls back beside state dir, not the git checkout", () => {
    for (const key of keys) saved[key] = process.env[key];
    delete process.env.FLAHA_INTAKE_ROOT;
    process.env.FLAHA_STATE_DIR = "/var/lib/flahaintel/state";
    expect(intakeRoot()).toBe(path.join("/var/lib/flahaintel/state", "intakes"));
  });
});
