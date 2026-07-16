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
};
