import { ArtifactExistsError, ArtifactNotFoundError, ArtifactStateError } from "./errors.js";
import type { ArtifactRepository } from "./artifactRepository.js";
import type { ArtifactMetadata, ArtifactState } from "./types.js";

function clone(value: ArtifactMetadata): ArtifactMetadata { return { ...value }; }

export class InMemoryArtifactRepository implements ArtifactRepository {
  private readonly records = new Map<string, ArtifactMetadata>();

  async create(metadata: ArtifactMetadata): Promise<ArtifactMetadata> {
    if (this.records.has(metadata.artifactId)) throw new ArtifactExistsError("Artifact allocation already exists.");
    const stored = Object.freeze(clone(metadata));
    this.records.set(metadata.artifactId, stored);
    return clone(stored);
  }

  async get(artifactId: string): Promise<ArtifactMetadata | null> {
    const value = this.records.get(artifactId);
    return value ? clone(value) : null;
  }

  async list(): Promise<ArtifactMetadata[]> {
    return [...this.records.values()].map(clone).sort((a, b) => a.artifactId.localeCompare(b.artifactId));
  }

  async compareAndSet(
    artifactId: string,
    expected: readonly ArtifactState[],
    update: (current: ArtifactMetadata) => ArtifactMetadata,
  ): Promise<ArtifactMetadata> {
    const current = this.records.get(artifactId);
    if (!current) throw new ArtifactNotFoundError("Artifact metadata was not found.");
    if (!expected.includes(current.state)) {
      throw new ArtifactStateError(`Artifact is ${current.state}; expected ${expected.join(" or ")}.`);
    }
    const next = Object.freeze(clone(update(clone(current))));
    if (next.artifactId !== current.artifactId || next.jobId !== current.jobId || next.attemptId !== current.attemptId || next.stagingKey !== current.stagingKey || next.maximumBytes !== current.maximumBytes || next.createdAt !== current.createdAt) {
      throw new ArtifactStateError("Immutable allocation metadata cannot be changed.");
    }
    this.records.set(artifactId, next);
    return clone(next);
  }
}
