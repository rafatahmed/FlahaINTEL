/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Phase 3H Acquisition Workflow Integration Tests
 * Introduction:
 * Executes durable Scrapy and Playwright fixture jobs through canonical artifacts and Phase 3G completion.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FilesystemArtifactRepository, FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { prisma } from "../db.js";
import { IngestionJobService } from "../ingestionJobs/service.js";
import { PlaywrightAcquisitionAdapter, ScrapyAcquisitionAdapter } from "./adapters.js";
import type { AcquisitionAdapter } from "./contracts.js";
import { AcquisitionWorkflowService } from "./service.js";

const suite = process.env.RUN_PHASE_3H_ACCEPTANCE === "1" ? describe : describe.skip;
const namespace = `phase3h.fixture.${Date.now()}`;
const actor = { type: "SYSTEM" as const, id: "phase3h.fixture", correlationId: "phase3h.fixture" };
const limits = { maxDepth: 2, maxUrls: 10, maxRedirects: 3, maxNetworkRequests: 50, maxDownloads: 2, maxPopups: 2, maxResponseBytes: 1_000_000, wallTimeoutMs: 15_000 };
let server: Server, port: number, root: string, workflow: AcquisitionWorkflowService, artifactRepository: FilesystemArtifactRepository, scrapyAdapter: ScrapyAcquisitionAdapter, playwrightAdapter: PlaywrightAcquisitionAdapter;
let slowScrapyHit: (()=>void)|undefined, slowBrowserHit: (()=>void)|undefined;

async function cleanup() {
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    const jobs = { job: { idempotencyKey: { startsWith: namespace } } };
    await tx.ingestionProvenance.deleteMany({ where: jobs }); await tx.ingestionArtifactLink.deleteMany({ where: jobs });
    await tx.ingestionJobTransition.deleteMany({ where: jobs }); await tx.ingestionAttempt.deleteMany({ where: jobs });
    await tx.ingestionJob.deleteMany({ where: { idempotencyKey: { startsWith: namespace } } });
  });
}

