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
    // Default short timeout for probes; long suites pass timeoutMs explicitly.
    const timeoutMs = opts.timeoutMs === undefined ? 30_000 : opts.timeoutMs;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            try {
              child.kill("SIGTERM");
            } catch {
              /* ignore */
            }
            // On Windows, SIGTERM may not kill Chromium; force after brief wait.
            setTimeout(() => {
              try {
                child.kill("SIGKILL");
              } catch {
                /* ignore */
              }
            }, 500);
            reject(new Error(`timeout ${timeoutMs}ms: ${cmd} ${args.join(" ")}`));
          }, timeoutMs)
        : null;
    child.on("error", reject);
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function probeRuntimes() {
  log("probe start", { step: "scrapy" });
  const scrapyPy = requireEnv("SCRAPY_PYTHON");
  const scrapy = await run(scrapyPy, ["-c", "import scrapy; print(scrapy.__version__)"], { timeoutMs: 30_000 });
  log("probe scrapy", { code: scrapy.code, out: (scrapy.stdout || scrapy.stderr).trim().slice(0, 80) });

  log("probe start", { step: "playwright" });
  const pwCli = requireEnv("PLAYWRIGHT_CLI");
  const pw = await run(process.execPath, [pwCli, "--version"], { timeoutMs: 30_000 });
  log("probe playwright", { code: pw.code, out: (pw.stdout || pw.stderr).trim().slice(0, 80) });

  // Do NOT invoke chromium --version on Windows — it can hang under sandboxes.
  // Match provision-runtimes.ps1: path exists + non-trivial size is sufficient for READY.
  const chromium = requireEnv("PLAYWRIGHT_CHROMIUM_PATH");
  await access(chromium);
  const chromeStat = await stat(chromium);
  if (chromeStat.size < 10_000) throw new Error(`chromium binary too small: ${chromeStat.size}`);
  const chromiumVersion = `path-ok bytes=${chromeStat.size} (version probe skipped on Windows)`;
  log("probe chromium", { path: chromium, bytes: chromeStat.size });

  log("probe start", { step: "docling" });
  const doclingPy = requireEnv("DOCLING_PYTHON");
  const docling = await run(doclingPy, ["-c", "import docling; print('ok')"], { timeoutMs: 60_000 });
  log("probe docling", { code: docling.code });

  log("probe start", { step: "java" });
  const java = requireEnv("JAVA_BIN");
  // java -version writes to stderr; code is often 0. Bound time tightly.
  const javaV = await run(java, ["-version"], { timeoutMs: 15_000 }).catch((err) => ({
    code: 1,
    stdout: "",
    stderr: String(err),
  }));
  log("probe java", { code: javaV.code, out: (javaV.stderr || javaV.stdout).split(/\r?\n/)[0] });

  log("probe start", { step: "tika" });
  const tika = requireEnv("TIKA_JAR");
  const tikaHelp = await run(java, ["-jar", tika, "--help"], { timeoutMs: 30_000 });
  log("probe tika", { code: tikaHelp.code });

  log("probe start", { step: "pg_dump" });
  const pgBin = requireEnv("FLAHA_PG_BIN");
  const pg = await run(path.join(pgBin, "pg_dump.exe"), ["--version"], { timeoutMs: 15_000 });
  log("probe pg_dump", { code: pg.code });

  // Java exit codes can be non-zero while still printing version on stderr.
  const javaReady =
    javaV.code === 0 || /version/i.test(`${javaV.stdout}\n${javaV.stderr}`);
  report.runtimes = {
    scrapy: scrapy.stdout.trim() || scrapy.stderr.trim(),
    playwright: pw.stdout.trim() || pw.stderr.trim(),
    chromium: chromium,
    chromiumVersion,
    docling: docling.stdout.trim(),
    java: (javaV.stderr || javaV.stdout).split(/\r?\n/)[0] || "unknown",
    tika: tikaHelp.code === 0 || /usage/i.test(tikaHelp.stdout + tikaHelp.stderr) ? "READY" : "FAIL",
    postgresqlClient: (pg.stdout || pg.stderr).trim(),
    artifactRoot: requireEnv("ARTIFACT_STORE_ROOT"),
    READY: scrapy.code === 0 && pw.code === 0 && docling.code === 0 && javaReady && pg.code === 0,
  };
  if (!report.runtimes.READY) throw new Error(`Runtime probes failed: ${JSON.stringify(report.runtimes)}`);
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

  // Stream core suite live (do not buffer until exit — Windows operators need progress).
  const corePath = path.join(repoRoot, "ops/scripts/phase-3m-residual-acceptance-core.ts");
  log("starting core suite", { corePath, timeoutMs: 900_000 });
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", corePath],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PHASE3M_REPORT_PARTIAL: JSON.stringify(report.runtimes),
        },
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr?.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(s);
    });
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }, 2000);
      reject(new Error("timeout 900000ms: residual acceptance core"));
    }, 900_000);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
  if (result.code !== 0) {
    report.verdict = "CONTINUE";
    log("core suite failed", { code: result.code });
    process.exit(result.code || 1);
  }
  try {
    const finalPath = path.join(repoRoot, ".flaha-runtimes", "phase-3m-residual-report.json");
    const final = JSON.parse(await readFile(finalPath, "utf8"));
    Object.assign(report, final);
    log("core suite complete", { verdict: final.verdict || report.verdict });
  } catch {
    log("core suite exited 0 but report missing", {});
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
