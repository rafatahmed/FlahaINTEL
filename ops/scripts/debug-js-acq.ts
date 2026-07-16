import path from "node:path";
import { FilesystemArtifactRepository, FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { prisma } from "../../apps/api/src/db.js";
import { PlaywrightAcquisitionAdapter, ScrapyAcquisitionAdapter } from "../../apps/api/src/acquisition/adapters.js";
import { AcquisitionWorkflowService } from "../../apps/api/src/acquisition/service.js";
import { SubmissionOrchestrator } from "../../apps/api/src/product/submission/orchestrator.js";

const repo = path.resolve(import.meta.dirname, "../..");
const root = process.env.ARTIFACT_STORE_ROOT!;
const repository = new FilesystemArtifactRepository(root);
await repository.initialize();
const store = new FilesystemArtifactStore(root, repository);
await store.initialize();
const schemas = path.join(repo, "packages/ingestion-contracts/schemas/v1");
const scrapy = new ScrapyAcquisitionAdapter({
  executable: process.env.SCRAPY_PYTHON!,
  script: path.join(repo, "apps/ingest-worker/src/acquisition_scrapy_worker.py"),
  runtime: "PYTHON",
  schemas,
});
const playwright = new PlaywrightAcquisitionAdapter({
  executable: process.execPath,
  script: path.join(repo, "apps/ingest-worker/src/acquisition_playwright_worker.mjs"),
  runtime: "NODE",
  schemas,
});
const adapters = new Map([
  [scrapy.providerId, scrapy],
  [playwright.providerId, playwright],
]);
const acquisition = new AcquisitionWorkflowService(prisma, store, adapters);
const orchestrator = new SubmissionOrchestrator(prisma, store, adapters, new Map());

const ns = `debug.js.${Date.now()}`;
const tenant = await prisma.tenant.create({ data: { code: `${ns}.t`, name: "dbg", active: true } });
const user = await prisma.userAccount.create({
  data: {
    email: `${ns}@t.local`,
    displayName: "a",
    memberships: { create: { tenantId: tenant.id, role: "GOVERNANCE_ADMIN", active: true } },
  },
});
const actor = {
  userId: user.id,
  tenantId: tenant.id,
  role: "GOVERNANCE_ADMIN" as const,
  email: user.email,
  displayName: "a",
  correlationId: ns,
};

const sub = await orchestrator.createWebsiteSubmission(actor, {
  url: "https://quotes.toscrape.com/js/",
  acquisitionMode: "BROWSER",
  chainMode: "MANUAL_STAGE",
  languageHint: "en",
  idempotencyKey: `${ns}.js`,
  wallTimeoutMs: 60_000,
  maxResponseBytes: 2_000_000,
});
console.log("created", sub.id, sub.acquisitionJobId);
let job = await prisma.ingestionJob.findUnique({ where: { id: sub.acquisitionJobId! } });
console.log("before claim", job?.state, job?.selectedProviderId, job?.attemptCount, job?.maxAttempts);

const result = await acquisition.runClaimedAcquisitionAttempt("debug.claim", {
  type: "SYSTEM",
  id: "debug",
  correlationId: ns,
});
console.log("claim result", JSON.stringify(result));
job = await prisma.ingestionJob.findUnique({
  where: { id: sub.acquisitionJobId! },
  include: { attempts: true, transitions: { orderBy: { createdAt: "asc" } } },
});
console.log(
  "after",
  job?.state,
  job?.attempts.map((a) => ({ state: a.state, errorCode: a.errorCode, msg: a.errorMessage?.slice(0, 300) })),
);
console.log(
  "transitions",
  job?.transitions.map((t) => ({ from: t.fromState, to: t.toState, reason: t.reasonCode, note: String(t.note ?? "").slice(0, 200) })),
);
await prisma.$disconnect();
