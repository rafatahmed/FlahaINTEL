import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveLogicalKey } from "../src/index.js";
import { fixture, owner } from "./testUtils.js";

async function* data(value: string) { yield Buffer.from(value); }

describe("non-mutating reconciliation", () => {
  it("reports orphaned, missing, unregistered, and corrupt artifacts stably", async () => {
    const f = await fixture();
    try {
      await f.store.allocate({ artifactId: "missing", ...owner, maximumBytes: 100 });
      await f.store.write("missing", owner, data("missing"));
      await f.store.verify("missing", owner);
      const missing = await f.store.promote({ artifactId: "missing", ...owner, finalKey: "evidence/missing/payload" });
      await rm(resolveLogicalKey(f.root, missing.finalKey!));

      await f.store.allocate({ artifactId: "corrupt", ...owner, maximumBytes: 100 });
      await f.store.write("corrupt", owner, data("correct"));
      await f.store.verify("corrupt", owner);
      const corrupt = await f.store.promote({ artifactId: "corrupt", ...owner, finalKey: "evidence/corrupt/payload" });
      const corruptPath = resolveLogicalKey(f.root, corrupt.finalKey!);
      await chmod(corruptPath, 0o600);
      await writeFile(corruptPath, "wrong");

      const orphan = resolveLogicalKey(f.root, "staging/orphan/job/payload");
      await mkdir(path.dirname(orphan), { recursive: true });
      await writeFile(orphan, "orphan");
      const unregistered = resolveLogicalKey(f.root, "normalized/unregistered/content.md");
      await mkdir(path.dirname(unregistered), { recursive: true });
      await writeFile(unregistered, "unregistered");

      const first = await f.store.reconcile();
      const second = await f.store.reconcile();
      expect(second).toEqual(first);
      expect(first).toEqual({
        orphanedStagingKeys: ["staging/orphan/job/payload"],
        missingRegisteredKeys: ["evidence/missing/payload"],
        unregisteredPromotedKeys: ["normalized/unregistered/content.md"],
        checksumMismatches: ["evidence/corrupt/payload"],
      });
    } finally { await f.cleanup(); }
  });
});
