import { describe, expect, it } from "vitest";
import { fixture, owner } from "./testUtils.js";

async function* data() { yield Buffer.from("evidence"); }

describe("artifact lifecycle", () => {
  it("requires explicit initialization and rejects duplicate allocation", async () => {
    const f = await fixture();
    try {
      await f.store.allocate({ artifactId: "duplicate", ...owner, maximumBytes: 100 });
      await expect(f.store.allocate({ artifactId: "duplicate", ...owner, maximumBytes: 100 })).rejects.toMatchObject({ code: "ARTIFACT_EXISTS" });
    } finally { await f.cleanup(); }
  });

  it("guards sealing, writing after seal, and invalid promotion", async () => {
    const f = await fixture();
    try {
      await f.store.allocate({ artifactId: "guarded", ...owner, maximumBytes: 100 });
      await f.store.write("guarded", owner, data());
      await expect(f.store.seal("guarded", owner)).rejects.toMatchObject({ code: "INVALID_ARTIFACT_STATE" });
      await expect(f.store.write("guarded", owner, data())).rejects.toMatchObject({ code: "INVALID_ARTIFACT_STATE" });
      await expect(f.store.promote({ artifactId: "guarded", ...owner, finalKey: "evidence/guarded" })).rejects.toMatchObject({ code: "INVALID_ARTIFACT_STATE" });
    } finally { await f.cleanup(); }
  });

  it("rejects late or wrong attempt ownership", async () => {
    const f = await fixture();
    try {
      await f.store.allocate({ artifactId: "owned", ...owner, maximumBytes: 100 });
      await expect(f.store.write("owned", { ...owner, attemptId: "late-attempt" }, data())).rejects.toMatchObject({ code: "ARTIFACT_OWNERSHIP_MISMATCH" });
    } finally { await f.cleanup(); }
  });

  it("abandons an allocated artifact without deleting evidence", async () => {
    const f = await fixture();
    try {
      await f.store.allocate({ artifactId: "abandon", ...owner, maximumBytes: 100 });
      expect(await f.store.abandon("abandon", owner)).toMatchObject({ state: "ABANDONED" });
      await expect(f.store.abandon("abandon", owner)).rejects.toMatchObject({ code: "INVALID_ARTIFACT_STATE" });
    } finally { await f.cleanup(); }
  });
});
