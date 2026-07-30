/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Amman HTML Card Parser Tests
 * Introduction: Parses fixture-like card HTML for high/mode/low qrsh and day totals.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { describe, expect, it } from "vitest";
import { parseAmmanSearchHtml } from "./ammanHtml.js";

const FIXTURE = `
<div class="col-md-6 col-lg-4 mb-4">
  <div class="card shadow-sm h-100">
    <div class="card-header bg-brown text-white">
      <i class="fas fa-apple-alt"></i>
      اسود رفيع
    </div>
    <div class="card-body">
      <p class="card-text text-muted">
        <i class="fas fa-calendar-alt"></i>&nbsp;<strong>تاريخ السعر:</strong> 30-07-2026
      </p>
      <p class="card-text mb-2 text-danger">
        <i class="fas fa-arrow-up"></i>&nbsp;<strong>السعر الأعلى:</strong> 50 قرش
      </p>
      <p class="card-text mb-2 text-success ">
        <i class="fas fa-balance-scale"></i>&nbsp;<strong>السعر الأغلب:</strong> 25   قرش
      </p>
      <p class="card-text mb-2 text-brown">
        <i class="fas fa-arrow-down"></i>&nbsp;<strong>السعر الأدنى:</strong> 10 قرش
      </p>
      <p class="card-text mb-2">
        <i class="fas fa-weight-hanging"></i>&nbsp;<strong>الكمية:</strong>31.929  طن
      </p>
      <p class="card-text mb-2">
        <i class="fas fa-box"></i>&nbsp;<strong>العبوة:</strong> كيلو
      </p>
    </div>
  </div>
</div>
<span id="ctl00_ContentPlaceHolder1_rptPrices_ctl83_lblSumType1">2,103.424</span>
<span id="ctl00_ContentPlaceHolder1_rptPrices_ctl83_lblSumType2">761.316</span>
<span id="ctl00_ContentPlaceHolder1_rptPrices_ctl83_lblSumType3">169.974</span>
`;

describe("parseAmmanSearchHtml", () => {
  it("parses product card and day totals", () => {
    const { rows, dayTotals } = parseAmmanSearchHtml(FIXTURE, {
      origin: "LOCAL",
      evidenceUrl: "https://www.ammancity.gov.jo/ar/market/prices.aspx",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.commodityNameAr).toContain("اسود");
    expect(rows[0]!.highestQrsh).toBe(50);
    expect(rows[0]!.mostCommonQrsh).toBe(25);
    expect(rows[0]!.minimumQrsh).toBe(10);
    expect(rows[0]!.quantityTons).toBe(31.929);
    expect(dayTotals?.vegetablesTons).toBe(2103.424);
    expect(dayTotals?.fruitTons).toBe(761.316);
  });
});
