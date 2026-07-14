import { describe, expect, it } from "vitest";
import { ConfigurationError, loadConfig } from "./config.js";

describe("configuration", () => {
  it("uses the Phase 1.1 defaults", () => {
    const value = loadConfig({});
    expect(value).toMatchObject({
      port: 3003,
      schedulerEnabled: true,
      rssTimeoutMs: 15_000,
      rssMaxResponseBytes: 2_000_000,
      rssMaxRedirects: 5,
    });
  });

  it("prefers API_PORT and accepts an explicit disabled scheduler", () => {
    const value = loadConfig({ API_PORT: "4000", PORT: "5000", SCHEDULER_ENABLED: "false" });
    expect(value.port).toBe(4000);
    expect(value.schedulerEnabled).toBe(false);
  });

  it.each([
    ["API_PORT", "nope"],
    ["RSS_TIMEOUT_MS", "0"],
    ["RSS_MAX_RESPONSE_BYTES", "12.5"],
    ["RSS_MAX_REDIRECTS", "11"],
    ["SCHEDULER_ENABLED", "yes"],
    ["SCHEDULER_ENABLED", "TRUE"],
    ["COLLECTION_INTERVAL_MINUTES", ""],
  ])("fails fast for invalid %s", (name, value) => {
    expect(() => loadConfig({ [name]: value })).toThrow(ConfigurationError);
  });
});
