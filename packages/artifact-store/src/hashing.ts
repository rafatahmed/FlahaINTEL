import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export async function hashFile(filePath: string): Promise<{ checksum: string; byteLength: number }> {
  const hash = createHash("sha256");
  let byteLength = 0;
  for await (const chunk of createReadStream(filePath)) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += value.length;
    hash.update(value);
  }
  return { checksum: hash.digest("hex"), byteLength };
}
