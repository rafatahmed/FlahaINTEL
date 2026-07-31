import type {
  ArticleFilters,
  ArticlePage,
  ArticleRelationships,
  ClassificationAssignment,
  ClassificationTerm,
  EntityFilters,
  EventFilters,
  GovernanceAuthContext,
  GovernanceCandidate,
  GovernanceDecision,
  GovernanceEvidence,
  GovernancePreview,
  IntelligenceEvent,
  Organization,
  OrganizationProductRole,
  OrganizationType,
  Page,
  Product,
  RssSource,
  SchedulerStatus,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3003";

interface ApiErrorBody { error?: { code?: string; message?: string } }
interface Items<T> { items: T[] }

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

let governanceAuth: GovernanceAuthContext | null = null;
let productAuth: { userId: string; tenantId: string; token?: string } | null = null;

export function setGovernanceAuth(context: GovernanceAuthContext | null) {
  governanceAuth = context;
}

export function setProductAuth(context: { userId: string; tenantId: string; token?: string } | null) {
  productAuth = context;
  if (context) governanceAuth = { userId: context.userId, tenantId: context.tenantId };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const identity = productAuth || governanceAuth;
  if (identity) {
    headers.set("X-Flaha-User-Id", identity.userId);
    headers.set("X-Flaha-Tenant-Id", identity.tenantId);
    headers.set("X-Flaha-Correlation-Id", `web-${Date.now()}`);
  }
  if (productAuth?.token) headers.set("Authorization", `Bearer ${productAuth.token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  const body = response.status === 204
    ? {}
    : await response.json().catch(() => ({})) as ApiErrorBody;
  if (!response.ok) {
    const errorBody = body as ApiErrorBody;
    throw new ApiError(
      errorBody.error?.code ?? "REQUEST_FAILED",
      errorBody.error?.message ?? "Request failed.",
      response.status,
    );
  }
  return body as T;
}

function query(values: object) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const result = params.toString();
  return result ? `?${result}` : "";
}

export interface OrganizationInput {
  typeId: string;
  canonicalName: string;
  homepageUrl?: string | null;
  countryCode?: string | null;
  region?: string | null;
  description?: string | null;
  active?: boolean;
}

export interface ProductInput {
  code: string;
  name: string;
  categoryTermId: string;
  description?: string | null;
  active?: boolean;
}

export interface EventInput {
  primaryEventTypeTermId: string;
  title: string;
  summary?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  observedAt?: string | null;
  locationName?: string | null;
  active?: boolean;
}

export const api = {
  articles: (filters: ArticleFilters = {}) => request<ArticlePage>(`/api/articles${query(filters)}`),
  articleClassifications: (id: string) => request<Items<ClassificationAssignment>>(`/api/articles/${id}/classifications`),
  assignArticleTerm: (articleId: string, termId: string) => request<ClassificationAssignment>(
    `/api/articles/${articleId}/classifications/${termId}`, { method: "PUT" },
  ),
  removeArticleTerm: (articleId: string, termId: string) => request<void>(
    `/api/articles/${articleId}/classifications/${termId}`, { method: "DELETE" },
  ),
  articleRelationships: (articleId: string) => request<ArticleRelationships>(`/api/articles/${articleId}/relationships`),
  linkArticleOrganization: (articleId: string, organizationId: string) => request(
    `/api/articles/${articleId}/organizations/${organizationId}`, { method: "PUT" },
  ),
  unlinkArticleOrganization: (articleId: string, organizationId: string) => request<void>(
    `/api/articles/${articleId}/organizations/${organizationId}`, { method: "DELETE" },
  ),
  linkArticleProduct: (articleId: string, productId: string) => request(
    `/api/articles/${articleId}/products/${productId}`, { method: "PUT" },
  ),
  unlinkArticleProduct: (articleId: string, productId: string) => request<void>(
    `/api/articles/${articleId}/products/${productId}`, { method: "DELETE" },
  ),

  taxonomy: (type?: string) => request<Items<ClassificationTerm>>(`/api/taxonomy${query({ type })}`),
  taxonomyType: (type: string) => request<Items<ClassificationTerm>>(`/api/taxonomy/${type}`),
  organizationTypes: () => request<Items<OrganizationType>>("/api/organization-types"),

  organizations: (filters: EntityFilters & { typeId?: string; countryCode?: string } = {}) =>
    request<Page<Organization>>(`/api/organizations${query(filters)}`),
  organization: (id: string) => request<Organization>(`/api/organizations/${id}`),
  createOrganization: (data: OrganizationInput) => request<Organization>("/api/organizations", {
    method: "POST", body: JSON.stringify(data),
  }),
  updateOrganization: (id: string, data: Partial<OrganizationInput>) => request<Organization>(`/api/organizations/${id}`, {
    method: "PATCH", body: JSON.stringify(data),
  }),

  products: (filters: EntityFilters & { categoryTermId?: string } = {}) =>
    request<Page<Product>>(`/api/products${query(filters)}`),
  product: (id: string) => request<Product>(`/api/products/${id}`),
  createProduct: (data: ProductInput) => request<Product>("/api/products", {
    method: "POST", body: JSON.stringify(data),
  }),
  updateProduct: (id: string, data: Partial<Omit<ProductInput, "code">>) => request<Product>(`/api/products/${id}`, {
    method: "PATCH", body: JSON.stringify(data),
  }),
  linkOrganizationProduct: (organizationId: string, productId: string, role: OrganizationProductRole) => request(
    `/api/organizations/${organizationId}/products/${productId}/${role}`, { method: "PUT" },
  ),
  unlinkOrganizationProduct: (organizationId: string, productId: string, role: OrganizationProductRole) => request<void>(
    `/api/organizations/${organizationId}/products/${productId}/${role}`, { method: "DELETE" },
  ),

  events: (filters: EventFilters = {}) => request<Page<IntelligenceEvent>>(`/api/events${query(filters)}`),
  event: (id: string) => request<IntelligenceEvent>(`/api/events/${id}`),
  createEvent: (data: EventInput) => {
    const { active: _active, ...createData } = data;
    return request<IntelligenceEvent>("/api/events", { method: "POST", body: JSON.stringify(createData) });
  },
  updateEvent: (id: string, data: Partial<EventInput>) => request<IntelligenceEvent>(`/api/events/${id}`, {
    method: "PATCH", body: JSON.stringify(data),
  }),
  assignEventTerm: (eventId: string, termId: string) => request<ClassificationAssignment>(
    `/api/events/${eventId}/classifications/${termId}`, { method: "PUT" },
  ),
  removeEventTerm: (eventId: string, termId: string) => request<void>(
    `/api/events/${eventId}/classifications/${termId}`, { method: "DELETE" },
  ),
  addEventEvidence: (eventId: string, articleId: string) => request(
    `/api/events/${eventId}/evidence/${articleId}`, { method: "PUT" },
  ),
  removeEventEvidence: (eventId: string, articleId: string) => request<void>(
    `/api/events/${eventId}/evidence/${articleId}`, { method: "DELETE" },
  ),

  sources: () => request<RssSource[]>("/api/sources"),
  scheduler: () => request<SchedulerStatus>("/api/scheduler"),
  addSource: (name: string, url: string) => request<RssSource>("/api/sources", {
    method: "POST", body: JSON.stringify({ name, url }),
  }),
  updateSource: (id: string, data: { name?: string; url?: string; enabled?: boolean }) =>
    request<RssSource>(`/api/sources/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  setSourceEnabled: (id: string, enabled: boolean) => request<RssSource>(`/api/sources/${id}`, {
    method: "PATCH", body: JSON.stringify({ enabled }),
  }),
  collectSource: (id: string) => request(`/api/sources/${id}/collect`, { method: "POST" }),
  collectAll: () => request("/api/collect", { method: "POST" }),

  governanceCandidates: (filters: Record<string, string | number | undefined> = {}) =>
    request<Page<GovernanceCandidate>>(`/api/governance/candidates${query(filters)}`),
  governanceCandidate: (id: string) => request<GovernanceCandidate>(`/api/governance/candidates/${id}`),
  governanceEvidence: (id: string) => request<GovernanceEvidence>(`/api/governance/candidates/${id}/evidence`),
  governancePreview: (id: string) => request<GovernancePreview>(`/api/governance/candidates/${id}/preview`),
  governanceDecisions: (id: string) => request<Items<GovernanceDecision>>(`/api/governance/candidates/${id}/decisions`),
  governanceDecision: (
    id: string,
    action: "approve" | "reject" | "request-correction" | "hold" | "release-hold" | "withdraw-approval" | "mark-promotion-eligible" | "withdraw",
    body: Record<string, unknown>,
  ) => request<{ candidate: GovernanceCandidate }>(`/api/governance/candidates/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify(body),
  }),

  createSession: (userId: string, tenantId: string) =>
    request<{ token: string; user: { id: string; email: string; displayName: string }; tenant: { id: string; code: string; name: string }; role: string }>(
      "/api/auth/session",
      { method: "POST", body: JSON.stringify({ userId, tenantId }) },
    ),
  me: () => request<{ userId: string; tenantId: string; email: string; displayName: string; role: string }>("/api/auth/me"),
  dashboard: () => request<Record<string, unknown>>("/api/dashboard"),
  systemReadiness: () => request<{ overall: string; components: Array<{ component: string; state: string; detail: string }>; checkedAt: string }>("/api/system/readiness"),
  submissions: (page = 1) => request<Page<Record<string, unknown>>>(`/api/submissions${query({ page, limit: 20 })}`),
  submission: (id: string) => request<Record<string, unknown>>(`/api/submissions/${id}`),
  submitWebsite: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/submissions/website", { method: "POST", body: JSON.stringify(body) }),
  submitDocument: (form: FormData) =>
    request<Record<string, unknown>>("/api/submissions/document", { method: "POST", body: form }),

  /** Evidence Intake Spine (central Submit) */
  intakeMatrix: () =>
    request<{
      principle: string;
      classes: Array<{ code: string; label: string; lane: string; promote: string; acceptHint: string }>;
      flow: string[];
      governance: Record<string, unknown>;
    }>("/api/intake/matrix"),
  intakeList: (filters: { status?: string; intakeClass?: string; limit?: number } = {}) =>
    request<{ count: number; intakes: Array<Record<string, unknown>> }>(`/api/intake${query(filters)}`),
  intakeGet: (id: string) => request<{ intake: Record<string, unknown> }>(`/api/intake/${id}`),
  intakeLandWebsite: (body: Record<string, unknown>) =>
    request<{ intake: Record<string, unknown> }>("/api/intake/land/website", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  intakeLandFile: async (form: FormData) => {
    const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3003";
    const headers = new Headers();
    let userId = "";
    let tenantId = "";
    let token = "";
    try {
      const raw = localStorage.getItem("flaha.product.auth");
      if (raw) {
        const a = JSON.parse(raw) as { userId?: string; tenantId?: string; token?: string };
        userId = a.userId || "";
        tenantId = a.tenantId || "";
        token = a.token || "";
      }
    } catch {
      /* ignore */
    }
    if (userId) headers.set("X-Flaha-User-Id", userId);
    if (tenantId) headers.set("X-Flaha-Tenant-Id", tenantId);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Flaha-Correlation-Id", `web-intake-${Date.now()}`);
    const response = await fetch(`${API_URL}/api/intake/land/file`, {
      method: "POST",
      headers,
      body: form,
      credentials: "include",
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
      intake?: Record<string, unknown>;
    };
    if (!response.ok) {
      throw new ApiError(
        body.error?.code ?? "REQUEST_FAILED",
        body.error?.message ?? "Intake land failed.",
        response.status,
      );
    }
    return body as { intake: Record<string, unknown> };
  },
  intakeClassify: (id: string, body: { intakeClass: string; autoPromote?: boolean; notes?: string }) =>
    request<{ intake: Record<string, unknown> }>(`/api/intake/${id}/classify`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  intakePromote: (id: string) =>
    request<{ intake: Record<string, unknown> }>(`/api/intake/${id}/promote`, { method: "POST", body: "{}" }),

  advanceSubmission: (id: string) =>
    request<Record<string, unknown>>(`/api/submissions/${id}/advance`, { method: "POST", body: JSON.stringify({}) }),
  cancelSubmission: (id: string, reason?: string) =>
    request<Record<string, unknown>>(`/api/submissions/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  jobs: (filters: Record<string, string | number | undefined> = {}) =>
    request<Page<Record<string, unknown>>>(`/api/jobs${query(filters)}`),
  job: (id: string) => request<Record<string, unknown>>(`/api/jobs/${id}`),
  cancelJob: (id: string, reason?: string) =>
    request(`/api/jobs/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  contentList: (filters: Record<string, string | number | undefined> = {}) =>
    request<Page<GovernanceCandidate>>(`/api/content${query(filters)}`),
  contentItem: (id: string) => request<GovernanceCandidate>(`/api/content/${id}`),
  artifacts: (filters: Record<string, string | number | undefined> = {}) =>
    request<Page<Record<string, unknown>>>(`/api/artifacts${query(filters)}`),
  artifact: (id: string) => request<Record<string, unknown>>(`/api/artifacts/${id}`),
  artifactPreview: (id: string) => request<{ preview: string; truncated: boolean; rendering: string }>(`/api/artifacts/${id}/preview`),

  marketChannels: (countryCode?: string) =>
    request<{ channels: Array<Record<string, unknown>> }>(`/api/markets/channels${query({ countryCode })}`),
  marketPrices: (filters: Record<string, string | number | undefined> = {}) =>
    request<{ prices: Array<Record<string, unknown>> }>(`/api/markets/prices${query(filters)}`),
  marketPriceTrend: (filters: {
    channelCode: string;
    commodityCode: string;
    from?: string;
    to?: string;
    originLabel?: string;
    grade?: string;
    cultivationMethod?: string;
    packDescription?: string;
    limit?: number;
  }) => request<{
    channelCode: string;
    countryCode: string;
    commodityCode: string;
    grade?: string | null;
    cultivationMethod?: string | null;
    seriesKey?: string;
    pointCount?: number;
    points: Array<{
      observedOn: string;
      value: number | null;
      unitPrice: number | null;
      priceMode: number | null;
      priceHigh?: number | null;
      priceLow?: number | null;
      currency: string;
      quantityTons?: number | null;
      grade?: string | null;
      cultivationMethod?: string | null;
      reviewState: string;
    }>;
  }>(`/api/markets/prices/trend${query(filters)}`),
  /** One-shot multi-series trend for a commodity (all grade/method variants). */
  marketPriceTrendBundle: (filters: {
    channelCode: string;
    commodityCode: string;
    from?: string;
    to?: string;
    originLabel?: string;
    seriesKey?: string;
    limit?: number;
  }) => request<{
    channelCode: string;
    countryCode: string;
    commodityCode: string;
    seriesCount: number;
    truncated: boolean;
    maxSeries: number;
    series: Array<{
      seriesKey: string;
      shortLabel: string;
      label: string;
      grade: string | null;
      cultivationMethod: string | null;
      packDescription: string | null;
      points: Array<{ observedOn: string; value: number; currency: string }>;
    }>;
  }>(`/api/markets/prices/trend-bundle${query(filters)}`),
  /** Comprehensive series analytics (multi-year, monthly, histogram, deviation). */
  marketPriceAnalytics: (filters: {
    channelCode: string;
    commodityCode: string;
    from?: string;
    to?: string;
    originLabel?: string;
    grade?: string;
    cultivationMethod?: string;
    packDescription?: string;
    seriesKey?: string;
    preferValue?: "auto" | "priceMode" | "unitPrice";
    onlyApproved?: boolean | string;
    limit?: number;
  }) =>
    request<{
      channelCode: string;
      countryCode: string;
      commodityCode: string;
      commodityName: string;
      seriesKey: string;
      valueField: string;
      spanDays: number;
      firstDay: string | null;
      lastDay: string | null;
      multiYear: boolean;
      recommendedView: "daily" | "by_year" | "monthly";
      currency: string | null;
      truncated: boolean;
      daily: Array<{
        observedOn: string;
        value: number;
        priceHigh: number | null;
        priceLow: number | null;
        quantityTons: number | null;
      }>;
      byYear: Array<{
        year: number;
        points: Array<{ x: string; y: number; fullDate: string }>;
        stats: Record<string, number | null>;
      }>;
      monthly: Array<{
        month: number;
        label: string;
        mean: number | null;
        median: number | null;
        min: number | null;
        max: number | null;
        n: number;
      }>;
      annual: Array<{
        year: number;
        mean: number | null;
        median: number | null;
        min: number | null;
        max: number | null;
        n: number;
        meanTons: number | null;
      }>;
      yearMonth: Array<{
        year: number;
        months: Array<{ month: number; mean: number | null; n: number }>;
      }>;
      histogram: Array<{ from: number; to: number; count: number; label: string }>;
      stats: {
        n: number;
        mean: number | null;
        median: number | null;
        min: number | null;
        max: number | null;
        stdev: number | null;
        p25: number | null;
        p75: number | null;
      };
      deviation: {
        latest: { observedOn: string; value: number } | null;
        vsTrailing30d: { mean: number | null; pct: number | null; abs: number | null } | null;
        vsTrailing90d: { mean: number | null; pct: number | null; abs: number | null } | null;
        vsSameMonthPriorYear: {
          priorYear: number | null;
          priorMean: number | null;
          pct: number | null;
          abs: number | null;
        } | null;
        zScoreTrailing90d: number | null;
        flag: "normal" | "elevated" | "depressed" | "insufficient_data";
      };
    }>(
      `/api/markets/prices/analytics${query({
        ...filters,
        onlyApproved:
          filters.onlyApproved === undefined
            ? undefined
            : filters.onlyApproved === true || filters.onlyApproved === "true"
              ? "true"
              : "false",
      })}`,
    ),
  marketReviewSummary: (filters: { channelCode?: string; countryCode?: string } = {}) =>
    request<{ summary: Record<string, number> }>(`/api/markets/prices/review-summary${query(filters)}`),
  marketRetention: (filters: { targetDays?: number; countryCode?: string } = {}) =>
    request<{
      targetDays: number;
      summary: Record<string, number>;
      channels: Array<Record<string, unknown>>;
      schedule?: Record<string, string>;
    }>(`/api/markets/retention${query(filters)}`),
  rebuildMarketAnalystPacks: (body: { channelCode?: string; topCommodities?: number } = {}) =>
    request<{
      gate: string;
      built: number;
      packs: Array<Record<string, unknown>>;
      governance: Record<string, unknown>;
    }>("/api/markets/analyst-packs/rebuild", { method: "POST", body: JSON.stringify(body) }),
  joAmmanCommodityMap: () =>
    request<{ channelCode: string; count: number; entries: Array<{ ar: string; en: string; code: string }> }>(
      "/api/markets/commodity-map/jo-amman",
    ),
  knowledgePacks: (filters: { theme?: string; extractKind?: string; reviewState?: string } | string = {}) => {
    const f = typeof filters === "string" ? { theme: filters } : filters;
    return request<{ packs: Array<Record<string, unknown>> }>(`/api/knowledge-packs${query(f)}`);
  },
  knowledgePack: (id: string) => request<{ pack: Record<string, unknown> }>(`/api/knowledge-packs/${id}`),
  /** 4I-B: export APPROVED pack as product handoff envelope. */
  knowledgePackHandoff: (id: string, body: { targetProduct?: string } = {}) =>
    request<{
      exportId: string;
      sha256: string;
      envelope: Record<string, unknown>;
      governance: Record<string, unknown>;
    }>(`/api/knowledge-packs/${id}/handoff`, { method: "POST", body: JSON.stringify(body) }),
  productHandoffExport: (body: {
    targetProduct: string;
    packIds?: string[];
    packCodes?: string[];
  }) =>
    request<{
      exportId: string;
      sha256: string;
      envelope: Record<string, unknown>;
      governance: Record<string, unknown>;
    }>("/api/product-handoff/export", { method: "POST", body: JSON.stringify(body) }),
  productHandoffExports: (limit?: number) =>
    request<{ exports: Array<Record<string, unknown>> }>(
      `/api/product-handoff/exports${query({ limit })}`,
    ),
  productHandoffExportGet: (id: string) =>
    request<{ export: Record<string, unknown>; envelope: Record<string, unknown> }>(
      `/api/product-handoff/exports/${id}`,
    ),
  productFeedPolicies: () =>
    request<{ policies: Array<Record<string, unknown>> }>("/api/product-feed-policies"),
  updateProductFeedPolicy: (
    target: string,
    body: {
      allowedThemes?: string[];
      requireApprovedPacks?: boolean;
      allowMarketContext?: boolean;
      allowComparisonNotes?: boolean;
      enabled?: boolean;
      notes?: string | null;
    },
  ) =>
    request<{ policy: Record<string, unknown> }>(`/api/product-feed-policies/${target}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  /** 4B-B PA scorecard */
  paDashboard: () => request<Record<string, unknown>>("/api/pa-dashboard"),

  /** 4R-A research topic index */
  researchTopics: (
    filters: {
      theme?: string;
      productLane?: string;
      crop?: string;
      region?: string;
      climate?: string;
      parameter?: string;
      extractKind?: string;
      q?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) =>
    request<{
      total: number;
      limit: number;
      offset: number;
      topics: Array<Record<string, unknown>>;
    }>(`/api/research/topics${query(filters)}`),
  researchTopic: (id: string) =>
    request<{ topic: Record<string, unknown> & { entries?: Array<Record<string, unknown>> } }>(
      `/api/research/topics/${id}`,
    ),
  researchFacets: () =>
    request<{
      themes: Array<{ value: string; label: string; count: number }>;
      productLanes: Array<{ value: string; label: string; count: number }>;
      crops: Array<{ value: string; label: string; count: number }>;
      regions: Array<{ value: string; label: string; count: number }>;
      parameters: Array<{ value: string; label: string; count: number }>;
      extractKinds: Array<{ value: string; label: string; count: number }>;
      topicCount: number;
      entryCount: number;
    }>("/api/research/facets"),
  researchRebuild: (body: { includeDraft?: boolean; note?: string } = {}) =>
    request<{
      rebuildId: string;
      topicCount: number;
      entryCount: number;
      packCount: number;
      literatureCount?: number;
      mode: string;
      governance: Record<string, unknown>;
    }>("/api/research/rebuild", { method: "POST", body: JSON.stringify(body) }),
  researchRebuilds: () =>
    request<{ rebuilds: Array<Record<string, unknown>> }>("/api/research/rebuilds"),

  /** 4R-L multi-domain literature sources (APA-grade) */
  researchLiterature: (
    filters: {
      domain?: string;
      keyword?: string;
      trustTier?: string;
      primaryTheme?: string;
      productLane?: string;
      q?: string;
      reviewState?: string;
      includeCatalog?: boolean | string;
      limit?: number;
      offset?: number;
    } = {},
  ) =>
    request<{
      total: number;
      limit: number;
      offset: number;
      sources: Array<Record<string, unknown>>;
    }>(
      `/api/research/literature${query({
        ...filters,
        includeCatalog: filters.includeCatalog ? "1" : undefined,
      })}`,
    ),
  researchLiteratureFacets: (includeCatalog?: boolean) =>
    request<{
      sourceCount: number;
      domains: Array<{ value: string; label: string; count: number }>;
      keywords: Array<{ value: string; label: string; count: number }>;
      trustTiers: Array<{ value: string; label: string; count: number }>;
      themes: Array<{ value: string; label: string; count: number }>;
      productLanes: Array<{ value: string; label: string; count: number }>;
      documentTypes: Array<{ value: string; label: string; count: number }>;
    }>(`/api/research/literature/facets${query({ includeCatalog: includeCatalog ? "1" : undefined })}`),
  researchLiteratureOne: (id: string) =>
    request<{ source: Record<string, unknown> }>(`/api/research/literature/${id}`),
  researchLiteratureReview: (id: string, body: { reviewState: string; note?: string }) =>
    request<{ source: Record<string, unknown>; governance: Record<string, unknown> }>(
      `/api/research/literature/${id}/review`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  researchLiteratureAttachClaim: (
    id: string,
    body: { packCode?: string; itemTitle?: string; bodyText?: string; extractKind?: string } = {},
  ) =>
    request<{
      packId: string;
      packCode: string;
      packReviewState: string;
      item: Record<string, unknown>;
      governance: Record<string, unknown>;
    }>(`/api/research/literature/${id}/attach-claim`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** 4R-B research collections */
  researchCollections: (filters: { status?: string; q?: string } = {}) =>
    request<{ collections: Array<Record<string, unknown>> }>(
      `/api/research/collections${query(filters)}`,
    ),
  researchCollection: (id: string) =>
    request<{ collection: Record<string, unknown> & { members?: Array<Record<string, unknown>> } }>(
      `/api/research/collections/${id}`,
    ),
  researchCollectionCreate: (body: {
    code: string;
    title: string;
    summary?: string;
    domainTags?: string[];
    cropTags?: string[];
    regionTags?: string[];
  }) =>
    request<{ collection: Record<string, unknown> }>("/api/research/collections", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  researchCollectionUpdate: (
    id: string,
    body: { title?: string; summary?: string; status?: string; domainTags?: string[] },
  ) =>
    request<{ collection: Record<string, unknown> }>(`/api/research/collections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  researchCollectionAddMember: (id: string, body: { literatureSourceId: string; note?: string }) =>
    request<{ member: Record<string, unknown> }>(`/api/research/collections/${id}/members`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  researchCollectionRemoveMember: (id: string, memberId: string) =>
    request<{ removed: boolean }>(`/api/research/collections/${id}/members/${memberId}`, {
      method: "DELETE",
    }),
  researchCollectionBibliography: (id: string) =>
    request<{
      collectionId: string;
      collectionTitle: string;
      count: number;
      incompleteCount: number;
      references: string[];
      text: string;
      citationStandard: string;
    }>(`/api/research/collections/${id}/bibliography`),
  knowledgeComparisonNotes: (reviewState?: string) =>
    request<{ count: number; notes: Array<Record<string, unknown>> }>(
      `/api/knowledge-packs/comparison-notes${query({ reviewState })}`,
    ),
  reviewKnowledgePack: (id: string, body: { reviewState: string; note?: string }) =>
    request<{ pack: Record<string, unknown>; governance: Record<string, unknown> }>(
      `/api/knowledge-packs/${id}/review`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  knowledgeThresholdBank: (filters: {
    parameter?: string;
    soilTestLevel?: string;
    onlyApproved?: boolean;
    packCode?: string;
  } = {}) =>
    request<{
      count: number;
      live: boolean;
      onlyApproved: boolean;
      note?: string;
      entries: Array<Record<string, unknown>>;
    }>(
      `/api/knowledge-packs/threshold-bank${query({
        ...filters,
        onlyApproved:
          filters.onlyApproved === undefined ? undefined : filters.onlyApproved ? "true" : "false",
      })}`,
    ),
  flahaSoilComparisons: (filters: { status?: string; parameter?: string } = {}) =>
    request<{ count: number; cases: Array<Record<string, unknown>> }>(
      `/api/flahasoil-comparisons${query(filters)}`,
    ),
  createFlahaSoilComparisonFromThreshold: (body: Record<string, unknown>) =>
    request<{ case: Record<string, unknown> }>("/api/flahasoil-comparisons/from-threshold", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  transitionFlahaSoilComparison: (
    id: string,
    body: { status: string; note?: string; productTicketRef?: string },
  ) =>
    request<{ case: Record<string, unknown>; governance: Record<string, unknown> }>(
      `/api/flahasoil-comparisons/${id}/transition`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  flahaSoilBridgeStatus: () =>
    request<{
      upload: { enabled: boolean; accept: string[] };
      soilApi: { configured: boolean; baseUrl: string | null; note: string };
      writeToFlahaSoil: boolean;
    }>("/api/flahasoil-comparisons/bridge-status"),
  importFlahaSoilReport: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const headers = new Headers();
    const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3003";
    let userId = "";
    let tenantId = "";
    let token = "";
    try {
      const raw = localStorage.getItem("flaha.product.auth");
      if (raw) {
        const a = JSON.parse(raw) as { userId?: string; tenantId?: string; token?: string };
        userId = a.userId || "";
        tenantId = a.tenantId || "";
        token = a.token || "";
      }
    } catch {
      /* ignore */
    }
    if (userId) headers.set("X-Flaha-User-Id", userId);
    if (tenantId) headers.set("X-Flaha-Tenant-Id", tenantId);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Flaha-Correlation-Id", `web-import-${Date.now()}`);
    const response = await fetch(`${API_URL}/api/flahasoil-comparisons/import-report`, {
      method: "POST",
      headers,
      body: form,
      credentials: "include",
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    if (!response.ok) {
      throw new ApiError(
        body.error?.code ?? "REQUEST_FAILED",
        body.error?.message ?? "Report import failed.",
        response.status,
      );
    }
    return body as {
      casesCreated: number;
      parsed: Record<string, unknown>;
      cases: Array<Record<string, unknown>>;
      skipped: Array<Record<string, unknown>>;
      governance: Record<string, unknown>;
    };
  },
  importFlahaSoilFromApi: (soilTestId: string) =>
    request<Record<string, unknown>>("/api/flahasoil-comparisons/import-from-soil-api", {
      method: "POST",
      body: JSON.stringify({ soilTestId }),
    }),
};
