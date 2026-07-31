/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Durable Filesystem Artifact Repository
 * Introduction:
 * Persists artifact lifecycle metadata as atomic immutable-owner JSON manifests under the governed artifact root.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-31
 */
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { ArtifactExistsError, ArtifactNotFoundError, ArtifactStateError } from "./errors.js";
import type { ArtifactRepository } from "./artifactRepository.js";
import { assertNoLinkedComponents } from "./logicalKey.js";
import type { ArtifactMetadata, ArtifactState } from "./types.js";

const FILE = /^[0-9a-f-]{36}\.json$/i;
function clone(value: ArtifactMetadata): ArtifactMetadata { return structuredClone(value); }

export class FilesystemArtifactRepository implements ArtifactRepository {
  private readonly directory: string;
  constructor(private readonly root: string) {
    if (!path.isAbsolute(root)) throw new ArtifactStateError("Artifact repository root must be absolute.");
    this.directory = path.join(root, ".metadata");
  }
  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await assertNoLinkedComponents(this.root, this.directory);
  }
  private manifest(id: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ArtifactStateError("Artifact ID is invalid.");
    return path.join(this.directory, `${id}.json`);
  }
  /**
   * Atomic write under .metadata. Ensures the directory exists so API paths that
   * only call store.initialize() (without a separate repository.initialize()) still seal.
   */
  private async persist(value: ArtifactMetadata, exclusive = false): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const target = this.manifest(value.artifactId);
    const temporary = path.join(this.directory, `.${value.artifactId}.${randomUUID()}.tmp`);
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (exclusive) {
      try {
        const guard = await open(target, "wx", 0o600);
        await guard.close();
      } catch {
        throw new ArtifactExistsError("Artifact allocation already exists.");
      }
    }
    await rename(temporary, target);
  }
  async create(metadata: ArtifactMetadata): Promise<ArtifactMetadata> {
    await this.persist(metadata, true);
    return clone(metadata);
  }
  async get(artifactId: string): Promise<ArtifactMetadata | null> {
    try {
      return JSON.parse(await readFile(this.manifest(artifactId), "utf8")) as ArtifactMetadata;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async list(): Promise<ArtifactMetadata[]> {
    await mkdir(this.directory, { recursive: true });
    const names = (await readdir(this.directory)).filter((name) => FILE.test(name)).sort();
    return Promise.all(
      names.map(async (name) => JSON.parse(await readFile(path.join(this.directory, name), "utf8")) as ArtifactMetadata),
    );
  }
  async compareAndSet(
    artifactId: string,
    expected: readonly ArtifactState[],
    update: (current: ArtifactMetadata) => ArtifactMetadata,
  ): Promise<ArtifactMetadata> {
    const current = await this.get(artifactId);
    if (!current) throw new ArtifactNotFoundError("Artifact metadata was not found.");
    if (!expected.includes(current.state)) {
      throw new ArtifactStateError(`Artifact is ${current.state}; expected ${expected.join(" or ")}.`);
    }
    const next = clone(update(clone(current)));
    if (
      next.artifactId !== current.artifactId ||
      next.jobId !== current.jobId ||
      next.attemptId !== current.attemptId ||
      next.stagingKey !== current.stagingKey ||
      next.maximumBytes !== current.maximumBytes ||
      next.createdAt !== current.createdAt
    ) {
      throw new ArtifactStateError("Immutable allocation metadata cannot be changed.");
    }
    await this.persist(next);
    return clone(next);
  }
}
