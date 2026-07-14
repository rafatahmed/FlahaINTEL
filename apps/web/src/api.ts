import type { ArticlePage, RssSource, SchedulerStatus } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3003";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({})) as ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(
      body.error?.code ?? "REQUEST_FAILED",
      body.error?.message ?? "Request failed.",
      response.status,
    );
  }
  return body as T;
}

export const api = {
  articles: (q: string, page = 1, limit = 20) => request<ArticlePage>(
    `/api/articles?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`,
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
};

