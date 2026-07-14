import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";

const articleId = "00000000-0000-4000-8000-000000000101";
const termId = "00000000-0000-4000-8000-000000000201";
const sourceId = "00000000-0000-4000-8000-000000000301";
const assignedAt = new Date("2026-07-14T17:00:00.000Z");

const term = {
  id: termId,
  type: "AGRICULTURE_DOMAIN",
  code: "FOOD_SECURITY",
  label: "Food security",
  description: "Agricultural food-security relevance.",
  parentId: null,
  standardCode: null,
  aliases: ["Agrifood security"],
  entityEligibility: null,
  assignable: true,
  active: true,
  sortOrder: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const assignment = {
  articleId,
  termId,
  provenance: "MANUAL",
  provenanceRef: null,
  confidence: null,
  assignedAt,
  term,
};

function database(): PrismaClient {
  const prisma = {
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    article: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: articleId }),
      count: vi.fn().mockResolvedValue(0),
    },
    articleClassification: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(assignment),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    classificationTerm: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(term),
    },
    organizationType: { findMany: vi.fn().mockResolvedValue([]) },
    rssSource: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return prisma as unknown as PrismaClient;
}

const apps: Array<ReturnType<typeof buildApp>> = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function appWith(prisma: PrismaClient) {
  const app = buildApp({ prisma });
  apps.push(app);
  return app;
}

describe("taxonomy routes", () => {
  it("lists active taxonomy in stable order and preserves hierarchy fields", async () => {
    const prisma = database();
    vi.mocked(prisma.classificationTerm.findMany).mockResolvedValue([{
      ...term,
      parent: { code: "AGRICULTURAL_SYSTEMS" },
    }] as never);
    const response = await appWith(prisma).inject({ method: "GET", url: "/api/taxonomy" });
    expect(response.statusCode).toBe(200);
    expect(response.json().items[0]).toMatchObject({
      id: termId,
      parentCode: "AGRICULTURAL_SYSTEMS",
      assignable: true,
      aliases: ["Agrifood security"],
      entityEligibility: null,
    });
    expect(prisma.classificationTerm.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    }));
  });

  it("filters taxonomy by query and path type", async () => {
    const prisma = database();
    const app = appWith(prisma);
    expect((await app.inject({ method: "GET", url: "/api/taxonomy?type=GENERAL_DOMAIN" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/taxonomy/AGRICULTURE_DOMAIN" })).statusCode).toBe(200);
    expect(prisma.classificationTerm.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { active: true, type: "GENERAL_DOMAIN" },
    }));
    expect(prisma.classificationTerm.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { active: true, type: "AGRICULTURE_DOMAIN" },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }));
  });

  it("rejects invalid taxonomy types with the stable validation envelope", async () => {
    const response = await appWith(database()).inject({ method: "GET", url: "/api/taxonomy/INVALID" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("lists active organization types in stable order", async () => {
    const prisma = database();
    vi.mocked(prisma.organizationType.findMany).mockResolvedValue([{ id: "one", code: "UNIVERSITY" }] as never);
    const response = await appWith(prisma).inject({ method: "GET", url: "/api/organization-types" });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([{ id: "one", code: "UNIVERSITY" }]);
    expect(prisma.organizationType.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }));
  });
});

