import type { ArtifactMetadata, ArtifactState } from "./types.js";

export interface ArtifactRepository {
  create(metadata: ArtifactMetadata): Promise<ArtifactMetadata>;
  get(artifactId: string): Promise<ArtifactMetadata | null>;
  list(): Promise<ArtifactMetadata[]>;
  compareAndSet(
    artifactId: string,
    expected: readonly ArtifactState[],
    update: (current: ArtifactMetadata) => ArtifactMetadata,
  ): Promise<ArtifactMetadata>;
}
