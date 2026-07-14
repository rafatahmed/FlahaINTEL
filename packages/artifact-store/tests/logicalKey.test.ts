import { mkdir, symlink } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertNoLinkedComponents, contentAddressedRawKey, InvalidLogicalKeyError, resolveLogicalKey, validateLogicalKey } from "../src/index.js";
import { fixture } from "./testUtils.js";

describe("logical artifact keys", () => {
  it.each(["raw/a/payload", "normalized/تقارير/حصاد 2026.md", "evidence/naïve/文件.json"])("accepts %s", key => {
    expect(validateLogicalKey(key)).toBe(key);
  });

  it.each([
    "../secret", "raw/../secret", "C:\\artifact\\payload", "/var/artifact/payload",
    "\\\\server\\share\\payload", "\\\\?\\C:\\payload", "raw/file.txt:secret",
    "raw/CON.txt/payload", "raw//payload", "raw/./payload", "raw/name./payload",
    "raw/name /payload", "raw\\payload", "raw/control\u0000payload",
  ])("rejects unsafe key %j", key => expect(() => validateLogicalKey(key)).toThrow(InvalidLogicalKeyError));

  it("resolves only beneath the configured root", async () => {
    const f = await fixture();
    try { expect(resolveLogicalKey(f.root, "raw/item").startsWith(path.resolve(f.root) + path.sep)).toBe(true); }
    finally { await f.cleanup(); }
  });

  it("produces the governed content-addressed raw layout", () => {
    const digest = "abcdef" + "0".repeat(58);
    expect(contentAddressedRawKey(digest)).toBe(`raw/sha256/ab/cd/${digest}/payload`);
  });

  it("rejects a detectable junction or symlink component", async () => {
    const f = await fixture();
    const outside = await fixture();
    try {
      await mkdir(path.join(f.root, "unsafe"), { recursive: true });
      await symlink(outside.root, path.join(f.root, "unsafe", "link"), process.platform === "win32" ? "junction" : "dir");
      await expect(assertNoLinkedComponents(f.root, path.join(f.root, "unsafe", "link", "payload"))).rejects.toMatchObject({ code: "UNSAFE_FILESYSTEM_ENTRY" });
    } finally { await f.cleanup(); await outside.cleanup(); }
  });
});
