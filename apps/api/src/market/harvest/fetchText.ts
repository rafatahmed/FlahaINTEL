/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Bounded HTTP Fetch Helpers
 * Introduction: Simple fetch with timeout for market harvest (no SSRF — fixed allowlisted URLs only).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */

export async function fetchText(url: string, timeoutMs = 45_000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "FlahaINTEL/4M (+https://flaha.local; governed-market-harvest)",
        accept: "text/html,application/json,*/*",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 45_000): Promise<T> {
  const text = await fetchText(url, timeoutMs);
  return JSON.parse(text) as T;
}

export async function fetchBuffer(url: string, timeoutMs = 60_000): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "FlahaINTEL/4M (+https://flaha.local; governed-market-harvest)",
        accept: "application/pdf,*/*",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    clearTimeout(t);
  }
}
