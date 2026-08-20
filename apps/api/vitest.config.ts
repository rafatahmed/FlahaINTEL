/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: API Vitest Config
 * Introduction: Resolves workspace packages from TypeScript source during tests.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-20
 * Last modified: 2026-08-20
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["development", "node", "import"],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
