/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Phase 3H Acquisition Contract Integration Tests
 * Introduction: Verifies adapter-specific ownership rejection and supervised failure cleanup without duplicating generic JSONL tests.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { mkdtemp, rm } from "node:fs/promises";import { tmpdir } from "node:os";import path from "node:path";import { afterAll,beforeAll,describe,expect,it } from "vitest";import { FilesystemArtifactRepository,FilesystemArtifactStore } from "@flaha-intel/artifact-store";import { prisma } from "../db.js";import { PlaywrightAcquisitionAdapter,ScrapyAcquisitionAdapter } from "./adapters.js";import { AcquisitionWorkflowService } from "./service.js";
const suite=process.env.RUN_PHASE_3H_ACCEPTANCE==="1"?describe:describe.skip,namespace=`phase3h.contract.${Date.now()}`,actor={type:"SYSTEM" as const,id:"phase3h.contract",correlationId:"phase3h.contract"};const baseLimits={maxDepth:1,maxUrls:1,maxRedirects:1,maxNetworkRequests:10,maxDownloads:1,maxPopups:1,maxResponseBytes:100_000,wallTimeoutMs:1_000};let root:string,repository:FilesystemArtifactRepository,store:FilesystemArtifactStore;
async function cleanup(){await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");const jobs={job:{idempotencyKey:{startsWith:namespace}}};await tx.ingestionProvenance.deleteMany({where:jobs});await tx.ingestionArtifactLink.deleteMany({where:jobs});await tx.ingestionJobTransition.deleteMany({where:jobs});await tx.ingestionAttempt.deleteMany({where:jobs});await tx.ingestionJob.deleteMany({where:{idempotencyKey:{startsWith:namespace}}})})}
function workflow(provider:"scrapy"|"playwright"){const runtime={executable:process.execPath,script:path.resolve("apps/ingest-worker/tests/acquisition_protocol_fixture.mjs"),runtime:"NODE" as const};const adapter=provider==="scrapy"?new ScrapyAcquisitionAdapter(runtime):new PlaywrightAcquisitionAdapter(runtime);return new AcquisitionWorkflowService(prisma,store,new Map([[adapter.providerId,adapter]]))}
async function assertRejected(mode:string,provider:"scrapy"|"playwright"="scrapy"){const service=workflow(provider),idempotencyKey=`${namespace}.${provider}.${mode}`;const locator={mode:"FIXTURE" as const,scheme:"http" as const,host:"127.0.0.1",port:1,relativeRoute:`/fault/${mode}`};const job=provider==="scrapy"?await service.createStaticAcquisitionJob({idempotencyKey,locator,limits:baseLimits,actor}):await service.createDynamicBrowserAcquisitionJob({idempotencyKey,capability:"JAVASCRIPT_RENDERING",routingSignal:"DYNAMIC_RENDER_REQUIRED",allowDownloads:false,locator,limits:baseLimits,actor});expect(await service.runClaimedAcquisitionAttempt(`phase3h.${provider}.${mode}`,actor)).toMatchObject({outcome:"FAILED"});expect(await prisma.ingestionArtifactLink.count({where:{jobId:job.id}})).toBe(0);expect(await prisma.ingestionProvenance.count({where:{jobId:job.id}})).toBe(0);const metadata=(await repository.list()).filter(value=>value.jobId===job.id);expect(metadata.length).toBeGreaterThan(0);expect(metadata.every(value=>["QUARANTINED","ABANDONED"].includes(value.state))).toBe(true)}
suite("acquisition-specific contract authority",()=>{
  beforeAll(async()=>{await cleanup();root=await mkdtemp(path.join(tmpdir(),"flaha-phase3h-contract-"));repository=new FilesystemArtifactRepository(root);await repository.initialize();store=new FilesystemArtifactStore(root,repository);await store.initialize()});afterAll(async()=>{await cleanup();await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});await prisma.$disconnect()});
  it.each(["wrong-job","wrong-attempt","wrong-execution","wrong-provider","wrong-capability","unknown-allocation","unallocated-reference","wrong-relationship","hash-mismatch","size-mismatch","duplicate-artifact","missing-raw"])("rejects %s",mode=>assertRejected(mode));
  it("rejects browser success without rendered output",()=>assertRejected("missing-rendered","playwright"));
  it.each([["scrapy","timeout"],["scrapy","crash"],["playwright","timeout"],["playwright","crash"]] as const)("cleans %s %s",(provider,mode)=>assertRejected(mode,provider));
});
