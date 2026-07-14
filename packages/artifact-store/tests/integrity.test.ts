import { chmod, rm, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { resolveLogicalKey } from "../src/index.js";
import { collect, fixture, owner } from "./testUtils.js";

async function* data() { yield Buffer.from("trusted bytes"); }

describe("integrity verification", () => {
  it("detects staged modification after sealing and quarantines it", async () => {
    const f = await fixture();
    try {
      const allocated = await f.store.allocate({ artifactId: "modified", ...owner, maximumBytes: 100 });
      await f.store.write("modified", owner, data());
      const absolute = resolveLogicalKey(f.root, allocated.stagingKey);
      await chmod(absolute, 0o600);
      await writeFile(absolute, "tampered");
      await expect(f.store.verify("modified", owner)).rejects.toMatchObject({ code: "ARTIFACT_INTEGRITY_FAILURE" });
      expect(await f.store.metadata("modified")).toMatchObject({ state: "QUARANTINED" });
    } finally { await f.cleanup(); }
  });

  it("detects a corrupted promoted artifact during verified read", async () => {
    const f = await fixture();
    try {
      await f.store.allocate({ artifactId: "corrupt", ...owner, maximumBytes: 100 });
      await f.store.write("corrupt", owner, data());
      await f.store.verify("corrupt", owner);
      const promoted = await f.store.promote({ artifactId: "corrupt", ...owner, finalKey: "evidence/corrupt/payload" });
      const absolute = resolveLogicalKey(f.root, promoted.finalKey!);
      await chmod(absolute, 0o600);
      await writeFile(absolute, "corrupted bytes");
      await expect(collect(f.store.read("corrupt", { verifyChecksum: true }))).rejects.toMatchObject({ code: "ARTIFACT_INTEGRITY_FAILURE" });
    } finally { await f.cleanup(); }
  });

  it("reports a missing promoted file without exposing its absolute path", async () => {
    const f = await fixture();
    try {
      await f.store.allocate({ artifactId: "missing", ...owner, maximumBytes: 100 });
      await f.store.write("missing", owner, data());
      await f.store.verify("missing", owner);
      const promoted = await f.store.promote({ artifactId: "missing", ...owner, finalKey: "evidence/missing/payload" });
      await rm(resolveLogicalKey(f.root, promoted.finalKey!));
      const promise = collect(f.store.read("missing", { verifyChecksum: true }));
      await expect(promise).rejects.toMatchObject({ code: "ARTIFACT_NOT_FOUND" });
      await expect(promise).rejects.not.toThrow(f.root);
    } finally { await f.cleanup(); }
  });
});
