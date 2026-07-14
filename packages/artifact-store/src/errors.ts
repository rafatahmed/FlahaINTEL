export class ArtifactStoreError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "ArtifactStoreError";
  }
}

export class InvalidLogicalKeyError extends ArtifactStoreError {
  constructor(message: string) { super(message, "INVALID_LOGICAL_KEY"); }
}

export class ArtifactStateError extends ArtifactStoreError {
  constructor(message: string) { super(message, "INVALID_ARTIFACT_STATE"); }
}

export class ArtifactOwnershipError extends ArtifactStoreError {
  constructor(message: string) { super(message, "ARTIFACT_OWNERSHIP_MISMATCH"); }
}

export class ArtifactExistsError extends ArtifactStoreError {
  constructor(message: string) { super(message, "ARTIFACT_EXISTS"); }
}

export class ArtifactNotFoundError extends ArtifactStoreError {
  constructor(message: string) { super(message, "ARTIFACT_NOT_FOUND"); }
}

export class ArtifactLimitError extends ArtifactStoreError {
  constructor(message: string) { super(message, "ARTIFACT_SIZE_LIMIT_EXCEEDED"); }
}

export class ArtifactIntegrityError extends ArtifactStoreError {
  constructor(message: string) { super(message, "ARTIFACT_INTEGRITY_FAILURE"); }
}

export class UnsafeFilesystemEntryError extends ArtifactStoreError {
  constructor(message: string) { super(message, "UNSAFE_FILESYSTEM_ENTRY"); }
}
