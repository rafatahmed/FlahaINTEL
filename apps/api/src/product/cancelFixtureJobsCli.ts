/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Cancel Fixture / Test Acquisition Jobs CLI
 * Introduction:
 * Cancels READY/PENDING/RETRY_WAIT acquisition jobs pointed at example.com
 * or loopback — clears Jobs UI noise without touching real PA evidence.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 *
 * Usage:
 *   npm run ops:cancel-fixture-jobs
 *   npm run ops:cancel-fixture-jobs -- --confirm
 *   npm run ops:cancel-fixture-jobs -- --confirm --also-cancel-test-submissions
 */
import path from "node:path";
import {
  FilesystemArtifactRepository,
  FilesystemArtifactStore,
} from "@flaha-intel/artifact-store";
import { PrismaClient } from "@prisma/client";
import { IngestionJobService } from "../ingestionJobs/service.js";
import { getProductionConfig } from "../production/config.js";
import type { ProductActor } from "./auth.js";
import { SubmissionOrchestrator } from "./submission/orchestrator.js";

const confirm = process.argv.includes("--confirm");
const alsoSubs = process.argv.includes("--also-cancel-test-submissions");
const prisma = new PrismaClient();
const jobs = new IngestionJobService(prisma);

const FIXTURE_HOSTS = new Set(["example.com", "localhost", "127.0.0.1", "quotes.toscrape.com"]);
const TENANT = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";

function hostOf(locator: unknown): string {
  if (!locator || typeof locator !== "object") return "";
  const h = (locator as { host?: string }).host;
  return (h || "").toLowerCase();
}

function isFixtureHost(host: string): boolean {
  return FIXTURE_HOSTS.has(host);
}

const actor = {
  type: "ADMIN" as const,
  id: "ops-cancel-fixture-jobs",
  correlationId: `ops-cancel-fixture-${Date.now()}`,
};

try {
  const candidates = await prisma.ingestionJob.findMany({
    where: {
      state: { in: ["READY", "PENDING", "RETRY_WAIT"] },
      jobType: { in: ["STATIC_ACQUISITION", "BROWSER_ACQUISITION"] },
    },
    select: { id: true, state: true, jobType: true, sourceLocator: true, mediaType: true },
    take: 200,
  });

  const fixtureJobs = candidates.filter((j) => isFixtureHost(hostOf(j.sourceLocator)));
  const results: Array<Record<string, unknown>> = [];

  for (const j of fixtureJobs) {
    if (!confirm) {
      results.push({
        jobId: j.id,
        state: j.state,
        host: hostOf(j.sourceLocator),
        dryRun: true,
      });
      continue;
    }
    try {
      const updated = await jobs.requestCancellation(
        j.id,
        "Operate hygiene: cancel fixture/test acquisition (example.com/loopback/scrape-demo).",
        actor,
      );
      results.push({ jobId: j.id, state: updated.state, host: hostOf(j.sourceLocator), cancelled: true });
    } catch (e) {
      results.push({
        jobId: j.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const subResults: Array<Record<string, unknown>> = [];
  if (alsoSubs) {
    // Cross-tenant hygiene for known fixture hosts only (example.com / scrape demos).
    // Prefer orchestrator when tenant is flaha-local; otherwise direct CANCELLED for residual test rows.
    const openSubs = await prisma.productSubmission.findMany({
      where: {
        overallStatus: { in: ["RUNNING", "FAILED", "WAITING_MANUAL", "ACCEPTED"] },
      },
      select: {
        id: true,
        tenantId: true,
        overallStatus: true,
        sourceLocator: true,
        titlePreview: true,
        submissionType: true,
        acquisitionJobId: true,
        extractionJobId: true,
        normalizationJobId: true,
      },
      take: 200,
    });

    const tenant = await prisma.tenant.findUnique({ where: { code: TENANT } });
    const user = await prisma.userAccount.findUnique({ where: { email: ADMIN } });
    let orch: SubmissionOrchestrator | null = null;
    let productActor: ProductActor | null = null;
    if (tenant && user) {
      const repoRoot = path.resolve(process.cwd(), "../..");
      if (!process.env.ARTIFACT_STORE_ROOT && !process.env.FLAHA_ARTIFACT_ROOT) {
        process.env.ARTIFACT_STORE_ROOT = path.join(repoRoot, ".flaha-artifacts-local");
      }
      const prod = getProductionConfig();
      const repository = new FilesystemArtifactRepository(prod.artifactRoot);
      const store = new FilesystemArtifactStore(prod.artifactRoot, repository);
      await store.initialize();
      orch = new SubmissionOrchestrator(prisma, store);
      productActor = {
        tenantId: tenant.id,
        userId: user.id,
        role: "GOVERNANCE_ADMIN",
        email: user.email,
        displayName: user.displayName || user.email,
        correlationId: `ops-cancel-fixture-${Date.now()}`,
      };
    }

    for (const s of openSubs) {
      const host = hostOf(s.sourceLocator);
      const preview = (s.titlePreview || "").toLowerCase();
      const isTest =
        isFixtureHost(host) ||
        preview.includes("quotes.toscrape.com") ||
        preview.includes("example.com");
      if (!isTest) continue;
      if (!confirm) {
        subResults.push({
          submissionId: s.id,
          tenantId: s.tenantId,
          dryRun: true,
          host,
          preview: s.titlePreview,
        });
        continue;
      }
      try {
        if (orch && productActor && tenant && s.tenantId === tenant.id) {
          const cancelled = await orch.cancelSubmission(
            productActor,
            s.id,
            "Operate hygiene: cancel test website submission.",
          );
          subResults.push({
            submissionId: s.id,
            overallStatus: cancelled.overallStatus,
            cancelled: true,
            path: "orchestrator",
          });
        } else {
          for (const jobId of [s.acquisitionJobId, s.extractionJobId, s.normalizationJobId]) {
            if (!jobId) continue;
            const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
            if (job && ["READY", "PENDING", "LEASED", "RUNNING", "RETRY_WAIT"].includes(job.state)) {
              await jobs.requestCancellation(
                jobId,
                "Operate hygiene: cancel fixture job under test submission.",
                actor,
              ).catch(() => undefined);
            }
          }
          await prisma.productSubmissionStage.updateMany({
            where: { submissionId: s.id, status: { in: ["PENDING", "RUNNING"] } },
            data: {
              status: "CANCELLED",
              completedAt: new Date(),
              errorCode: "CANCELLED",
              errorMessage: "Operate hygiene: cancel test website submission.",
            },
          });
          const cancelled = await prisma.productSubmission.update({
            where: { id: s.id },
            data: {
              overallStatus: "CANCELLED",
              lastErrorCode: "CANCELLED",
              lastErrorMessage: "Operate hygiene: cancel test website submission.",
              version: { increment: 1 },
            },
          });
          subResults.push({
            submissionId: s.id,
            tenantId: s.tenantId,
            overallStatus: cancelled.overallStatus,
            cancelled: true,
            path: "direct-cross-tenant-fixture",
          });
        }
      } catch (e) {
        subResults.push({
          submissionId: s.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        gate: "cancel-fixture-jobs",
        confirm,
        alsoCancelTestSubmissions: alsoSubs,
        fixtureJobsFound: fixtureJobs.length,
        jobs: results,
        submissions: subResults,
        hint: confirm
          ? "Done."
          : "Dry-run only. Re-run with --confirm. Optional: --also-cancel-test-submissions for quotes.toscrape.com WEBSITE_URL.",
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