describe("manual article classifications", () => {
  it("creates only a manual assignment and repeats PUT idempotently", async () => {
    const prisma = database();
    const app = appWith(prisma);
    const url = `/api/articles/${articleId}/classifications/${termId}`;
    const first = await app.inject({ method: "PUT", url });
    const duplicate = await app.inject({ method: "PUT", url });
    expect(first.statusCode).toBe(200);
    expect(duplicate.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ provenance: "MANUAL", provenanceRef: null, confidence: null });
    expect(prisma.articleClassification.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.articleClassification.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { articleId, termId, provenance: "MANUAL", provenanceRef: null, confidence: null },
      update: {},
    }));
  });

  it("rejects client-controlled assignment provenance", async () => {
    const prisma = database();
    const response = await appWith(prisma).inject({
      method: "PUT",
      url: `/api/articles/${articleId}/classifications/${termId}`,
      payload: { provenance: "RULE_BASED", confidence: 0.8 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    expect(prisma.articleClassification.upsert).not.toHaveBeenCalled();
  });

  it("rejects inactive and non-assignable terms", async () => {
    const prisma = database();
    const app = appWith(prisma);
    vi.mocked(prisma.classificationTerm.findUnique).mockResolvedValueOnce({ ...term, active: false } as never);
    const inactive = await app.inject({ method: "PUT", url: `/api/articles/${articleId}/classifications/${termId}` });
    expect(inactive.statusCode).toBe(409);
    expect(inactive.json().error.code).toBe("CLASSIFICATION_TERM_INACTIVE");

    vi.mocked(prisma.classificationTerm.findUnique).mockResolvedValueOnce({ ...term, assignable: false } as never);
    const grouping = await app.inject({ method: "PUT", url: `/api/articles/${articleId}/classifications/${termId}` });
    expect(grouping.statusCode).toBe(409);
    expect(grouping.json().error.code).toBe("CLASSIFICATION_TERM_NOT_ASSIGNABLE");
    expect(prisma.articleClassification.upsert).not.toHaveBeenCalled();
  });

  it("validates UUIDs and returns missing article and term responses", async () => {
    const prisma = database();
    const app = appWith(prisma);
    const invalid = await app.inject({ method: "PUT", url: `/api/articles/not-a-uuid/classifications/${termId}` });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("VALIDATION_ERROR");

    vi.mocked(prisma.article.findUnique).mockResolvedValueOnce(null);
    const missingArticle = await app.inject({ method: "PUT", url: `/api/articles/${articleId}/classifications/${termId}` });
    expect(missingArticle.statusCode).toBe(404);
    expect(missingArticle.json().error.message).toBe("Article not found.");

    vi.mocked(prisma.classificationTerm.findUnique).mockResolvedValueOnce(null);
    const missingTerm = await app.inject({ method: "PUT", url: `/api/articles/${articleId}/classifications/${termId}` });
    expect(missingTerm.statusCode).toBe(404);
    expect(missingTerm.json().error.message).toBe("Classification term not found.");
  });

  it("retrieves assignments with governed terms and provenance", async () => {
    const prisma = database();
    vi.mocked(prisma.articleClassification.findMany).mockResolvedValue([assignment] as never);
    const response = await appWith(prisma).inject({
      method: "GET",
      url: `/api/articles/${articleId}/classifications`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().items[0]).toMatchObject({
      articleId,
      termId,
      provenance: "MANUAL",
      term: { code: "FOOD_SECURITY" },
    });
  });

  it("removes assignments idempotently after validating both resources", async () => {
    const prisma = database();
    vi.mocked(prisma.articleClassification.deleteMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const app = appWith(prisma);
    const url = `/api/articles/${articleId}/classifications/${termId}`;
    expect((await app.inject({ method: "DELETE", url })).statusCode).toBe(204);
    expect((await app.inject({ method: "DELETE", url })).statusCode).toBe(204);
    expect(prisma.articleClassification.deleteMany).toHaveBeenCalledTimes(2);
  });
});

describe("article classification filters", () => {
  it("filters articles by term and classification type", async () => {
    const prisma = database();
    const app = appWith(prisma);
    await app.inject({ method: "GET", url: `/api/articles?termId=${termId}` });
    await app.inject({ method: "GET", url: "/api/articles?classificationType=GENERAL_DOMAIN" });
    expect(prisma.article.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { classifications: { some: { termId } } },
    }));
    expect(prisma.article.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { classifications: { some: { term: { type: "GENERAL_DOMAIN" } } } },
    }));
  });

  it("composes classification filters with search, source and pagination", async () => {
    const prisma = database();
    const response = await appWith(prisma).inject({
      method: "GET",
      url: `/api/articles?q=grain&sourceId=${sourceId}&termId=${termId}&classificationType=AGRICULTURE_DOMAIN&page=2&limit=5`,
    });
    expect(response.statusCode).toBe(200);
    expect(prisma.article.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sourceId,
        classifications: { some: { termId, term: { type: "AGRICULTURE_DOMAIN" } } },
        OR: [
          { title: { contains: "grain", mode: "insensitive" } },
          { summary: { contains: "grain", mode: "insensitive" } },
        ],
      },
      skip: 5,
      take: 5,
    }));
    expect(response.json()).toMatchObject({ page: 2, limit: 5 });
  });
});
