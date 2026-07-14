import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { chmod, lstat, mkdir, open, readdir, rename, stat } from "node:fs/promises";
import type { ArtifactRepository } from "./artifactRepository.js";
import {
  ArtifactExistsError, ArtifactIntegrityError, ArtifactLimitError,
  ArtifactNotFoundError, ArtifactOwnershipError, ArtifactStateError,
} from "./errors.js";
import { hashFile } from "./hashing.js";
import { assertNoLinkedComponents, contentAddressedRawKey, resolveLogicalKey, validateLogicalKey } from "./logicalKey.js";
import { reconcileArtifacts } from "./reconciliation.js";
import type { AllocationRequest, ArtifactMetadata, ArtifactOwner, PromotionRequest, ReadOptions, ReconciliationReport } from "./types.js";

type ByteSource = AsyncIterable<Uint8Array | string>;

function now(): string { return new Date().toISOString(); }
function boundedDiagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : "Artifact write was interrupted.";
  return message.slice(0, 2048);
}

export class FilesystemArtifactStore {
  private initialized = false;

  constructor(private readonly root: string, private readonly repository: ArtifactRepository) {
    if (!path.isAbsolute(root)) throw new ArtifactStateError("Artifact root must be an explicit absolute path.");
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const rootLinkStats = await lstat(this.root);
    if (rootLinkStats.isSymbolicLink()) throw new ArtifactStateError("Artifact root cannot be a symbolic link, junction, or reparse-point link.");
    const rootStats = await stat(this.root);
    if (!rootStats.isDirectory()) throw new ArtifactStateError("Artifact root is not a directory.");
    await assertNoLinkedComponents(this.root, this.root);
    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) throw new ArtifactStateError("Artifact store must be explicitly initialized.");
  }

  private async prepareParent(absolute: string): Promise<void> {
    await assertNoLinkedComponents(this.root, path.dirname(absolute));
    await mkdir(path.dirname(absolute), { recursive: true });
    await assertNoLinkedComponents(this.root, path.dirname(absolute));
  }

  private assertOwner(metadata: ArtifactMetadata, owner: ArtifactOwner): void {
    if (metadata.jobId !== owner.jobId || metadata.attemptId !== owner.attemptId) {
      throw new ArtifactOwnershipError("Job or attempt does not own this artifact allocation.");
    }
  }

  async allocate(request: AllocationRequest): Promise<ArtifactMetadata> {
    this.ensureInitialized();
    if (!Number.isSafeInteger(request.maximumBytes) || request.maximumBytes < 0) throw new ArtifactLimitError("Maximum bytes must be a non-negative safe integer.");
    const stagingKey = validateLogicalKey(`staging/${request.jobId}/${request.attemptId}/${request.artifactId}/payload`);
    const absolute = resolveLogicalKey(this.root, stagingKey);
    await this.prepareParent(absolute);
    const timestamp = now();
    return this.repository.create({
      ...request, state: "ALLOCATED", stagingKey, finalKey: null, quarantineKey: null,
      byteLength: null, checksum: null, createdAt: timestamp, updatedAt: timestamp, diagnostic: null,
    });
  }

  async allocateGenerated(owner: ArtifactOwner, maximumBytes: number): Promise<ArtifactMetadata> {
    return this.allocate({ ...owner, artifactId: randomUUID(), maximumBytes });
  }

  async write(artifactId: string, owner: ArtifactOwner, source: ByteSource): Promise<ArtifactMetadata> {
    this.ensureInitialized();
    const allocated = await this.repository.get(artifactId);
    if (!allocated) throw new ArtifactNotFoundError("Artifact allocation was not found.");
    this.assertOwner(allocated, owner);
    const writing = await this.repository.compareAndSet(artifactId, ["ALLOCATED"], current => ({ ...current, state: "WRITING", updatedAt: now() }));
    const absolute = resolveLogicalKey(this.root, writing.stagingKey);
    await this.prepareParent(absolute);
    const handle = await open(absolute, "wx", 0o600);
    const hash = createHash("sha256");
    let byteLength = 0;
    try {
      for await (const chunk of source) {
        const buffer = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
        byteLength += buffer.length;
        if (byteLength > writing.maximumBytes) throw new ArtifactLimitError("Artifact exceeded its streaming byte limit.");
        hash.update(buffer);
        await handle.write(buffer);
      }
      await handle.sync();
      await handle.close();
      const checksum = hash.digest("hex");
      await chmod(absolute, 0o444);
      return this.repository.compareAndSet(artifactId, ["WRITING"], current => ({
        ...current, state: "SEALED", byteLength, checksum, updatedAt: now(), diagnostic: null,
      }));
    } catch (error) {
      await handle.close().catch(() => undefined);
      await this.repository.compareAndSet(artifactId, ["WRITING"], current => ({
        ...current, state: "ABANDONED", byteLength, checksum: null, updatedAt: now(), diagnostic: boundedDiagnostic(error),
      }));
      throw error;
    }
  }

  async seal(artifactId: string, owner: ArtifactOwner): Promise<never> {
    const metadata = await this.repository.get(artifactId);
    if (!metadata) throw new ArtifactNotFoundError("Artifact allocation was not found.");
    this.assertOwner(metadata, owner);
    throw new ArtifactStateError("Writes are sealed atomically when streaming completes; explicit or duplicate sealing is not allowed.");
  }

  async verify(artifactId: string, owner: ArtifactOwner, reread = true): Promise<ArtifactMetadata> {
    this.ensureInitialized();
    const metadata = await this.repository.get(artifactId);
    if (!metadata) throw new ArtifactNotFoundError("Artifact allocation was not found.");
    this.assertOwner(metadata, owner);
    if (metadata.state !== "SEALED") throw new ArtifactStateError("Only a sealed artifact can be verified.");
    if (!reread) return this.repository.compareAndSet(artifactId, ["SEALED"], current => ({ ...current, state: "VERIFIED", updatedAt: now() }));
    const absolute = resolveLogicalKey(this.root, metadata.stagingKey);
    try {
      const actual = await hashFile(absolute);
      if (actual.byteLength !== metadata.byteLength || actual.checksum !== metadata.checksum) {
        throw new ArtifactIntegrityError("Staged artifact changed after sealing.");
      }
      return this.repository.compareAndSet(artifactId, ["SEALED"], current => ({ ...current, state: "VERIFIED", updatedAt: now() }));
    } catch (error) {
      await this.quarantine(artifactId, owner, boundedDiagnostic(error));
      throw error;
    }
  }

  private async assertNoCaseCollision(absolute: string): Promise<void> {
    let entries: string[] = [];
    try { entries = await readdir(path.dirname(absolute)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const name = path.basename(absolute);
    if (entries.some(entry => entry.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"))) {
      throw new ArtifactExistsError("Final artifact key already exists or has a case-insensitive collision.");
    }
  }

  async promote(request: PromotionRequest): Promise<ArtifactMetadata> {
    this.ensureInitialized();
    const metadata = await this.repository.get(request.artifactId);
    if (!metadata) throw new ArtifactNotFoundError("Artifact allocation was not found.");
    this.assertOwner(metadata, request);
    if (metadata.state !== "VERIFIED") throw new ArtifactStateError("Only a verified artifact can be promoted.");
    const finalKey = validateLogicalKey(request.finalKey);
    if (finalKey.startsWith("staging/") || finalKey.startsWith("quarantine/")) throw new ArtifactStateError("Final key cannot use a staging or quarantine namespace.");
    const source = resolveLogicalKey(this.root, metadata.stagingKey);
    const target = resolveLogicalKey(this.root, finalKey);
    if (path.parse(source).root.toLocaleLowerCase("en-US") !== path.parse(target).root.toLocaleLowerCase("en-US")) {
      throw new ArtifactStateError("Promotion must remain on the artifact root volume.");
    }
    await this.prepareParent(target);
    await this.assertNoCaseCollision(target);
    await this.repository.compareAndSet(request.artifactId, ["VERIFIED"], current => ({ ...current, state: "PROMOTING", finalKey, updatedAt: now() }));
    try {
      await rename(source, target);
      await chmod(target, 0o444);
      return this.repository.compareAndSet(request.artifactId, ["PROMOTING"], current => ({ ...current, state: "PROMOTED", updatedAt: now() }));
    } catch (error) {
      await this.repository.compareAndSet(request.artifactId, ["PROMOTING"], current => ({ ...current, state: "VERIFIED", finalKey: null, updatedAt: now(), diagnostic: boundedDiagnostic(error) }));
      throw error;
    }
  }

  async promoteRaw(artifactId: string, owner: ArtifactOwner): Promise<ArtifactMetadata> {
    const metadata = await this.repository.get(artifactId);
    if (!metadata?.checksum) throw new ArtifactStateError("Verified checksum is required for raw promotion.");
    return this.promote({ artifactId, ...owner, finalKey: contentAddressedRawKey(metadata.checksum) });
  }

  async *read(artifactId: string, options: ReadOptions = {}): AsyncGenerator<Buffer> {
    this.ensureInitialized();
    const metadata = await this.repository.get(artifactId);
    if (!metadata || metadata.state !== "PROMOTED" || !metadata.finalKey) throw new ArtifactNotFoundError("Promoted artifact was not found.");
    const absolute = resolveLogicalKey(this.root, metadata.finalKey);
    await assertNoLinkedComponents(this.root, absolute);
    const hash = createHash("sha256");
    let byteLength = 0;
    try {
      for await (const chunk of createReadStream(absolute)) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (options.verifyChecksum) { hash.update(buffer); byteLength += buffer.length; }
        yield buffer;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new ArtifactNotFoundError("Promoted artifact file is missing.");
      throw error;
    }
    if (options.verifyChecksum && (hash.digest("hex") !== metadata.checksum || byteLength !== metadata.byteLength)) {
      throw new ArtifactIntegrityError("Promoted artifact checksum or size does not match metadata.");
    }
  }

  async metadata(artifactId: string): Promise<ArtifactMetadata> {
    const metadata = await this.repository.get(artifactId);
    if (!metadata) throw new ArtifactNotFoundError("Artifact metadata was not found.");
    return metadata;
  }

  async quarantine(artifactId: string, owner: ArtifactOwner, diagnostic: string): Promise<ArtifactMetadata> {
    this.ensureInitialized();
    const metadata = await this.repository.get(artifactId);
    if (!metadata) throw new ArtifactNotFoundError("Artifact allocation was not found.");
    this.assertOwner(metadata, owner);
    if (!["SEALED", "VERIFIED"].includes(metadata.state)) throw new ArtifactStateError("Only sealed or verified artifacts can be quarantined.");
    const quarantineKey = validateLogicalKey(`quarantine/${metadata.jobId}/${metadata.attemptId}/${metadata.artifactId}/payload`);
    const source = resolveLogicalKey(this.root, metadata.stagingKey);
    const target = resolveLogicalKey(this.root, quarantineKey);
    await this.prepareParent(target);
    try { await rename(source, target); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    return this.repository.compareAndSet(artifactId, [metadata.state], current => ({
      ...current, state: "QUARANTINED", quarantineKey, updatedAt: now(), diagnostic: diagnostic.slice(0, 2048),
    }));
  }

  async abandon(artifactId: string, owner: ArtifactOwner, diagnostic = "Allocation abandoned."): Promise<ArtifactMetadata> {
    const metadata = await this.repository.get(artifactId);
    if (!metadata) throw new ArtifactNotFoundError("Artifact allocation was not found.");
    this.assertOwner(metadata, owner);
    return this.repository.compareAndSet(artifactId, ["ALLOCATED", "WRITING"], current => ({
      ...current, state: "ABANDONED", updatedAt: now(), diagnostic: diagnostic.slice(0, 2048),
    }));
  }

  async reconcile(): Promise<ReconciliationReport> {
    this.ensureInitialized();
    return reconcileArtifacts(this.root, this.repository);
  }
}
