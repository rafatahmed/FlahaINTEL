import { describe, expect, it } from "vitest";
import { fixture, owner } from "./testUtils.js";

async function* chunks(...values: string[]) { for (const value of values) yield Buffer.from(value); }

describe("bounded streaming writes", () => {
  it("writes an empty artifact without buffering", async () => {
    const f = await fixture();
    try {
      await f.store.allocate({ artifactId: "empty", ...owner, maximumBytes: 0 });
      const result = await f.store.write("empty", owner, chunks());
      expect(result).toMatchObject({ state: "SEALED", byteLength: 0, checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" });
    } finally { await f.cleanup(); }
  });

  it("accepts an exact boundary-size artifact", async () => {
    const f = await fixture();
    try {
      await f.store.allocate({ artifactId: "boundary", ...owner, maximumBytes: 5 });
      expect(await f.store.write("boundary", owner, chunks("12", "345"))).toMatchObject({ state: "SEALED", byteLength: 5 });
    } finally { await f.cleanup(); }
  });

  it("abandons a partial file when the stream exceeds its limit", async () => {
    const f = await fixture();
    try {
      await f.store.allocate({ artifactId: "large", ...owner, maximumBytes: 4 });
      await expect(f.store.write("large", owner, chunks("123", "45"))).rejects.toMatchObject({ code: "ARTIFACT_SIZE_LIMIT_EXCEEDED" });
      expect(await f.store.metadata("large")).toMatchObject({ state: "ABANDONED", checksum: null });
    } finally { await f.cleanup(); }
  });

  it("abandons an interrupted stream and retains bounded diagnostics", async () => {
    const f = await fixture();
    async function* interrupted() { yield Buffer.from("partial"); throw new Error("stream interrupted"); }
    try {
      await f.store.allocate({ artifactId: "interrupted", ...owner, maximumBytes: 100 });
      await expect(f.store.write("interrupted", owner, interrupted())).rejects.toThrow("stream interrupted");
      expect(await f.store.metadata("interrupted")).toMatchObject({ state: "ABANDONED", byteLength: 7, diagnostic: "stream interrupted" });
    } finally { await f.cleanup(); }
  });
});
