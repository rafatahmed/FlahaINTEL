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
 * Last modified: 2026-08-20
 */
import path from "node:path";

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
