/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Evidence Intake API Routes
 * Introduction: Central Submit spine — land, classify, promote, list.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-08-21
 */
import type { EvidenceIntakeClass, EvidenceIntakeStatus, PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import type { FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import multipart from "@fastify/multipart";
import { AppError } from "../errors.js";
import { INTAKE_CLASS_META, SISTER_PRODUCTS } from "../intake/contracts.js";
import { EvidenceIntakeService, IntakeError } from "../intake/service.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";
import { getProductionConfig } from "../production/config.js";
import { harvestList, loadCrawlPolicy } from "../production/crawlPolicy.js";
import { SubmissionOrchestrator } from "../product/submission/orchestrator.js";

function mapError(error: unknown): never {
  if (error instanceof IntakeError) {
    throw new AppError(error.statusCode, error.code, error.message);
  }
  if (isProductError(error)) {
    throw new AppError(error.statusCode, error.code, error.message);
  }
  throw error;
}

const CLASSES = Object.keys(INTAKE_CLASS_META) as EvidenceIntakeClass[];

export function intakeRoutes(
  prisma: PrismaClient,
  store: FilesystemArtifactStore,
): FastifyPluginAsync {
  return async (app) => {
    const prod = getProductionConfig();
    const orchestrator = new SubmissionOrchestrator(prisma, store);
    const intakes = new EvidenceIntakeService(prisma, store, orchestrator);

    await app.register(multipart, {
      limits: { files: 1, fields: 20, fileSize: prod.maxUploadBytes, parts: 25 },
    });

    app.get("/intake/matrix", async (request) => {
      try {
        await resolveProductActor(prisma, request);
        const policy = await loadCrawlPolicy();
        return {
          principle: "Land once on the evidence spine; promote into domain engines — do not re-ingest per model.",
          classes: CLASSES.map((c) => ({ code: c, ...INTAKE_CLASS_META[c] })),
          flow: ["LAND", "CLASSIFY", "PROMOTE"],
          harvest: {
            kind: "one_page_fetch",
            notRss: true,
            hosts: harvestList(policy),
          },
          governance: {
            neverAutoWritesProductEngines: true,
            /** Three separate products — FlahaCALC ≠ FlahaFAST */
            products: SISTER_PRODUCTS,
          },
        };
      } catch (e) {
        mapError(e);
      }
    });

    app.get("/intake", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as {
          status?: EvidenceIntakeStatus;
          intakeClass?: EvidenceIntakeClass;
          limit?: string;
        };
        const rows = await intakes.list(actor, {
          status: q.status,
          intakeClass: q.intakeClass,
          limit: q.limit ? Number(q.limit) : undefined,
        });
        return {
          count: rows.length,
          intakes: rows.map(serializeIntake),
        };
      } catch (e) {
        mapError(e);
      }
    });

    app.get<{ Params: { id: string } }>("/intake/:id", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        const row = await intakes.get(actor, request.params.id);
        return { intake: serializeIntake(row) };
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/intake/land/website", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        const body = request.body as {
          url?: string;
          languageHint?: string;
          chainMode?: "AUTO_CHAIN" | "MANUAL_STAGE";
          acquisitionMode?: "STATIC" | "BROWSER";
          idempotencyKey?: string;
        };
        if (!body.url?.trim()) throw new AppError(400, "URL_REQUIRED", "url is required.");
        const row = await intakes.landWebsite(actor, {
          url: body.url.trim(),
          languageHint: body.languageHint,
          chainMode: body.chainMode,
          acquisitionMode: body.acquisitionMode,
          idempotencyKey: body.idempotencyKey,
        });
        return { intake: serializeIntake(row) };
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/intake/land/file", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        const file = await request.file();
        if (!file) throw new AppError(400, "FILE_REQUIRED", "Multipart file is required.");
        const chunks: Buffer[] = [];
        for await (const c of file.file) chunks.push(c);
        const buffer = Buffer.concat(chunks);
        const fields = file.fields as Record<string, { value?: string } | Array<{ value?: string }> | undefined>;
        const fieldValue = (name: string): string | undefined => {
          const raw = fields[name];
          const item = Array.isArray(raw) ? raw[0] : raw;
          const value = item?.value;
          return typeof value === "string" && value.trim() ? value.trim() : undefined;
        };
        const intakeClass = fieldValue("intakeClass") as EvidenceIntakeClass | undefined;
        const autoPromote = fieldValue("autoPromote") === "true";
        const notes = fieldValue("notes");
        const idempotencyKey = fieldValue("idempotencyKey");
        if (intakeClass && !CLASSES.includes(intakeClass)) {
          throw new AppError(400, "INVALID_CLASS", `Unknown intakeClass: ${intakeClass}`);
        }
        const row = await intakes.landFile(actor, {
          buffer,
          filename: file.filename || "upload.bin",
          mediaType: file.mimetype,
          intakeClass,
          autoPromote,
          notes,
          idempotencyKey,
        });
        return { intake: serializeIntake(row) };
      } catch (e) {
        mapError(e);
      }
    });

    app.post<{ Params: { id: string } }>("/intake/:id/classify", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        const body = request.body as {
          intakeClass?: EvidenceIntakeClass;
          autoPromote?: boolean;
          notes?: string;
        };
        if (!body.intakeClass || !CLASSES.includes(body.intakeClass)) {
          throw new AppError(400, "INVALID_CLASS", "intakeClass is required.");
        }
        const row = await intakes.classify(actor, request.params.id, body.intakeClass, {
          autoPromote: body.autoPromote === true,
          notes: body.notes,
        });
        return { intake: serializeIntake(row) };
      } catch (e) {
        mapError(e);
      }
    });

    app.post<{ Params: { id: string } }>("/intake/:id/promote", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        const row = await intakes.promote(actor, request.params.id);
        return { intake: serializeIntake(row) };
      } catch (e) {
        mapError(e);
      }
    });
  };
}

function serializeIntake(row: {
  id: string;
  tenantId: string;
  intakeClass: EvidenceIntakeClass;
  status: EvidenceIntakeStatus;
  title: string;
  originalFilename: string | null;
  sourceUrl: string | null;
  mediaType: string | null;
  byteSize: bigint | null;
  contentSha256: string | null;
  storageRelativePath: string | null;
  inputArtifactId: string | null;
  productSubmissionId: string | null;
  promoteResult: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  notes: string | null;
  correlationId: string;
  idempotencyKey: string;
  classifiedAt: Date | null;
  promotedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    byteSize: row.byteSize != null ? Number(row.byteSize) : null,
    meta: INTAKE_CLASS_META[row.intakeClass],
  };
}
