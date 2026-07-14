import path from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { InvalidLogicalKeyError, UnsafeFilesystemEntryError } from "./errors.js";

const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const control = /[\u0000-\u001f\u007f]/;

export function validateLogicalKey(key: string): string {
  if (!key || key.length > 1024) throw new InvalidLogicalKeyError("Logical key length is invalid.");
  if (key.startsWith("/") || /^[A-Za-z]:/.test(key) || key.startsWith("\\\\") || key.startsWith("\\?\\") || key.startsWith("\\.\\")) {
    throw new InvalidLogicalKeyError("Logical keys must be relative.");
  }
  if (key.includes("\\")) throw new InvalidLogicalKeyError("Backslashes are not allowed in logical keys.");
  if (key.includes(":")) throw new InvalidLogicalKeyError("Colons and Windows alternate data streams are not allowed.");
  if (control.test(key)) throw new InvalidLogicalKeyError("Control characters are not allowed.");
  const components = key.split("/");
  for (const component of components) {
    if (!component) throw new InvalidLogicalKeyError("Empty path components are not allowed.");
    if (component === "." || component === "..") throw new InvalidLogicalKeyError("Dot path components are not allowed.");
    if (component.endsWith(".") || component.endsWith(" ")) throw new InvalidLogicalKeyError("Components cannot end with a dot or space.");
    if (reserved.test(component)) throw new InvalidLogicalKeyError("Reserved Windows device components are not allowed.");
  }
  return key;
}

export function resolveLogicalKey(root: string, key: string): string {
  validateLogicalKey(key);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...key.split("/"));
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new InvalidLogicalKeyError("Logical key resolves outside the artifact root.");
  }
  return resolved;
}

export async function assertNoLinkedComponents(root: string, absoluteTarget: string): Promise<void> {
  const resolvedRoot = path.resolve(root);
  const rootReal = await realpath(resolvedRoot);
  const relative = path.relative(resolvedRoot, absoluteTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new UnsafeFilesystemEntryError("Target is outside the artifact root.");
  let current = resolvedRoot;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink()) throw new UnsafeFilesystemEntryError("Symbolic links, junctions, and reparse-point links are not allowed.");
      const currentReal = await realpath(current);
      const realRelative = path.relative(rootReal, currentReal);
      if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) throw new UnsafeFilesystemEntryError("Filesystem entry escapes the artifact root.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }
  }
}

export function contentAddressedRawKey(checksum: string): string {
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new InvalidLogicalKeyError("A lowercase SHA-256 checksum is required.");
  return `raw/sha256/${checksum.slice(0, 2)}/${checksum.slice(2, 4)}/${checksum}/payload`;
}
