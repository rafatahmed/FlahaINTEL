/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Amman Live Form Harvest
 * Introduction: GET+POST ASP.NET search for Greater Amman central market prices.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { parseAmmanSearchHtml } from "../parsers/ammanHtml.js";
import type { AmmanRawRow } from "../parsers/amman.js";
import { MarketValidationError, parseObservedOn, toIsoDate } from "../validation.js";

const AMMAN_URL = "https://www.ammancity.gov.jo/ar/market/prices.aspx";
const UA = "FlahaINTEL/4M (+https://flaha.local; governed-market-harvest)";

function hidden(html: string, id: string): string {
  const m = html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`, "i"))
    || html.match(new RegExp(`name="${id}"[^>]*value="([^"]*)"`, "i"));
  return m?.[1] ?? "";
}

/** Format Date as DD-MM-YYYY for Amman form. */
export function toAmmanDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export async function harvestAmmanLive(opts: {
  from: string;
  to: string;
  origin?: "LOCAL" | "IMPORTED";
}): Promise<{
  rows: AmmanRawRow[];
  dayTotals?: { vegetablesTons: number; fruitTons: number; leafyGreensTons: number };
  evidenceUrl: string;
}> {
  const from = parseObservedOn(opts.from);
  const to = parseObservedOn(opts.to);
  const origin = opts.origin ?? "LOCAL";
  const fruitType = origin === "IMPORTED" ? "rbImported" : "rbLocal";

  const getRes = await fetch(AMMAN_URL, {
    headers: { "user-agent": UA, accept: "text/html" },
    redirect: "follow",
  });
  if (!getRes.ok) throw new MarketValidationError("AMMAN_GET_FAILED", `Amman GET HTTP ${getRes.status}`);
  const getHtml = await getRes.text();
  const cookies = getRes.headers.getSetCookie?.() ?? [];
  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");

  const viewState = hidden(getHtml, "__VIEWSTATE");
  const eventValidation = hidden(getHtml, "__EVENTVALIDATION");
  const viewStateGen = hidden(getHtml, "__VIEWSTATEGENERATOR");
  if (!viewState) {
    throw new MarketValidationError("AMMAN_VIEWSTATE_MISSING", "Could not read __VIEWSTATE from Amman page.");
  }

  const body = new URLSearchParams({
    __EVENTTARGET: "ctl00$ContentPlaceHolder1$btnSearch",
    __EVENTARGUMENT: "",
    __LASTFOCUS: "",
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGen || "6846CBA5",
    __VIEWSTATEENCRYPTED: "",
    __EVENTVALIDATION: eventValidation,
    "ctl00$ContentPlaceHolder1$txtfromdate": toAmmanDate(from),
    "ctl00$ContentPlaceHolder1$txttodate": toAmmanDate(to),
    "ctl00$ContentPlaceHolder1$FruitType": fruitType,
  });

  const postRes = await fetch(AMMAN_URL, {
    method: "POST",
    headers: {
      "user-agent": UA,
      "content-type": "application/x-www-form-urlencoded",
      accept: "text/html",
      cookie: cookieHeader,
      referer: AMMAN_URL,
    },
    body: body.toString(),
    redirect: "follow",
  });
  if (!postRes.ok) throw new MarketValidationError("AMMAN_POST_FAILED", `Amman POST HTTP ${postRes.status}`);
  const postHtml = await postRes.text();
  const parsed = parseAmmanSearchHtml(postHtml, { origin, evidenceUrl: AMMAN_URL });
  // Ensure price dates present
  for (const r of parsed.rows) {
    if (!r.priceDate) r.priceDate = toIsoDate(to);
  }
  return { ...parsed, evidenceUrl: AMMAN_URL };
}
