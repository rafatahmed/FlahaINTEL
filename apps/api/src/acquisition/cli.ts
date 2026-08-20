/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Acquisition Workflow Internal CLI
 * Introduction:
 * Provides bounded create, worker-once, job inspection, and artifact inspection commands without public routes.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-20
 */
import path from "node:path";
import { FilesystemArtifactRepository, FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { prisma } from "../db.js";
import { IngestionJobService } from "../ingestionJobs/service.js";
import { PlaywrightAcquisitionAdapter, ScrapyAcquisitionAdapter } from "./adapters.js";
import type { AcquisitionAdapter } from "./contracts.js";
import { AcquisitionWorkflowService } from "./service.js";
import { resolveScrapyPython } from "../production/runtimeBins.js";

const pairs: [string, string][] = [];
for (let index = 3; index < process.argv.length; index += 1) if (process.argv[index].startsWith("--")) pairs.push([process.argv[index].slice(2), process.argv[index + 1] ?? ""]);
const args = Object.fromEntries(pairs), command = process.argv[2];
const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const root = path.resolve(process.env.FLAHA_ARTIFACT_ROOT ?? process.env.ARTIFACT_STORE_ROOT ?? path.join(repositoryRoot, ".flaha-artifacts-local"));
const repository = new FilesystemArtifactRepository(root); await repository.initialize();
const store = new FilesystemArtifactStore(root, repository); await store.initialize();
const schemas = path.join(repositoryRoot, "packages/ingestion-contracts/schemas/v1");
const scrapy = new ScrapyAcquisitionAdapter({ executable: resolveScrapyPython(repositoryRoot), script: path.join(repositoryRoot, "apps/ingest-worker/src/acquisition_scrapy_worker.py"), runtime: "PYTHON", schemas });
const playwright = new PlaywrightAcquisitionAdapter({ executable: process.execPath, script: path.join(repositoryRoot, "apps/ingest-worker/src/acquisition_playwright_worker.mjs"), runtime: "NODE", schemas });
const adapters = new Map<string, AcquisitionAdapter>([[scrapy.providerId, scrapy], [playwright.providerId, playwright]]);
const workflow = new AcquisitionWorkflowService(prisma, store, adapters);
const actor = { type: "ADMIN" as const, id: "acquisition.cli", correlationId: `acquisition.cli.${Date.now()}` };
const limits = { maxDepth: 2, maxUrls: 20, maxRedirects: 3, maxNetworkRequests: 100, maxDownloads: 2, maxPopups: 2, maxResponseBytes: 5_000_000, wallTimeoutMs: 30_000 };

try {
  if (command === "create") {
    const url = new URL(args.url); const locator = { mode: (args.fixture === "true" ? "FIXTURE" : "PUBLIC") as "FIXTURE" | "PUBLIC", scheme: url.protocol.slice(0, -1) as "http" | "https", host: url.hostname, port: Number(url.port || (url.protocol === "https:" ? 443 : 80)), relativeRoute: `${url.pathname}${url.search}` };
    const job = args.dynamic === "true" ? await workflow.createDynamicBrowserAcquisitionJob({ idempotencyKey: args.idempotencyKey, capability: "JAVASCRIPT_RENDERING", routingSignal: "DYNAMIC_RENDER_REQUIRED", allowDownloads: false, locator, limits, actor }) : await workflow.createStaticAcquisitionJob({ idempotencyKey: args.idempotencyKey, locator, limits, actor });
    console.log(JSON.stringify({ id: job.id, state: job.state, selectedProviderId: job.selectedProviderId }));
  } else if (command === "worker-once") console.log(JSON.stringify(await workflow.runClaimedAcquisitionAttempt(args.workerId || "acquisition.cli.worker", actor)));
  else if (command === "job") {
    const jobs = new IngestionJobService(prisma), job = await jobs.getJob(args.jobId), attempts = await jobs.listJobAttempts(args.jobId), transitions = await jobs.listJobTransitions(args.jobId);
    const artifacts = await prisma.ingestionArtifactLink.findMany({ where: { jobId: args.jobId }, select: { id: true, artifactId: true, attemptId: true, relationship: true, mediaType: true, sha256: true, byteSize: true, createdAt: true } });
    const provenance = await prisma.ingestionProvenance.findMany({ where: { jobId: args.jobId }, select: { providerId: true, providerVersion: true, capability: true, policyVersion: true, inputHashes: true, outputHashes: true, determinismClassification: true, createdAt: true } });
    console.log(JSON.stringify({ job, attempts, transitions, artifacts: artifacts.map(value => ({ ...value, byteSize: value.byteSize.toString() })), provenance }));
  } else if (command === "artifact") { const value = await store.metadata(args.artifactId); console.log(JSON.stringify({ artifactId: value.artifactId, state: value.state, byteLength: value.byteLength, checksum: value.checksum, createdAt: value.createdAt, updatedAt: value.updatedAt })); }
  else throw new Error("Expected create, worker-once, job, or artifact command.");
} finally { await prisma.$disconnect(); }
