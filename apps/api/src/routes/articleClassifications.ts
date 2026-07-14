import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";

interface ArticleParams { id: string }
interface AssignmentParams { articleId: string; termId: string }

const uuidField = { type: "string", format: "uuid" } as const;
const articleParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: uuidField },
} as const;
const assignmentParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["articleId", "termId"],
  properties: { articleId: uuidField, termId: uuidField },
} as const;

const termSelect = {
  id: true,
  type: true,
  code: true,
  label: true,
  description: true,
  parentId: true,
  standardCode: true,
  aliases: true,
  assignable: true,
  active: true,
  sortOrder: true,
  entityEligibility: true,
} as const;

const assignmentSelect = {
  articleId: true,
  termId: true,
  provenance: true,
  provenanceRef: true,
  confidence: true,
  assignedAt: true,
  term: { select: termSelect },
} as const;

async function requireArticleAndTerm(prisma: PrismaClient, articleId: string, termId: string) {
  const [article, term] = await Promise.all([
    prisma.article.findUnique({ where: { id: articleId }, select: { id: true } }),
    prisma.classificationTerm.findUnique({ where: { id: termId } }),
  ]);
  if (!article) throw new AppError(404, "NOT_FOUND", "Article not found.");
  if (!term) throw new AppError(404, "NOT_FOUND", "Classification term not found.");
  return term;
}

export function articleClassificationRoutes(prisma: PrismaClient): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: ArticleParams }>(
      "/articles/:id/classifications",
      { schema: { params: articleParamsSchema } },
      async (request) => {
        const article = await prisma.article.findUnique({ where: { id: request.params.id }, select: { id: true } });
        if (!article) throw new AppError(404, "NOT_FOUND", "Article not found.");
        return {
          items: await prisma.articleClassification.findMany({
            where: { articleId: request.params.id },
            select: assignmentSelect,
            orderBy: [{ term: { type: "asc" } }, { term: { sortOrder: "asc" } }, { term: { code: "asc" } }],
          }),
        };
      },
    );

    app.put<{ Params: AssignmentParams; Body: unknown }>(
      "/articles/:articleId/classifications/:termId",
      { schema: { params: assignmentParamsSchema } },
      async (request) => {
        if (request.body !== undefined) {
          throw new AppError(400, "VALIDATION_ERROR", "Request body is not accepted for manual assignment.");
        }
        const { articleId, termId } = request.params;
        const term = await requireArticleAndTerm(prisma, articleId, termId);
        if (!term.active) throw new AppError(409, "CLASSIFICATION_TERM_INACTIVE", "Classification term is inactive.");
        if (!term.assignable) {
          throw new AppError(409, "CLASSIFICATION_TERM_NOT_ASSIGNABLE", "Classification term is not assignable.");
        }
        const assignment = await prisma.articleClassification.upsert({
          where: { articleId_termId: { articleId, termId } },
          create: { articleId, termId, provenance: "MANUAL", provenanceRef: null, confidence: null },
          update: {},
          select: assignmentSelect,
        });
        if (assignment.provenance !== "MANUAL") {
          throw new AppError(
            409,
            "CLASSIFICATION_PROVENANCE_CONFLICT",
            "An assignment with non-manual provenance already exists.",
          );
        }
        return assignment;
      },
    );

    app.delete<{ Params: AssignmentParams }>(
      "/articles/:articleId/classifications/:termId",
      { schema: { params: assignmentParamsSchema } },
      async (request, reply) => {
        const { articleId, termId } = request.params;
        await requireArticleAndTerm(prisma, articleId, termId);
        await prisma.articleClassification.deleteMany({ where: { articleId, termId } });
        return reply.code(204).send();
      },
    );
  };
}
