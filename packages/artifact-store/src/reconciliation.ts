import path from "node:path";
import { readdir } from "node:fs/promises";
import type { ArtifactRepository } from "./artifactRepository.js";
import { hashFile } from "./hashing.js";
import { resolveLogicalKey } from "./logicalKey.js";
import type { ArtifactMetadata, ReconciliationReport } from "./types.js";

async function filesBelow(root: string, directory = root): Promise<string[]> {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...await filesBelow(root, full));
    else if (entry.isFile()) files.push(path.relative(root, full).split(path.sep).join("/"));
  }
  return files;
}

function currentKey(metadata: ArtifactMetadata): string | null {
  if (metadata.state === "PROMOTED") return metadata.finalKey;
  if (metadata.state === "QUARANTINED") return metadata.quarantineKey ?? metadata.stagingKey;
  return metadata.stagingKey;
}

export async function reconcileArtifacts(root: string, repository: ArtifactRepository): Promise<ReconciliationReport> {
  const metadata = await repository.list();
  const files = await filesBelow(root);
  const registeredStaging = new Set(metadata.filter(x => x.state !== "PROMOTED").map(x => x.stagingKey));
  const registeredFinal = new Set(metadata.map(x => x.finalKey).filter((x): x is string => x !== null));
  const orphanedStagingKeys = files.filter(x => x.startsWith("staging/") && !registeredStaging.has(x));
  const unregisteredPromotedKeys = files.filter(x => !x.startsWith("staging/") && !x.startsWith("quarantine/") && !registeredFinal.has(x));
  const missingRegisteredKeys: string[] = [];
  const checksumMismatches: string[] = [];

  for (const record of metadata) {
    const key = currentKey(record);
    if (!key) continue;
    const absolute = resolveLogicalKey(root, key);
    try {
      const actual = await hashFile(absolute);
      if (record.checksum && (actual.checksum !== record.checksum || actual.byteLength !== record.byteLength)) checksumMismatches.push(key);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") missingRegisteredKeys.push(key);
      else throw error;
    }
  }

  return {
    orphanedStagingKeys: orphanedStagingKeys.sort(),
    missingRegisteredKeys: missingRegisteredKeys.sort(),
    unregisteredPromotedKeys: unregisteredPromotedKeys.sort(),
    checksumMismatches: checksumMismatches.sort(),
  };
}
