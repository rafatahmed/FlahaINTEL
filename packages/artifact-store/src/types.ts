export type ArtifactState =
  | "ALLOCATED" | "WRITING" | "SEALED" | "VERIFIED"
  | "PROMOTING" | "PROMOTED" | "QUARANTINED" | "ABANDONED";

export interface ArtifactOwner { jobId: string; attemptId: string }

export interface ArtifactMetadata extends ArtifactOwner {
  artifactId: string;
  state: ArtifactState;
  stagingKey: string;
  finalKey: string | null;
  quarantineKey: string | null;
  maximumBytes: number;
  byteLength: number | null;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
  diagnostic: string | null;
}

export interface AllocationRequest extends ArtifactOwner {
  artifactId: string;
  maximumBytes: number;
}

export interface PromotionRequest extends ArtifactOwner {
  artifactId: string;
  finalKey: string;
}

export interface ReconciliationReport {
  orphanedStagingKeys: string[];
  missingRegisteredKeys: string[];
  unregisteredPromotedKeys: string[];
  checksumMismatches: string[];
}

export interface ReadOptions { verifyChecksum?: boolean }
