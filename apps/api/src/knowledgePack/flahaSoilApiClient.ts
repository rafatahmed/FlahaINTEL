/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaSOIL API Client (read-only stub)
 * Introduction: Optional direct read of FlahaSOIL reports when FLAHASOIL_API_BASE_URL is set.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */

export type FlahaSoilApiConfig = {
  baseUrl: string;
  /** Bearer token for FlahaSOIL v2 API (never log). */
  accessToken?: string;
};

export function getFlahaSoilApiConfig(): FlahaSoilApiConfig | null {
  const baseUrl = process.env.FLAHASOIL_API_BASE_URL?.trim();
  if (!baseUrl) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    accessToken: process.env.FLAHASOIL_API_TOKEN?.trim() || undefined,
  };
}

/**
 * Read-only: fetch a soil-test report envelope from FlahaSOIL.
 * Expected path (product): GET {base}/api/v2/soil-tests/:soilTestId/report
 * Returns JSON for parseFlahaSoilReportJson — never mutates SOIL.
 */
export async function fetchFlahaSoilReportJson(soilTestId: string): Promise<unknown> {
  const cfg = getFlahaSoilApiConfig();
  if (!cfg) {
    throw new Error(
      "FLAHASOIL_API_BASE_URL is not configured. Upload a PDF/JSON report instead, or set FLAHASOIL_API_BASE_URL + FLAHASOIL_API_TOKEN.",
    );
  }
  const url = `${cfg.baseUrl}/api/v2/soil-tests/${encodeURIComponent(soilTestId)}/report`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cfg.accessToken) headers.Authorization = `Bearer ${cfg.accessToken}`;

  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FlahaSOIL report fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}
