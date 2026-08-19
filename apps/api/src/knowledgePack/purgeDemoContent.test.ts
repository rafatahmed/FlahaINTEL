/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Purge Demo Content — Unit Tests
 * Introduction: Verifies demo pack code list and soil-case heuristics without live DB.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import { describe, expect, it } from "vitest";
import { DEMO_KNOWLEDGE_PACK_CODES, DEMO_LITERATURE_CODE_PREFIX } from "./purgeDemoContent.js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fixturesDir = fileURLToPath(new URL("../../test/fixtures/knowledge/", import.meta.url));

describe("demo fixtures live under real tests", () => {
  it("ships sample pack JSON under test/fixtures/knowledge", () => {
    expect(existsSync(`${fixturesDir}samples/soil-irrigation-pack-samples.json`)).toBe(true);
    expect(existsSync(`${fixturesDir}samples/irrigation-calc-fast-pack-samples.json`)).toBe(true);
    expect(existsSync(`${fixturesDir}samples/literature-source-examples.json`)).toBe(true);
    expect(existsSync(`${fixturesDir}banks/literature-threshold-bank.json`)).toBe(true);
  });

  it("DEMO_KNOWLEDGE_PACK_CODES matches sample + bank fixture codes", () => {
    const soil = JSON.parse(
      readFileSync(`${fixturesDir}samples/soil-irrigation-pack-samples.json`, "utf8"),
    ) as { packs: Array<{ code: string }> };
    const calc = JSON.parse(
      readFileSync(`${fixturesDir}samples/irrigation-calc-fast-pack-samples.json`, "utf8"),
    ) as { packs: Array<{ code: string }> };
    const bank = JSON.parse(
      readFileSync(`${fixturesDir}banks/literature-threshold-bank.json`, "utf8"),
    ) as { code: string };

    const fixtureCodes = new Set([
      ...soil.packs.map((p) => p.code),
      ...calc.packs.map((p) => p.code),
      bank.code,
    ]);
    for (const code of DEMO_KNOWLEDGE_PACK_CODES) {
      expect(fixtureCodes.has(code)).toBe(true);
    }
  });

  it("example literature codes use ex- prefix", () => {
    const lit = JSON.parse(
      readFileSync(`${fixturesDir}samples/literature-source-examples.json`, "utf8"),
    ) as { sources: Array<{ code: string }> };
    for (const s of lit.sources) {
      expect(s.code.startsWith(DEMO_LITERATURE_CODE_PREFIX)).toBe(true);
    }
  });
});
