import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentAddressedRawKey, resolveLogicalKey } from "../src/index.js";
import { collect, fixture, owner } from "./testUtils.js";

async function* data(value = "immutable raw evidence") { yield Buffer.from(value); }

async function verifiedArtifact(id: string, value = "immutable raw evidence") {
  const f = await fixture();
  await f.store.allocate({ artifactId: id, ...owner, maximumBytes: 1024 });
  await f.store.write(id, owner, data(value));
  await f.store.verify(id, owner);
  return f;
}

describe("atomic promotion", () => {
  it("promotes raw content to its SHA-256-addressed key", async () => {
    const f = await verifiedArtifact("raw");
    try {
      const promoted = await f.store.promoteRaw("raw", owner);
      expect(promoted.state).toBe("PROMOTED");
      expect(promoted.finalKey).toBe(contentAddressedRawKey(promoted.checksum!));
      expect(await collect(f.store.read("raw", { verifyChecksum: true }))).toEqual(Buffer.from("immutable raw evidence"));
      expect(JSON.stringify(promoted)).not.toContain(path.resolve(f.root));
    } finally { await f.cleanup(); }
  });

  it("rejects an existing final key without overwriting it", async () => {
    const f = await verifiedArtifact("collision", "new");
    const finalKey = "evidence/existing/payload";
    try {
      const target = resolveLogicalKey(f.root, finalKey);
      await writeFile(target, "existing", { flag: "wx" }).catch(async error => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          const { mkdir } = await import("node:fs/promises");
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, "existing", { flag: "wx" });
        } else throw error;
      });
      await expect(f.store.promote({ artifactId: "collision", ...owner, finalKey })).rejects.toMatchObject({ code: "ARTIFACT_EXISTS" });
      expect(await f.store.metadata("collision")).toMatchObject({ state: "VERIFIED", finalKey: null });
    } finally { await f.cleanup(); }
  });

  it("rejects case-insensitive final-key collisions on every platform", async () => {
    const f = await verifiedArtifact("case", "new");
    try {
      const existing = resolveLogicalKey(f.root, "evidence/CaseName");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(path.dirname(existing), { recursive: true });
      await writeFile(existing, "existing");
      await expect(f.store.promote({ artifactId: "case", ...owner, finalKey: "evidence/casename" })).rejects.toMatchObject({ code: "ARTIFACT_EXISTS" });
    } finally { await f.cleanup(); }
  });

  it("uses a source and destination under the same configured root volume", async () => {
    const f = await verifiedArtifact("volume");
    try {
      const promoted = await f.store.promote({ artifactId: "volume", ...owner, finalKey: "normalized/item/content.md" });
      expect(path.parse(resolveLogicalKey(f.root, promoted.stagingKey)).root).toBe(path.parse(resolveLogicalKey(f.root, promoted.finalKey!)).root);
      await expect(access(resolveLogicalKey(f.root, promoted.finalKey!))).resolves.toBeUndefined();
    } finally { await f.cleanup(); }
  });
});
