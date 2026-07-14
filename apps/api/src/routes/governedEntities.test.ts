import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";

const organizationTypeId = "00000000-0000-4000-8000-000000000401";
const organizationId = "00000000-0000-4000-8000-000000000402";
const productId = "00000000-0000-4000-8000-000000000403";
const productCategoryId = "00000000-0000-4000-8000-000000000404";
const eventId = "00000000-0000-4000-8000-000000000405";
const eventTypeId = "00000000-0000-4000-8000-000000000406";
const classificationTermId = "00000000-0000-4000-8000-000000000407";
const articleId = "00000000-0000-4000-8000-000000000408";

const organizationType = { id: organizationTypeId, code: "AGRIBUSINESS", active: true };
const organization = {
  id: organizationId,
  typeId: organizationTypeId,
  canonicalName: "Acme Farms",
  normalizedName: "acme farms",
  homepageUrl: null,
  countryCode: "QA",
  region: "GCC",
  description: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const commercialCategory = {
  id: productCategoryId,
  type: "PRODUCT_CATEGORY",
  code: "FERTILIZER_PRODUCTS",
  active: true,
  assignable: true,
  entityEligibility: "COMMERCIAL_PRODUCT",
};
const product = {
  id: productId,
  code: "ACME_FERTILIZER",
  name: "Acme Fertilizer",
  categoryTermId: productCategoryId,
  description: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const eventType = {
  id: eventTypeId,
  type: "GENERAL_EVENT_TYPE",
  code: "MARKET_EVENT",
  active: true,
  assignable: true,
};
const classificationTerm = {
  id: classificationTermId,
  type: "SECTOR",
  code: "AGRICULTURE",
  active: true,
  assignable: true,
};
const event = {
  id: eventId,
  primaryEventTypeTermId: eventTypeId,
  title: "Input market update",
  summary: null,
  startsAt: new Date("2026-07-14T00:00:00.000Z"),
  endsAt: null,
  observedAt: new Date("2026-07-14T01:00:00.000Z"),
  locationName: "Qatar",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function database(): PrismaClient {
  return {
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    organizationType: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(organizationType),
    },
    organization: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(organization),
      create: vi.fn().mockResolvedValue({ ...organization, type: organizationType }),
      update: vi.fn().mockImplementation(async ({ data }) => ({ ...organization, ...data, type: organizationType })),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(product),
      create: vi.fn().mockResolvedValue({ ...product, category: commercialCategory }),
      update: vi.fn().mockImplementation(async ({ data }) => ({ ...product, ...data, category: commercialCategory })),
    },
    classificationTerm: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockImplementation(async ({ where }) => {
        if (where.id === productCategoryId) return commercialCategory;
        if (where.id === eventTypeId) return eventType;
        return classificationTerm;
      }),
    },
    organizationProduct: {
      upsert: vi.fn().mockResolvedValue({ organizationId, productId, role: "MANUFACTURER" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    articleOrganization: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({ articleId, organizationId }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    articleProduct: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({ articleId, productId }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    intelligenceEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(event),
      create: vi.fn().mockResolvedValue({ ...event, primaryEventType: eventType }),
      update: vi.fn().mockImplementation(async ({ data }) => ({ ...event, ...data, primaryEventType: eventType })),
    },
    eventClassification: {
      upsert: vi.fn().mockResolvedValue({
        eventId,
        termId: classificationTermId,
        provenance: "MANUAL",
        provenanceRef: null,
        confidence: null,
        term: classificationTerm,
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    eventEvidence: {
      upsert: vi.fn().mockResolvedValue({ eventId, articleId, article: { id: articleId, title: "Evidence" } }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    article: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue({ id: articleId }),
    },
    articleClassification: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    rssSource: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaClient;
}

const apps: Array<ReturnType<typeof buildApp>> = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));
function appWith(prisma: PrismaClient) {
  const app = buildApp({ prisma });
  apps.push(app);
  return app;
}

describe("governed organizations", () => {
  it("creates and patches organizations with server-generated normalized names", async () => {
    const prisma = database();
    const app = appWith(prisma);
    const created = await app.inject({
      method: "POST",
      url: "/api/organizations",
      payload: { typeId: organizationTypeId, canonicalName: "  Acme   Farms  ", countryCode: "QA" },
    });
    expect(created.statusCode).toBe(201);
    expect(prisma.organization.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ canonicalName: "Acme Farms", normalizedName: "acme farms" }),
    }));

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${organizationId}`,
      payload: { canonicalName: "Acme Agri-Tech" },
    });
    expect(patched.statusCode).toBe(200);
    expect(prisma.organization.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ canonicalName: "Acme Agri-Tech", normalizedName: "acme agri tech" }),
    }));
    const detail = await app.inject({ method: "GET", url: `/api/organizations/${organizationId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ id: organizationId, canonicalName: "Acme Farms" });
  });

  it("rejects inactive organization types", async () => {
    const prisma = database();
    vi.mocked(prisma.organizationType.findUnique).mockResolvedValue({ ...organizationType, active: false } as never);
    const response = await appWith(prisma).inject({
      method: "POST",
      url: "/api/organizations",
      payload: { typeId: organizationTypeId, canonicalName: "Example" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("ORGANIZATION_TYPE_INACTIVE");
  });

  it("filters and paginates organizations", async () => {
    const prisma = database();
    const response = await appWith(prisma).inject({
      method: "GET",
      url: `/api/organizations?typeId=${organizationTypeId}&countryCode=QA&active=true&q=Acme&page=2&limit=5`,
    });
    expect(response.statusCode).toBe(200);
    expect(prisma.organization.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ typeId: organizationTypeId, countryCode: "QA", active: true }),
      skip: 5,
      take: 5,
    }));
    expect(response.json()).toMatchObject({ page: 2, limit: 5 });
  });
});

describe("governed products", () => {
  it("enforces commercial product-category semantics", async () => {
    const prisma = database();
    vi.mocked(prisma.classificationTerm.findUnique).mockResolvedValue({
      ...commercialCategory,
      entityEligibility: "CLASSIFICATION_ONLY",
    } as never);
    const response = await appWith(prisma).inject({
      method: "POST",
      url: "/api/products",
      payload: { code: "ACME_FERTILIZER", name: "Acme Fertilizer", categoryTermId: productCategoryId },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("PRODUCT_CATEGORY_INVALID");
  });

  it("returns stable code conflicts and makes code immutable", async () => {
    const prisma = database();
    vi.mocked(prisma.product.create).mockRejectedValue({ code: "P2002" });
    const app = appWith(prisma);
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/products",
      payload: { code: "ACME_FERTILIZER", name: "Acme Fertilizer", categoryTermId: productCategoryId },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("PRODUCT_CODE_CONFLICT");

    const changeCode = await app.inject({
      method: "PATCH",
      url: `/api/products/${productId}`,
      payload: { code: "CHANGED_CODE" },
    });
    expect(changeCode.statusCode).toBe(400);
    expect(changeCode.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("filters products by category, activity, search and pagination", async () => {
    const prisma = database();
    const response = await appWith(prisma).inject({
      method: "GET",
      url: `/api/products?categoryTermId=${productCategoryId}&active=true&q=fertilizer&page=2&limit=10`,
    });
    expect(response.statusCode).toBe(200);
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ categoryTermId: productCategoryId, active: true }),
      skip: 10,
      take: 10,
    }));
    const detail = await appWith(database()).inject({ method: "GET", url: `/api/products/${productId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ id: productId, code: "ACME_FERTILIZER" });
  });
});

describe("governed entity relationships", () => {
  it("validates organization-product roles and upserts idempotently", async () => {
    const prisma = database();
    const app = appWith(prisma);
    const invalid = await app.inject({
      method: "PUT",
      url: `/api/organizations/${organizationId}/products/${productId}/INVALID`,
    });
    expect(invalid.statusCode).toBe(400);
    const url = `/api/organizations/${organizationId}/products/${productId}/MANUFACTURER`;
    expect((await app.inject({ method: "PUT", url })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url })).statusCode).toBe(200);
    expect(prisma.organizationProduct.upsert).toHaveBeenCalledTimes(2);
    expect((await app.inject({ method: "DELETE", url })).statusCode).toBe(204);
  });

  it("links and removes article organizations and products idempotently", async () => {
    const prisma = database();
    const app = appWith(prisma);
    const organizationUrl = `/api/articles/${articleId}/organizations/${organizationId}`;
    const productUrl = `/api/articles/${articleId}/products/${productId}`;
    expect((await app.inject({ method: "PUT", url: organizationUrl })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: organizationUrl })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: productUrl })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: productUrl })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: organizationUrl })).statusCode).toBe(204);
    expect((await app.inject({ method: "DELETE", url: productUrl })).statusCode).toBe(204);
    expect(prisma.articleOrganization.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.articleProduct.upsert).toHaveBeenCalledTimes(2);
  });

  it("retrieves governed article organization and product relationships", async () => {
    const prisma = database();
    const linkedAt = new Date("2026-07-14T17:00:00.000Z");
    vi.mocked(prisma.articleOrganization.findMany).mockResolvedValue([{
      organizationId,
      linkedAt,
      organization: {
        canonicalName: "Acme Farms",
        normalizedName: "acme farms",
        active: true,
        type: { id: organizationTypeId, code: "AGRIBUSINESS", label: "Agribusiness" },
      },
    }] as never);
    vi.mocked(prisma.articleProduct.findMany).mockResolvedValue([{
      productId,
      linkedAt,
      product: {
        code: "ACME_FERTILIZER",
        name: "Acme Fertilizer",
        active: true,
        category: { id: productCategoryId, code: "FERTILIZER_PRODUCTS", label: "Fertilizer products" },
      },
    }] as never);
    const response = await appWith(prisma).inject({
      method: "GET",
      url: `/api/articles/${articleId}/relationships`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      organizations: [{ organizationId, canonicalName: "Acme Farms", active: true }],
      products: [{ productId, code: "ACME_FERTILIZER", active: true }],
    });
  });

  it("returns empty article relationships and validates article identity", async () => {
    const prisma = database();
    const app = appWith(prisma);
    const empty = await app.inject({ method: "GET", url: `/api/articles/${articleId}/relationships` });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ organizations: [], products: [] });

    const invalid = await app.inject({ method: "GET", url: "/api/articles/not-a-uuid/relationships" });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("VALIDATION_ERROR");

    vi.mocked(prisma.article.findUnique).mockResolvedValueOnce(null);
    const missing = await app.inject({ method: "GET", url: `/api/articles/${articleId}/relationships` });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.message).toBe("Article not found.");
  });
});

describe("governed intelligence events", () => {
  it("creates events with the database lifecycle default active=true", async () => {
    const prisma = database();
    const response = await appWith(prisma).inject({
      method: "POST",
      url: "/api/events",
      payload: { primaryEventTypeTermId: eventTypeId, title: "Lifecycle event" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().active).toBe(true);
    const createCall = vi.mocked(prisma.intelligenceEvent.create).mock.calls[0][0];
    expect(createCall.data).not.toHaveProperty("active");
  });

  it("validates primary event type semantics", async () => {
    const prisma = database();
    vi.mocked(prisma.classificationTerm.findUnique).mockResolvedValue({ ...eventType, type: "SECTOR" } as never);
    const response = await appWith(prisma).inject({
      method: "POST",
      url: "/api/events",
      payload: { primaryEventTypeTermId: eventTypeId, title: "Event" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("PRIMARY_EVENT_TYPE_INVALID");
  });

  it("rejects an event ending before it starts before database creation", async () => {
    const prisma = database();
    const response = await appWith(prisma).inject({
      method: "POST",
      url: "/api/events",
      payload: {
        primaryEventTypeTermId: eventTypeId,
        title: "Event",
        startsAt: "2026-07-15T00:00:00.000Z",
        endsAt: "2026-07-14T00:00:00.000Z",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("EVENT_DATE_RANGE_INVALID");
    expect(prisma.intelligenceEvent.create).not.toHaveBeenCalled();
  });

  it("filters events by governed classifications, geography, dates and pagination", async () => {
    const prisma = database();
    const response = await appWith(prisma).inject({
      method: "GET",
      url: `/api/events?primaryEventTypeTermId=${eventTypeId}&termId=${classificationTermId}&classificationType=SECTOR&geographicTermId=${classificationTermId}&startsAtFrom=2026-07-01T00%3A00%3A00.000Z&startsAtTo=2026-07-31T00%3A00%3A00.000Z&page=2&limit=5`,
    });
    expect(response.statusCode).toBe(200);
    expect(prisma.intelligenceEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ active: true, primaryEventTypeTermId: eventTypeId, AND: expect.any(Array) }),
      skip: 5,
      take: 5,
    }));
    const inactive = await appWith(prisma).inject({ method: "GET", url: "/api/events?active=false" });
    expect(inactive.statusCode).toBe(200);
    expect(prisma.intelligenceEvent.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { active: false },
    }));
  });

  it("deactivates and reactivates events", async () => {
    const prisma = database();
    const app = appWith(prisma);
    const deactivate = await app.inject({
      method: "PATCH",
      url: `/api/events/${eventId}`,
      payload: { active: false },
    });
    expect(deactivate.statusCode).toBe(200);
    expect(deactivate.json().active).toBe(false);
    const reactivate = await app.inject({
      method: "PATCH",
      url: `/api/events/${eventId}`,
      payload: { active: true },
    });
    expect(reactivate.statusCode).toBe(200);
    expect(reactivate.json().active).toBe(true);
    expect(prisma.intelligenceEvent.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { active: false } }));
    expect(prisma.intelligenceEvent.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { active: true } }));
  });

  it("retrieves an inactive event by exact ID while default lists remain active-only", async () => {
    const prisma = database();
    vi.mocked(prisma.intelligenceEvent.findUnique).mockResolvedValue({ ...event, active: false } as never);
    const app = appWith(prisma);
    const detail = await app.inject({ method: "GET", url: `/api/events/${eventId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ id: eventId, active: false });
    await app.inject({ method: "GET", url: "/api/events" });
    expect(prisma.intelligenceEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true },
    }));
  });

  it("validates and upserts manual event classifications idempotently", async () => {
    const prisma = database();
    const app = appWith(prisma);
    const url = `/api/events/${eventId}/classifications/${classificationTermId}`;
    expect((await app.inject({ method: "PUT", url })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url })).statusCode).toBe(200);
    expect(prisma.eventClassification.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.eventClassification.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ provenance: "MANUAL", confidence: null, provenanceRef: null }),
      update: {},
    }));
    expect((await app.inject({ method: "DELETE", url })).statusCode).toBe(204);
  });

  it("rejects inactive event classification terms", async () => {
    const prisma = database();
    vi.mocked(prisma.classificationTerm.findUnique).mockResolvedValue({
      ...classificationTerm,
      active: false,
    } as never);
    const response = await appWith(prisma).inject({
      method: "PUT",
      url: `/api/events/${eventId}/classifications/${classificationTermId}`,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("CLASSIFICATION_TERM_INACTIVE");
    expect(prisma.eventClassification.upsert).not.toHaveBeenCalled();
  });

  it("links and removes article evidence idempotently", async () => {
    const prisma = database();
    const app = appWith(prisma);
    const url = `/api/events/${eventId}/evidence/${articleId}`;
    expect((await app.inject({ method: "PUT", url })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url })).statusCode).toBe(204);
    expect(prisma.eventEvidence.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.eventEvidence.deleteMany).toHaveBeenCalledOnce();
  });
});
