import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FilesystemArtifactStore, InMemoryArtifactRepository } from "../src/index.js";

export const owner = { jobId: "00000000-0000-4000-8000-000000000301", attemptId: "00000000-0000-4000-8000-000000000401" };

export async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "flaha-artifacts-"));
  const repository = new InMemoryArtifactRepository();
  const store = new FilesystemArtifactStore(root, repository);
  await store.initialize();
  return { root, repository, store, cleanup: () => rm(root, { recursive: true, force: true }) };
}

export async function collect(source: AsyncIterable<Buffer>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of source) chunks.push(chunk);
  return Buffer.concat(chunks);
}
