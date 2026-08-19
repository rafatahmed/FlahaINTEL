/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Metadata Precedence Tests
 * Introduction: Common HTML meta keys and acquisition locator reconstruction.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-19
 */
import { describe, expect, it } from "vitest";
import { locatorToUrl } from "./inputResolution.js";
import { selectMetadata } from "./metadataPrecedence.js";

describe("metadata precedence", () => {
  it("reads article:published_time and article:author from metadata maps", () => {
    const selected = selectMetadata({
      result: {},
      metadata: {
        metadata: {
          "article:published_time": "2026-07-02T11:00:00+02:00",
          "article:author": "Maria Gabrielsen",
          "og:url": "https://www.yara.com/corporate-releases/example/",
        },
      },
      acquisitionMetadata: null,
      governedSourceMetadata: null,
      resultArtifactId: "res",
      metadataArtifactId: "meta",
    });
    expect(selected.publicationDate.value).toContain("2026-07-02");
    expect(selected.authors.value).toEqual(["Maria Gabrielsen"]);
    expect(selected.canonicalSourceLocator.value).toBe("https://www.yara.com/corporate-releases/example/");
  });

  it("uses the acquisition locator URL when page metadata has no canonical", () => {
    const selected = selectMetadata({
      result: {},
      metadata: {},
      acquisitionMetadata: {
        url: "https://www.yara.com/corporate-releases/yara-acquires-gulf-coast-ammonia-plant/",
        finalUrl: "https://www.yara.com/corporate-releases/yara-acquires-gulf-coast-ammonia-plant/",
      },
      governedSourceMetadata: null,
      resultArtifactId: "res",
      metadataArtifactId: null,
    });
    expect(selected.canonicalSourceLocator.value).toContain("yara.com/corporate-releases/");
    expect(selected.finalAcquiredLocator.value).toContain("yara.com/corporate-releases/");
  });
});

describe("locatorToUrl", () => {
  it("rebuilds https locators from governed parts", () => {
    expect(
      locatorToUrl({
        scheme: "https",
        host: "www.yara.com",
        port: 443,
        relativeRoute: "/corporate-releases/yara-acquires-gulf-coast-ammonia-plant/",
      }),
    ).toBe("https://www.yara.com/corporate-releases/yara-acquires-gulf-coast-ammonia-plant/");
  });
});
