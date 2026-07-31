/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Commodity EN Map Tests
 * Introduction: AR→EN commodity and method resolution for Mahaseel series identity.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import { resolveMahaseelNames } from "./mahaseelCommodityMap.js";

describe("Mahaseel commodity EN map", () => {
  it("maps Arabic tomato + wired to English series identity", () => {
    const r = resolveMahaseelNames({
      commodityName: "طماطم",
      grade: "1",
      cultivationMethod: "سلكي",
    });
    expect(r.commodityName).toBe("Tomato");
    expect(r.commodityNameEn).toBe("Tomato");
    expect(r.commodityNameAr).toBe("طماطم");
    expect(r.commodityCode).toBe("tomato");
    expect(r.cultivationMethod).toBe("Wired");
    expect(r.packDescription).toBe("grade-1-wired");
    expect(r.mappedCommodity).toBe(true);
    expect(r.mappedMethod).toBe(true);
  });

  it("keeps English tomato identical so AR PDF does not create a second series", () => {
    const ar = resolveMahaseelNames({ commodityName: "طماطم", grade: "1", cultivationMethod: "محمي" });
    const en = resolveMahaseelNames({ commodityName: "Tomato", grade: "1", cultivationMethod: "Protected" });
    expect(ar.commodityCode).toBe(en.commodityCode);
    expect(ar.packDescription).toBe(en.packDescription);
  });

  it("separates grade 1 and grade 2 packs", () => {
    const g1 = resolveMahaseelNames({ commodityName: "Cucumber", grade: "1", cultivationMethod: "Protected" });
    const g2 = resolveMahaseelNames({ commodityName: "Cucumber", grade: "2", cultivationMethod: "Protected" });
    expect(g1.packDescription).toBe("grade-1-protected");
    expect(g2.packDescription).toBe("grade-2-protected");
    expect(g1.packDescription).not.toBe(g2.packDescription);
  });
});
