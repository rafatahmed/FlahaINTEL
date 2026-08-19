/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Crawl Policy Tests
 * Introduction: Allowlist enforcement and hard caps for controlled crawls.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-19
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertUrlAllowedByPolicy, crawlLimitsFromPolicy, type CrawlPolicy } from "./crawlPolicy.js";

const policy: CrawlPolicy = {
  version: "test",
  userAgent: "FlahaINTEL/3M-test",
  respectRobots: true,
  maxPages: 10,
  maxDepth: 1,
  maxRedirects: 3,
  maxAttachments: 5,
  maxAttachmentBytes: 1_000_000,
  maxTotalCrawlBytes: 5_000_000,
  rateLimitPerHostPerMinute: 10,
  allowedHosts: ["example.com"],
  allowedPathPrefixes: { "example.com": ["/", "/docs", "/public"] },
  allowedAttachmentTypes: ["text/html", "application/pdf"],
  schedule: { mode: "manual" },
};

describe("crawl policy", () => {
  it("allows approved host and path", () => {
    const result = assertUrlAllowedByPolicy("https://example.com/docs/a", policy);
    expect(result.host).toBe("example.com");
    expect(assertUrlAllowedByPolicy("https://example.com/", policy).pathWithQuery).toBe("/");
  });

  it("rejects off-allowlist host", () => {
    expect(() => assertUrlAllowedByPolicy("https://evil.example/x", policy)).toThrow(/not on the controlled crawl allowlist/i);
  });

  it("rejects disallowed path prefix", () => {
    expect(() => assertUrlAllowedByPolicy("https://example.com/private", policy)).toThrow(/Path is not on the controlled crawl allowlist/i);
  });

  it("allows the Yara corporate-releases prefix from the shipped policy", () => {
    const raw = JSON.parse(
      readFileSync(path.resolve(import.meta.dirname, "../../../../ops/config/crawl-policy.json"), "utf8"),
    ) as CrawlPolicy;
    expect(() =>
      assertUrlAllowedByPolicy(
        "https://www.yara.com/corporate-releases/yara-acquires-gulf-coast-ammonia-plant/",
        raw,
      ),
    ).not.toThrow();
    expect(() => assertUrlAllowedByPolicy("https://www.yara.com/about/", raw)).toThrow(/Path is not/i);
  });

  it("caps limits", () => {
    const limits = crawlLimitsFromPolicy(policy);
    expect(limits.maxUrls).toBeLessThanOrEqual(10);
    expect(limits.maxDepth).toBeLessThanOrEqual(1);
    expect(limits.userAgent).toContain("FlahaINTEL");
  });
});
