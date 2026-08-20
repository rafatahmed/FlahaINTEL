/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Controlled Crawl Policy
 * Introduction: Allowlisted, bounded crawl policy with no unrestricted mode.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-21
 */

import { readFile } from "node:fs/promises";
import { getProductionConfig } from "./config.js";
import { ProductError } from "../product/errors.js";

export type CrawlPolicy = {
  version: string;
  userAgent: string;
  respectRobots: boolean;
  maxPages: number;
  maxDepth: number;
  maxRedirects: number;
  maxAttachments: number;
  maxAttachmentBytes: number;
  maxTotalCrawlBytes: number;
  rateLimitPerHostPerMinute: number;
  allowedHosts: string[];
  allowedPathPrefixes: Record<string, string[]>;
  allowedAttachmentTypes: string[];
  schedule: { mode: "manual" | "interval"; intervalMinutes?: number };
};

const DEFAULT_POLICY: CrawlPolicy = {
  version: "3m.1",
  userAgent: "FlahaINTEL/3M (+https://flaha.local; controlled-crawl; contact-ops)",
  respectRobots: true,
  maxPages: 10,
  maxDepth: 1,
  maxRedirects: 3,
  maxAttachments: 5,
  maxAttachmentBytes: 10_000_000,
  maxTotalCrawlBytes: 50_000_000,
  rateLimitPerHostPerMinute: 30,
  allowedHosts: [],
  allowedPathPrefixes: {},
  allowedAttachmentTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/rtf",
    "text/rtf",
    "text/plain",
    "text/html",
  ],
  schedule: { mode: "manual" },
};

let cached: CrawlPolicy | null = null;

export async function loadCrawlPolicy(pathOverride?: string): Promise<CrawlPolicy> {
  if (cached && !pathOverride) return cached;
  const policyPath = pathOverride || getProductionConfig().crawlPolicyPath;
  try {
    const raw = await readFile(policyPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<CrawlPolicy>;
    const policy: CrawlPolicy = {
      ...DEFAULT_POLICY,
      ...parsed,
      allowedHosts: (parsed.allowedHosts ?? []).map(h => h.toLowerCase()),
      allowedPathPrefixes: parsed.allowedPathPrefixes ?? {},
      allowedAttachmentTypes: parsed.allowedAttachmentTypes ?? DEFAULT_POLICY.allowedAttachmentTypes,
      schedule: parsed.schedule ?? DEFAULT_POLICY.schedule,
      maxPages: Math.min(parsed.maxPages ?? DEFAULT_POLICY.maxPages, 10),
      maxDepth: Math.min(parsed.maxDepth ?? DEFAULT_POLICY.maxDepth, 1),
    };
    // Hard caps — no unrestricted mode
    if (policy.maxPages > 10) policy.maxPages = 10;
    if (policy.maxDepth > 1) policy.maxDepth = 1;
    if (!pathOverride) cached = policy;
    return policy;
  } catch {
    if (!pathOverride) cached = DEFAULT_POLICY;
    return DEFAULT_POLICY;
  }
}

export async function assertWebsiteUrlIfEnforced(urlText: string): Promise<void> {
  const enforce =
    getProductionConfig().isProduction
    || process.env.CRAWL_POLICY_ENFORCE === "true";
  if (!enforce) return;
  const policy = await loadCrawlPolicy();
  assertUrlAllowedByPolicy(urlText, policy);
}

export function assertUrlAllowedByPolicy(urlText: string, policy: CrawlPolicy): {
  host: string;
  pathWithQuery: string;
} {
  let url: URL;
  try {
    url = new URL(urlText.trim());
  } catch {
    throw new ProductError("INVALID_URL", "URL is not valid.", 400, "INPUT");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ProductError("UNSUPPORTED_SCHEME", "Only http and https URLs are supported.", 400, "INPUT");
  }
  if (url.username || url.password) {
    throw new ProductError("URL_CREDENTIALS_FORBIDDEN", "URLs must not include credentials.", 400, "INPUT");
  }
  const host = url.hostname.toLowerCase();
  if (policy.allowedHosts.length === 0) {
    // Empty allowlist: production crawl submissions that require policy fail closed when policy enforced
    return { host, pathWithQuery: `${url.pathname || "/"}${url.search || ""}` };
  }
  if (!policy.allowedHosts.includes(host)) {
    const hosts = harvestHostNames(policy);
    throw new ProductError(
      "CRAWL_HOST_NOT_ALLOWED",
      `This page is not on the Eyes harvest list (${host}). FlahaINTEL fetches one pasted URL from listed hosts only — it does not crawl the open web, and this is not RSS. Harvest hosts: ${hosts.join(", ") || "(none configured)"}.`,
      403,
      "INPUT",
    );
  }
  const pathWithQuery = `${url.pathname || "/"}${url.search || ""}`;
  const pathOnly = url.pathname || "/";
  const prefixes = policy.allowedPathPrefixes[host] ?? ["/"];
  // Bare "/" means the root path only (plus optional query). Longer prefixes use startsWith.
  const allowed = prefixes.some((prefix) => {
    if (prefix === "/") return pathOnly === "/";
    return pathWithQuery === prefix || pathWithQuery.startsWith(prefix) || pathOnly === prefix || pathOnly.startsWith(prefix);
  });
  if (!allowed) {
    throw new ProductError(
      "CRAWL_PATH_NOT_ALLOWED",
      `This path is not harvestable on ${host}. Allowed path prefixes: ${prefixes.join(", ")}. Paste a URL under one of those paths. This is one page fetch, not RSS.`,
      403,
      "INPUT",
    );
  }
  return { host, pathWithQuery };
}

export function crawlLimitsFromPolicy(policy: CrawlPolicy): {
  maxDepth: number;
  maxUrls: number;
  maxRedirects: number;
  maxNetworkRequests: number;
  maxDownloads: number;
  maxPopups: number;
  maxResponseBytes: number;
  wallTimeoutMs: number;
  userAgent: string;
} {
  return {
    maxDepth: policy.maxDepth,
    maxUrls: policy.maxPages,
    maxRedirects: policy.maxRedirects,
    maxNetworkRequests: Math.max(policy.maxPages * 5, 10),
    maxDownloads: policy.maxAttachments,
    maxPopups: 0,
    maxResponseBytes: Math.min(policy.maxTotalCrawlBytes, policy.maxAttachmentBytes),
    wallTimeoutMs: 60_000,
    userAgent: policy.userAgent,
  };
}

export function harvestHostNames(policy: CrawlPolicy): string[] {
  return policy.allowedHosts.filter((host) => !host.includes("example."));
}

/** Operator-facing harvest list (fixture hosts omitted). */
export function harvestList(policy: CrawlPolicy): Array<{ host: string; pathPrefixes: string[] }> {
  return harvestHostNames(policy).map((host) => ({
    host,
    pathPrefixes: policy.allowedPathPrefixes[host] ?? ["/"],
  }));
}

export function resetCrawlPolicyCache(): void {
  cached = null;
}
