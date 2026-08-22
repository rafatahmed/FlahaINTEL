/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Local Runtime Binaries
 * Introduction: Resolves Python/Scrapy executables from env before hardcoded host paths.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-20
 * Last modified: 2026-08-22
 */
import path from "node:path";

export function absoluteEnvPath(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !path.isAbsolute(trimmed) || trimmed.includes("\0")) return undefined;
  return path.resolve(trimmed);
}

/** Playwright paths the isolated browser worker is allowed to see. */
export function playwrightWorkerEnv(source: NodeJS.ProcessEnv = process.env): {
  PLAYWRIGHT_CHROMIUM_PATH?: string;
  PLAYWRIGHT_BROWSERS_PATH?: string;
  PLAYWRIGHT_MODULE?: string;
} {
  const chromium = absoluteEnvPath(source.PLAYWRIGHT_CHROMIUM_PATH) || absoluteEnvPath(source.CHROMIUM_PATH);
  const browsers = absoluteEnvPath(source.PLAYWRIGHT_BROWSERS_PATH);
  const modulePath = absoluteEnvPath(source.PLAYWRIGHT_MODULE);
  return {
    ...(chromium ? { PLAYWRIGHT_CHROMIUM_PATH: chromium } : {}),
    ...(browsers ? { PLAYWRIGHT_BROWSERS_PATH: browsers } : {}),
    ...(modulePath ? { PLAYWRIGHT_MODULE: modulePath } : {}),
  };
}

export function resolvePython(repositoryRoot: string): string {
  const env = process.env.PYTHON_BIN?.trim() || process.env.SCRAPY_PYTHON?.trim();
  if (env) return env;
  if (process.platform === "win32") {
    return "C:/Python314/python.exe";
  }
  return path.join(repositoryRoot, ".benchmark-runtime/crawler-scrapy-2.17.0/bin/python");
}

export function resolveScrapyPython(repositoryRoot: string): string {
  const env = process.env.SCRAPY_PYTHON?.trim() || process.env.PYTHON_BIN?.trim();
  if (env) return env;
  if (process.platform === "win32") {
    return path.join(repositoryRoot, ".benchmark-runtime/crawler-scrapy-2.17.0/Scripts/python.exe");
  }
  return path.join(repositoryRoot, ".benchmark-runtime/crawler-scrapy-2.17.0/bin/python");
}
