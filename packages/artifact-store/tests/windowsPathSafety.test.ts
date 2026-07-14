import { access, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FilesystemArtifactStore, InMemoryArtifactRepository, validateLogicalKey } from "../src/index.js";

describe("Windows path safety", () => {
  it.each([
    "C:/payload", "C:\\payload", "\\\\host\\share\\payload", "\\\\?\\C:\\payload",
    "\\\\.\\PhysicalDrive0", "safe/file:stream", "safe/NUL", "safe/com1.txt",
    "safe/trailing. ", "safe\\mixed/separators",
  ])("rejects %j", key => expect(() => validateLogicalKey(key)).toThrow());

  it("does not create the configured root before explicit initialization", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "flaha-root-parent-"));
    const root = path.join(parent, "not-created-yet");
    try {
      const store = new FilesystemArtifactStore(root, new InMemoryArtifactRepository());
      await expect(access(root)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(store.allocateGenerated({ jobId: "job", attemptId: "attempt" }, 1)).rejects.toMatchObject({ code: "INVALID_ARTIFACT_STATE" });
      await expect(access(root)).rejects.toMatchObject({ code: "ENOENT" });
      await store.initialize();
      await expect(access(root)).resolves.toBeUndefined();
    } finally { await rm(parent, { recursive: true, force: true }); }
  });

  it("rejects a configured root that is itself a detectable link", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "flaha-linked-root-"));
    const target = path.join(parent, "target");
    const linkedRoot = path.join(parent, "linked");
    const { mkdir } = await import("node:fs/promises");
    try {
      await mkdir(target);
      await symlink(target, linkedRoot, process.platform === "win32" ? "junction" : "dir");
      const store = new FilesystemArtifactStore(linkedRoot, new InMemoryArtifactRepository());
      await expect(store.initialize()).rejects.toMatchObject({ code: "INVALID_ARTIFACT_STATE" });
    } finally { await rm(parent, { recursive: true, force: true }); }
  });
});