suite("Phase 3H fixture acquisition", () => {
  beforeAll(async () => {
    await cleanup(); root = await mkdtemp(path.join(tmpdir(), "flaha-phase3h-"));
    artifactRepository = new FilesystemArtifactRepository(root); await artifactRepository.initialize();
    const store = new FilesystemArtifactStore(root, artifactRepository); await store.initialize();
    server = createServer((request, response) => {
      if (request.url === "/robots.txt") { response.end("User-agent: *\nAllow: /\n"); return; }
      if (request.url === "/slow-scrapy") { slowScrapyHit?.(); setTimeout(()=>response.end("slow scrapy"),10_000); return; }
      if (request.url === "/slow-resource") { slowBrowserHit?.(); setTimeout(()=>response.end("slow browser resource"),10_000); return; }
      if (request.url === "/slow-browser") { response.end('<script>fetch("/slow-resource")</script><div>slow</div>'); return; }
      if (request.url === "/dynamic") { response.setHeader("content-type", "text/html"); response.end('<!doctype html><div id="marker">initial</div><script>document.querySelector("#marker").textContent="rendered deterministic marker"</script><a href="/linked">linked</a>'); return; }
      if (request.url === "/dynamic-reroute") { response.setHeader("content-type", "text/html"); response.end('<!doctype html><div id="reroute">initial</div><script>document.querySelector("#reroute").textContent="separately routed browser marker"</script>'); return; }
      if (request.url === "/linked") { response.end("linked"); return; }
      response.setHeader("content-type", "text/html"); response.setHeader("set-cookie", "secret=forbidden");
      response.end('<!doctype html><h1>static fixture</h1><a href="/linked">linked</a><a href="http://169.254.169.254/latest">blocked</a>');
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); port = (server.address() as { port: number }).port;
    scrapyAdapter = new ScrapyAcquisitionAdapter({ executable: path.resolve(".benchmark-runtime/crawler-scrapy-2.17.0/Scripts/python.exe"), script: path.resolve("apps/ingest-worker/src/acquisition_scrapy_worker.py"), runtime:"PYTHON" });
    playwrightAdapter = new PlaywrightAcquisitionAdapter({ executable: process.execPath, script: path.resolve("apps/ingest-worker/src/acquisition_playwright_worker.mjs"), runtime:"NODE" });
    workflow = new AcquisitionWorkflowService(prisma, store, new Map([[scrapyAdapter.providerId, scrapyAdapter], [playwrightAdapter.providerId, playwrightAdapter]]));
  }, 120_000);
  afterAll(async () => { await cleanup(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); await prisma.$disconnect(); });

  it("executes Scrapy from a durable static job and persists immutable raw evidence", async () => {
    const job = await workflow.createStaticAcquisitionJob({ idempotencyKey: `${namespace}.static`, locator: { mode: "FIXTURE", scheme: "http", host: "127.0.0.1", port, relativeRoute: "/static" }, limits, actor });
    expect(job.selectedProviderId).toBe("acquisition.scrapy"); const result = await workflow.runClaimedAcquisitionAttempt("phase3h.static", actor);
    if (result?.outcome !== "SUCCESS") throw new Error(JSON.stringify(await prisma.ingestionAttempt.findFirst({ where: { jobId: job.id }, select: { errorCode: true, errorDetails: true } })));
    const stored = await prisma.ingestionJob.findUniqueOrThrow({ where: { id: job.id }, include: { artifacts: true, provenance: true } });
    expect(stored.state).toBe("SUCCEEDED"); expect(stored.artifacts.map(value => value.relationship)).toContain("RAW_RESPONSE"); expect(stored.provenance[0].providerId).toBe("acquisition.scrapy");
    expect(stored.artifacts.map(value => `${value.mediaType}:${value.sha256}`).join("|")).not.toMatch(/set-cookie|authorization/i);
  }, 120_000);

  it("executes Playwright with distinct raw and rendered artifacts", async () => {
    const job = await workflow.createDynamicBrowserAcquisitionJob({ idempotencyKey: `${namespace}.dynamic`, capability: "JAVASCRIPT_RENDERING", routingSignal: "DYNAMIC_RENDER_REQUIRED", allowDownloads: false, locator: { mode: "FIXTURE", scheme: "http", host: "127.0.0.1", port, relativeRoute: "/dynamic" }, limits, actor });
    expect(job.selectedProviderId).toBe("acquisition.playwright"); const result = await workflow.runClaimedAcquisitionAttempt("phase3h.dynamic", actor);
    if (result?.outcome !== "SUCCESS") throw new Error(JSON.stringify(await prisma.ingestionAttempt.findFirst({ where: { jobId: job.id }, select: { errorCode: true, errorDetails: true } })));
    const links = await prisma.ingestionArtifactLink.findMany({ where: { jobId: job.id } }); const raw = links.find(value => value.relationship === "RAW_RESPONSE"), rendered = links.find(value => value.relationship === "RENDERED_HTML");
    expect(raw).toBeTruthy(); expect(rendered).toBeTruthy(); expect(raw!.artifactId).not.toBe(rendered!.artifactId); expect(raw!.sha256).not.toBe(rendered!.sha256); expect((await prisma.ingestionProvenance.findFirstOrThrow({ where: { jobId: job.id } })).providerId).toBe("acquisition.playwright");
  }, 120_000);

  it("returns a typed reroute and creates a separately selected browser job", async () => {
    const staticJob=await workflow.createStaticAcquisitionJob({idempotencyKey:`${namespace}.reroute.static`,locator:{mode:"FIXTURE",scheme:"http",host:"127.0.0.1",port,relativeRoute:"/dynamic-required"},limits,actor});
    expect(staticJob.selectedProviderId).toBe("acquisition.scrapy");expect(await workflow.runClaimedAcquisitionAttempt("phase3h.reroute.static",actor)).toMatchObject({outcome:"DYNAMIC_RENDER_REQUIRED"});
    const persisted=await prisma.ingestionJob.findUniqueOrThrow({where:{id:staticJob.id},include:{attempts:true}});expect(persisted.selectedProviderId).toBe("acquisition.scrapy");expect(persisted.attempts).toHaveLength(1);expect(persisted.attempts[0].fallbackEligible).toBe(false);
    const browserJob=await workflow.createDynamicBrowserAcquisitionJob({idempotencyKey:`${namespace}.reroute.browser`,capability:"JAVASCRIPT_RENDERING",routingSignal:"DYNAMIC_RENDER_REQUIRED",allowDownloads:false,locator:{mode:"FIXTURE",scheme:"http",host:"127.0.0.1",port,relativeRoute:"/dynamic-reroute"},limits,actor});expect(browserJob.selectedProviderId).toBe("acquisition.playwright");expect(await workflow.runClaimedAcquisitionAttempt("phase3h.reroute.browser",actor)).toMatchObject({outcome:"SUCCESS"});
  },120_000);

  it("cancels after claim but before the provider launch", async () => {
    let launches=0;const never:AcquisitionAdapter={providerId:"acquisition.scrapy",providerVersion:"2.17.0",async execute(){launches++;throw new Error("provider must not launch")}};const guarded=new AcquisitionWorkflowService(prisma,(workflow as any).artifacts,new Map([[never.providerId,never]]));
    const job=await guarded.createStaticAcquisitionJob({idempotencyKey:`${namespace}.cancel.before`,locator:{mode:"FIXTURE",scheme:"http",host:"127.0.0.1",port,relativeRoute:"/static"},limits,actor});const result=await guarded.runClaimedAcquisitionAttempt("phase3h.cancel.before",actor,id=>guarded.requestCancellation(id,"test cancellation",actor));expect(result).toMatchObject({outcome:"CANCELLED"});expect(launches).toBe(0);expect((await prisma.ingestionJob.findUniqueOrThrow({where:{id:job.id}})).state).toBe("CANCELLED");expect(await prisma.ingestionArtifactLink.count({where:{jobId:job.id}})).toBe(0);expect((await artifactRepository.list()).filter(value=>value.jobId===job.id).every(value=>["ABANDONED","QUARANTINED"].includes(value.state))).toBe(true);
  });

  it("cancels a running Scrapy process without promotion or retry", async () => {
    const hit=new Promise<void>(resolve=>{slowScrapyHit=resolve});const job=await workflow.createStaticAcquisitionJob({idempotencyKey:`${namespace}.cancel.scrapy`,locator:{mode:"FIXTURE",scheme:"http",host:"127.0.0.1",port,relativeRoute:"/slow-scrapy"},limits,actor});const running=workflow.runClaimedAcquisitionAttempt("phase3h.cancel.scrapy",actor);await hit;await workflow.requestCancellation(job.id,"cancel slow Scrapy",actor);expect(await running).toMatchObject({outcome:"CANCELLED"});const persisted=await prisma.ingestionJob.findUniqueOrThrow({where:{id:job.id},include:{artifacts:true,provenance:true}});expect(persisted.state).toBe("CANCELLED");expect(persisted.nextAttemptAt).toBeNull();expect(persisted.artifacts).toHaveLength(0);expect(persisted.provenance).toHaveLength(0);slowScrapyHit=undefined;
  },30_000);

  it("cancels a running Playwright tree without promotion or retry", async () => {
    const hit=new Promise<void>(resolve=>{slowBrowserHit=resolve});const job=await workflow.createDynamicBrowserAcquisitionJob({idempotencyKey:`${namespace}.cancel.playwright`,capability:"JAVASCRIPT_RENDERING",routingSignal:"DYNAMIC_RENDER_REQUIRED",allowDownloads:false,locator:{mode:"FIXTURE",scheme:"http",host:"127.0.0.1",port,relativeRoute:"/slow-browser"},limits,actor});const running=workflow.runClaimedAcquisitionAttempt("phase3h.cancel.playwright",actor);await hit;await workflow.requestCancellation(job.id,"cancel slow browser",actor);expect(await running).toMatchObject({outcome:"CANCELLED"});const persisted=await prisma.ingestionJob.findUniqueOrThrow({where:{id:job.id},include:{artifacts:true,provenance:true}});expect(persisted.state).toBe("CANCELLED");expect(persisted.nextAttemptAt).toBeNull();expect(persisted.artifacts).toHaveLength(0);expect(persisted.provenance).toHaveLength(0);slowBrowserHit=undefined;
  },30_000);

  it("quarantines late staged output after lease recovery", async () => {
    let release!:()=>void;let started!:()=>void;const began=new Promise<void>(resolve=>{started=resolve}),gate=new Promise<void>(resolve=>{release=resolve});const late:AcquisitionAdapter={providerId:"acquisition.scrapy",providerVersion:"2.17.0",async execute(context){started();await gate;const artifacts=[];for(const allocation of context.allocations){const bytes=Buffer.from(allocation.role);await writeFile(path.join(context.workingDirectory,allocation.stagingKey),bytes);artifacts.push({artifactId:allocation.artifactId,role:allocation.role,mediaType:allocation.mediaType,stagingKey:allocation.stagingKey,byteLength:bytes.length,checksum:createHash("sha256").update(bytes).digest("hex"),writeComplete:true as const})}return {outcome:"SUCCESS",artifacts,evidence:{status:200,finalUrl:"http://fixture/",redirectChain:[],headers:{},discoveredLinks:[],networkInventory:[],downloads:[],popups:[],robotsDecision:"ALLOW",runtimeEvidence:"late-test"}}}};const stale=new AcquisitionWorkflowService(prisma,(workflow as any).artifacts,new Map([[late.providerId,late]]));const jobs=new IngestionJobService(prisma);const job=await stale.createStaticAcquisitionJob({idempotencyKey:`${namespace}.stale`,locator:{mode:"FIXTURE",scheme:"http",host:"127.0.0.1",port,relativeRoute:"/static"},limits,actor});const running=stale.runClaimedAcquisitionAttempt("phase3h.stale",actor);await began;await prisma.ingestionAttempt.updateMany({where:{jobId:job.id,state:"RUNNING"},data:{leasedAt:new Date(0),startedAt:new Date(0),heartbeatAt:new Date(0),leaseExpiresAt:new Date(1)}});await jobs.recoverExpiredLeases(10,{...actor,type:"RECOVERY"});release();await expect(running).rejects.toThrow();expect(await prisma.ingestionArtifactLink.count({where:{jobId:job.id}})).toBe(0);expect(await prisma.ingestionProvenance.count({where:{jobId:job.id}})).toBe(0);expect((await prisma.ingestionJob.findUniqueOrThrow({where:{id:job.id}})).state).toBe("RETRY_WAIT");const lateArtifacts=(await artifactRepository.list()).filter(value=>value.jobId===job.id);expect(lateArtifacts).toHaveLength(3);expect(lateArtifacts.every(value=>value.state==="QUARANTINED")).toBe(true);
  },30_000);
});
