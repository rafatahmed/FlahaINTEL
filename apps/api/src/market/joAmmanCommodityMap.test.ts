/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Jordan Amman Commodity Map Tests
 * Introduction: thin black ↔ اسود رفيع and related AR→EN code mapping.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { describe, expect, it } from "vitest";
import {
  lookupJoAmmanCommodity,
  normalizeArabicMarketLabel,
  resolveJoAmmanNames,
} from "./joAmmanCommodityMap.js";

describe("jo Amman commodity EN map", () => {
  it("maps thin black ↔ اسود رفيع to stable code", () => {
    const hit = lookupJoAmmanCommodity("اسود رفيع");
    expect(hit?.en).toBe("thin black");
    expect(hit?.code).toBe("thin-black");
  });

  it("tolerates tatweel and alef variants", () => {
    expect(lookupJoAmmanCommodity("أسود رفيع")?.code).toBe("thin-black");
    expect(lookupJoAmmanCommodity("فطــــــر")?.code).toBe("mushroom");
    expect(normalizeArabicMarketLabel("فطــــــر")).toBe(normalizeArabicMarketLabel("فطر"));
  });

  it("resolves display names for harvest enrichment", () => {
    const r = resolveJoAmmanNames({ commodityNameAr: "بندورة" });
    expect(r.mapped).toBe(true);
    expect(r.commodityNameEn).toBe("tomato");
    expect(r.commodityCode).toBe("tomato");
    expect(r.displayName).toBe("tomato");
  });

  it("keeps explicit EN when provided", () => {
    const r = resolveJoAmmanNames({
      commodityNameAr: "اسود رفيع",
      commodityNameEn: "thin black",
    });
    expect(r.commodityCode).toBe("thin-black");
    expect(r.commodityNameEn).toBe("thin black");
  });

  it("returns unmapped for unknown AR titles", () => {
    const r = resolveJoAmmanNames({ commodityNameAr: "منتج غير معروف" });
    expect(r.mapped).toBe(false);
    expect(r.commodityCode).toBeNull();
  });
});
