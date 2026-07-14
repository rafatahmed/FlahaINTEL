import { describe, expect, it } from "vitest";
import { articleFingerprint, normalizeUrl } from "./rss.js";

describe("RSS article identity", () => {
  it("removes tracking parameters and fragments", () => {
    expect(normalizeUrl("https://example.com/story?id=2&utm_source=rss#top"))
      .toBe("https://example.com/story?id=2");
  });

  it("gives equivalent tracked URLs the same fingerprint", () => {
    const plain = articleFingerprint({ link: "https://example.com/story?id=2" });
    const tracked = articleFingerprint({ link: "https://example.com/story?id=2&utm_medium=feed" });
    expect(tracked).toBe(plain);
  });

  it("falls back to a GUID when no link exists", () => {
    expect(articleFingerprint({ guid: "item-42" })).toHaveLength(64);
  });
});

