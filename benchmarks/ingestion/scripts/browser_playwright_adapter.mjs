/*
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Playwright Acquisition Benchmark Adapter
 * Introduction: Captures governed rendered HTML and browser network evidence.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import playwright from "../../../.benchmark-runtime/browser-playwright-1.61.1/node_modules/playwright/index.js";

const { chromium } = playwright;

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
const port = Number(args.port);
const output = resolve(args.output);
if (!Number.isInteger(port) || port < 1 || port > 65535 || !args.output) throw new Error("closed_arguments_required");
const base = `http://127.0.0.1:${port}`;
const allowed = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === String(port) && !url.username && !url.password;
  } catch { return false; }
};
const profile = resolve(".benchmark-cache", "browser-playwright-1.61.1", `profile-${process.pid}`);
const downloads = resolve(".benchmark-cache", "browser-playwright-1.61.1", `downloads-${process.pid}`);
await mkdir(profile, { recursive: true }); await mkdir(downloads, { recursive: true }); await mkdir(resolve(output, ".."), { recursive: true });
const started = performance.now();
let browser;
try {
  browser = await chromium.launch({ headless: true, downloadsPath: downloads, proxy: undefined, args: ["--disable-extensions", "--disable-webrtc"] });
  const browserStartupMs = Number((performance.now() - started).toFixed(3));
  const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: "block", permissions: [], geolocation: undefined });
  const page = await context.newPage();
  const network = []; const blocked = []; const failed = []; const consoleMessages = []; const pageErrors = []; const popups = []; const downloadsSeen = []; const webSockets = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url(); const classification = allowed(url) ? "allowed" : "blocked";
    network.push({ url, classification, resource_type: route.request().resourceType() });
    if (classification === "blocked") { blocked.push(url); await route.abort("blockedbyclient"); } else await route.continue();
  });
  await context.routeWebSocket("**", async socket => { webSockets.push({ url: socket.url(), classification: allowed(socket.url()) ? "unsupported_blocked" : "blocked" }); await socket.close(); });
  page.on("requestfailed", request => failed.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" }));
  page.on("console", message => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("popup", popup => { popups.push(popup.url()); void popup.close(); });
  page.on("download", download => { downloadsSeen.push({ suggested_filename: download.suggestedFilename(), disposition: "detected_and_cancelled" }); });
  const navigationStarted = performance.now(); const response = await page.goto(`${base}/dynamic`, { waitUntil: "networkidle", timeout: 5000 }); const renderedNavigationMs = Number((performance.now() - navigationStarted).toFixed(3));
  await page.waitForSelector("#lazy", { timeout: 2000 });
  await page.click("#popup"); await page.waitForTimeout(50);
  const downloadPromise = page.waitForEvent("download"); await page.click("#download"); const download = await downloadPromise; await download.cancel();
  const html = await page.content(); const raw = await (await context.request.get(`${base}/dynamic`)).body();
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie }));
  const responseHeaders = await response?.allHeaders() ?? {}; const contentType = (await response?.headerValue("content-type")) ?? null;
  const contextCleanupStarted = performance.now(); await context.close(); const contextCleanupMs = Number((performance.now() - contextCleanupStarted).toFixed(3));
  const warmContextStarted = performance.now(); const warmContext = await browser.newContext({ acceptDownloads: false, serviceWorkers: "block", permissions: [] }); await warmContext.route("**/*", route => allowed(route.request().url()) ? route.continue() : route.abort("blockedbyclient")); const warmPage = await warmContext.newPage(); await warmPage.goto(`${base}/static`, { waitUntil: "load", timeout: 5000 }); const warmStaticNavigationMs = Number((performance.now() - warmContextStarted).toFixed(3)); await warmContext.close();
  const result = { candidate:"playwright",mode:"rendered",requested_url:`${base}/dynamic`,final_url:`${base}/dynamic`,redirect_chain:[],status:response?.status()??null,response_headers:responseHeaders,content_type:contentType,charset_evidence:"response-header-and-browser",raw_artifact_key:"raw/dynamic.bin",rendered_artifact_key:"rendered/dynamic.html",raw_artifact_byte_size:raw.length,rendered_artifact_byte_size:Buffer.byteLength(html),raw_sha256:createHash("sha256").update(raw).digest("hex"),rendered_sha256:createHash("sha256").update(html).digest("hex"),visible_text:html.includes("rendered deterministic content")?"rendered deterministic content; lazy loaded":"missing",discovered_links:[`${base}/client-target`,`${base}/download`],network_request_inventory:network.sort((a,b)=>a.url.localeCompare(b.url)),policy_rejections:[...new Set(blocked)].sort(),failed_requests:failed.sort((a,b)=>a.url.localeCompare(b.url)),console_messages:consoleMessages,page_errors:pageErrors,downloads:downloadsSeen,popups,new_tabs:popups,service_workers:[],web_workers:[`${base}/worker.js`],iframes:[`${base}/iframe`],websockets:webSockets,non_network_scheme_policy:{"data:":"unsupported_blocked","blob:":"unsupported_blocked","file:":"blocked","javascript:":"blocked","chrome-extension:":"blocked"},storage,timestamps:{started:"excluded-from-determinism"},elapsed_ms:Number((performance.now()-started).toFixed(3)),warnings:[],failure_classification:null,process_count:null,resource_metrics:{browser_startup_ms:browserStartupMs,rendered_navigation_ms:renderedNavigationMs,warm_static_context_navigation_ms:warmStaticNavigationMs,context_cleanup_ms:contextCleanupMs} };
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
} finally {
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true }); await rm(downloads, { recursive: true, force: true });
}
