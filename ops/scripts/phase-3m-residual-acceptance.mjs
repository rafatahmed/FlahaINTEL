/**
 * Flaha Agri Tech — Phase 3M residual acceptance (runtimes, workers, JS site, crawl, prod auth, backup)
 * Run from repo root after provision-runtimes.ps1. Leaves ops residue cleaned.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile, copyFile, cp, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const report = {
  startedAt: new Date().toISOString(),
  runtimes: {},
  workers: {},
  javascript: {},
  crawl: {},
  auth: {},
  backup: {},
  cleanup: {},
  verdict: "CONTINUE",
};

function log(msg, extra) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg, ...extra }));
}

async function loadRuntimeEnv() {
  const envFile = path.join(repoRoot, ".flaha-runtimes", "runtime-paths.env");
  const text = await readFile(envFile, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k && v) process.env[k] = v;
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || repoRoot,
      env: { ...process.env, ...opts.env },
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error(`timeout ${cmd} ${args.join(" ")}`));
        }, opts.timeoutMs)
      : null;
    child.on("error", reject);
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function probeRuntimes() {
  const scrapyPy = requireEnv("SCRAPY_PYTHON");
  const scrapy = await run(scrapyPy, ["-c", "import scrapy; print(scrapy.__version__)"]);
  const pwCli = requireEnv("PLAYWRIGHT_CLI");
  const pw = await run(process.execPath, [pwCli, "--version"]);
  const chromium = requireEnv("PLAYWRIGHT_CHROMIUM_PATH");
  await access(chromium);
  const chromeVer = await run(chromium, ["--version"]).catch(() => ({ stdout: "exists", code: 0 }));
  const doclingPy = requireEnv("DOCLING_PYTHON");
  const docling = await run(doclingPy, ["-c", "import docling; print('ok')"]);
  const java = requireEnv("JAVA_BIN");
  const javaV = await run(java, ["-version"]);
  const tika = requireEnv("TIKA_JAR");
  const tikaHelp = await run(java, ["-jar", tika, "--help"]);
  const pgBin = requireEnv("FLAHA_PG_BIN");
  const pg = await run(path.join(pgBin, "pg_dump.exe"), ["--version"]);
  report.runtimes = {
    scrapy: scrapy.stdout.trim() || scrapy.stderr.trim(),
    playwright: pw.stdout.trim() || pw.stderr.trim(),
    chromium: chromium,
    chromiumVersion: (chromeVer.stdout || chromeVer.stderr || "").trim().slice(0, 120),
    docling: docling.stdout.trim(),
    java: (javaV.stderr || javaV.stdout).split(/\r?\n/)[0],
    tika: tikaHelp.code === 0 || /usage/i.test(tikaHelp.stdout + tikaHelp.stderr) ? "READY" : "FAIL",
    postgresqlClient: (pg.stdout || pg.stderr).trim(),
    artifactRoot: requireEnv("ARTIFACT_STORE_ROOT"),
    READY: scrapy.code === 0 && pw.code === 0 && docling.code === 0 && javaV.code === 0,
  };
  if (!report.runtimes.READY) throw new Error("Runtime probes failed");
}

// Dynamic import of API modules after env is set
async function loadApi() {
  process.chdir(path.join(repoRoot, "apps/api"));
  // Ensure tsx/register via node --import when launched; this script uses compiled dist if present else tsx
  const distApp = path.join(repoRoot, "apps/api/dist/product/auth.js");
  try {
    await access(distApp);
    return {
      mode: "dist",
      root: path.join(repoRoot, "apps/api/dist"),
    };
  } catch {
    return { mode: "tsx", root: path.join(repoRoot, "apps/api/src") };
  }
}

async function main() {
  await loadRuntimeEnv();
  process.env.PLAYWRIGHT_BROWSERS_PATH =
    process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.USERPROFILE || "", "AppData/Local/ms-playwright");
  process.env.FLAHA_ARTIFACT_ROOT = process.env.ARTIFACT_STORE_ROOT;
  process.env.CRAWL_POLICY_ENFORCE = "true";
  process.env.CRAWL_POLICY_PATH = path.join(repoRoot, "ops/config/crawl-policy.acceptance.json");

  // acceptance crawl policy for quotes.toscrape.com + books.toscrape.com
  await writeFile(
    process.env.CRAWL_POLICY_PATH,
    JSON.stringify(
      {
        version: "3m.acceptance",
        userAgent: "FlahaINTEL/3M (+https://flaha.local; controlled-crawl; contact-ops)",
        respectRobots: true,
        maxPages: 10,
        maxDepth: 1,
        maxRedirects: 3,
        maxAttachments: 2,
        maxAttachmentBytes: 5_000_000,
        maxTotalCrawlBytes: 20_000_000,
        rateLimitPerHostPerMinute: 20,
        allowedHosts: ["quotes.toscrape.com", "books.toscrape.com", "example.com"],
        allowedPathPrefixes: {
          "quotes.toscrape.com": ["/", "/js/", "/js"],
          "books.toscrape.com": ["/", "/catalogue/"],
          "example.com": ["/"],
        },
        allowedAttachmentTypes: ["text/html", "application/pdf", "text/plain"],
        schedule: { mode: "manual" },
      },
      null,
      2,
    ),
    "utf8",
  );

  await probeRuntimes();
  log("runtimes ready", report.runtimes);

  // Launch targeted acceptance via tsx child so TypeScript modules resolve
  const childScript = path.join(repoRoot, "ops/scripts/phase-3m-residual-acceptance-core.mts");
  // write core as .ts next to this and invoke via npx tsx
  const result = await run(
    process.execPath,
    ["--import", "tsx", path.join(repoRoot, "ops/scripts/phase-3m-residual-acceptance-core.ts")],
    {
      timeoutMs: 900_000,
      env: {
        ...process.env,
        PHASE3M_REPORT_PARTIAL: JSON.stringify(report.runtimes),
      },
    },
  );
  console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  if (result.code !== 0) {
    report.verdict = "CONTINUE";
    process.exit(result.code || 1);
  }
  try {
    const finalPath = path.join(repoRoot, ".flaha-runtimes", "phase-3m-residual-report.json");
    const final = JSON.parse(await readFile(finalPath, "utf8"));
    Object.assign(report, final);
  } catch {
    /* core prints report */
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
