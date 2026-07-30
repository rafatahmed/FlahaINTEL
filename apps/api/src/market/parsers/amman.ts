/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Amman Central Market Row Mapper
 * Introduction: Maps Amman UI/PDF fields (qrsh, high/mode/low, tons) into PriceRowInput.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { PriceRowInput } from "../service.js";
import { MarketValidationError, QRSH_TO_JOD, toIsoDate, parseObservedOn } from "../validation.js";

export type AmmanRawRow = {
  /** Price date DD-MM-YYYY or YYYY-MM-DD */
  priceDate: string;
  commodityNameAr?: string;
  commodityNameEn?: string;
  commodityName?: string;
  /** Highest price in قرش */
  highestQrsh: number;
  /** Most common price in قرش */
  mostCommonQrsh: number;
  /** Minimum price in قرش */
  minimumQrsh: number;
  quantityTons: number;
  /** e.g. kilo / kg */
  packageUnit?: string;
  origin?: "LOCAL" | "IMPORTED";
  evidenceUrl: string;
};

export type AmmanDayTotals = {
  vegetablesTons: number;
  fruitTons: number;
  leafyGreensTons: number;
};

/**
 * Map one Amman product card / print-PDF row into a global price observation input.
 * 1 qrsh = 0.01 JOD.
 */
export function mapAmmanRow(raw: AmmanRawRow): PriceRowInput {
  const nameEn = (raw.commodityNameEn || raw.commodityName || "").trim();
  const nameAr = (raw.commodityNameAr || "").trim();
  if (!nameEn && !nameAr) {
    throw new MarketValidationError("AMMAN_NAME_REQUIRED", "commodityNameEn or commodityNameAr is required.");
  }
  const display = nameEn || nameAr;
  const observedOn = toIsoDate(parseObservedOn(raw.priceDate));
  const pack = (raw.packageUnit || "kg").trim().toLowerCase();
  return {
    observedOn,
    commodityName: display,
    commodityNameEn: nameEn || null,
    commodityNameAr: nameAr || null,
    originLabel: raw.origin ?? "LOCAL",
    unit: pack === "kilo" ? "kg" : pack,
    packDescription: pack,
    nativePriceUnit: "QRSH",
    nativeToCurrencyFactor: QRSH_TO_JOD,
    priceHighNative: raw.highestQrsh,
    priceModeNative: raw.mostCommonQrsh,
    priceLowNative: raw.minimumQrsh,
    currency: "JOD",
    quantityTons: raw.quantityTons,
    evidenceUrl: raw.evidenceUrl,
  };
}

export function mapAmmanDaySummaries(totals: AmmanDayTotals): Array<{ category: string; quantityTons: number }> {
  return [
    { category: "vegetables", quantityTons: totals.vegetablesTons },
    { category: "fruit", quantityTons: totals.fruitTons },
    { category: "leafy-greens", quantityTons: totals.leafyGreensTons },
  ];
}
