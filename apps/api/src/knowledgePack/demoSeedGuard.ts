/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Demo Seed Guard
 * Introduction: Blocks sample/demo seed CLIs unless explicitly allowed for tests.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import { fileURLToPath } from "node:url";

/**
 * Demo seeds must not run against operate DBs by accident.
 * Allow only when:
 * - FLAHA_ALLOW_DEMO_SEED=1, or
 * - --for-tests is on argv, or
 * - VITEST / NODE_ENV=test
 */
export function assertDemoSeedAllowed(scriptName: string): void {
  const envAllow = process.env.FLAHA_ALLOW_DEMO_SEED === "1";
  const flag = process.argv.includes("--for-tests");
  const testEnv =
    process.env.VITEST === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.FLAHA_TEST === "1";

  if (envAllow || flag || testEnv) return;

  console.error(
    JSON.stringify(
      {
        error: "Demo seed blocked on operate databases",
        script: scriptName,
        reason:
          "Sample packs, example literature, and FLH-2026-001 cases are test fixtures only. " +
          "They must not populate FlahaINTEL operate content.",
        allow: "Set FLAHA_ALLOW_DEMO_SEED=1 or pass --for-tests (tests only).",
        fixtures: "apps/api/test/fixtures/knowledge/",
        operate: "Use real markets, real RSS, real literature registration, human APPROVED packs only.",
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

/** Canonical path root for knowledge test fixtures (apps/api/test/fixtures/knowledge). */
export function knowledgeTestFixturesRoot(): string {
  // src/knowledgePack → ../../test/fixtures/knowledge
  return fileURLToPath(new URL("../../test/fixtures/knowledge/", import.meta.url));
}
