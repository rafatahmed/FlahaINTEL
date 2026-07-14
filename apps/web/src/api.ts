import type { Article, RssSource } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "Request failed");
  return body as T;
}

export const api = {
  articles: (q: string) => request<{ items: Article[]; total: number }>(`/api/articles?q=${encodeURIComponent(q)}`),
  sources: () => request<RssSource[]>("/api/sources"),
  addSource: (name: string, url: string) => request<RssSource>("/api/sources", {
    method: "POST", body: JSON.stringify({ name, url }),
  }),
  setSourceEnabled: (id: string, enabled: boolean) => request<RssSource>(`/api/sources/${id}`, {
    method: "PATCH", body: JSON.stringify({ enabled }),
  }),
  collectSource: (id: string) => request(`/api/sources/${id}/collect`, { method: "POST" }),
  collectAll: () => request("/api/collect", { method: "POST" }),
};

