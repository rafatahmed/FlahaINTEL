/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Durable Filesystem Artifact Repository Tests
 * Introduction: Verifies atomic durable manifests, immutable ownership, duplicate protection, restart reads, and missing-.metadata recovery.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-31
 */
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FilesystemArtifactRepository,
  FilesystemArtifactStore,
} from "../src/index.js";

const roots: string[] = [];
const metadata = {
  artifactId: "00000000-0000-4000-8000-000000000901",
  jobId: "00000000-0000-4000-8000-000000000902",
  attemptId: "00000000-0000-4000-8000-000000000903",
  state: "ALLOCATED" as const,
  stagingKey: "staging/job/attempt/artifact/payload",
  finalKey: null,
  quarantineKey: null,
  maximumBytes: 10,
  byteLength: null,
  checksum: null,
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
  diagnostic: null,
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("FilesystemArtifactRepository", () => {
  it("survives repository restart with atomic metadata", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "flaha-artifacts-"));
    roots.push(root);
    const first = new FilesystemArtifactRepository(root);
    await first.initialize();
    await first.create(metadata);
    const second = new FilesystemArtifactRepository(root);
    await second.initialize();
    expect(await second.get(metadata.artifactId)).toEqual(metadata);
  });

  it("rejects duplicates and immutable-owner changes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "flaha-artifacts-"));
    roots.push(root);
    const repo = new FilesystemArtifactRepository(root);
    await repo.initialize();
    await repo.create(metadata);
    await expect(repo.create(metadata)).rejects.toThrow(/exists/);
    await expect(
      repo.compareAndSet(metadata.artifactId, ["ALLOCATED"], (value) => ({ ...value, jobId: "wrong" })),
    ).rejects.toThrow(/Immutable/);
  });

  it("creates .metadata on first persist without prior initialize()", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "flaha-artifacts-"));
    roots.push(root);
    const repo = new FilesystemArtifactRepository(root);
    // Intentionally skip repo.initialize() — API bootstrap historically only called store.initialize().
    await repo.create(metadata);
    await access(path.join(root, ".metadata", `${metadata.artifactId}.json`));
    expect(await repo.get(metadata.artifactId)).toEqual(metadata);
  });

  it("store.initialize() alone enables allocate/write/promote (intake seal path)", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "flaha-artifacts-"));
    roots.push(root);
    const repo = new FilesystemArtifactRepository(root);
    const store = new FilesystemArtifactStore(root, repo);
    await store.initialize();
    await access(path.join(root, ".metadata"));
    const owner = {
      jobId: "00000000-0000-4000-8000-000000000301",
      attemptId: "00000000-0000-4000-8000-000000000401",
    };
    const allocated = await store.allocateGenerated(owner, 64);
    const bytes = Buffer.from("intake-seal-regression");
    await store.write(allocated.artifactId, owner, (async function* () {
      yield bytes;
    })());
    await store.verify(allocated.artifactId, owner);
    const promoted = await store.promote({
      artifactId: allocated.artifactId,
      ...owner,
      finalKey: `intake/sha256/test/${allocated.artifactId}`,
    });
    expect(promoted.state).toBe("PROMOTED");
  });
});
