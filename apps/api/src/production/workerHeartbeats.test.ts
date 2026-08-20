/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Worker Heartbeat PID Liveness Tests
 * Introduction: Distinguishes a live process from a reused or missing heartbeat PID.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-20
 * Last modified: 2026-08-20
 */
import { describe, expect, it } from "vitest";
import { pidExists } from "./workerHeartbeats.js";

describe("pidExists", () => {
  it("treats the current process as live", () => {
    expect(pidExists(process.pid)).toBe(true);
  });

  it("rejects non-positive pids", () => {
    expect(pidExists(0)).toBe(false);
    expect(pidExists(-1)).toBe(false);
  });

  it("treats an unused pid as dead", () => {
    expect(pidExists(2_147_483_647)).toBe(false);
  });
});
