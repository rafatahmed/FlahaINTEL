/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Evidence Intake Contracts
 * Introduction: Intake classes, status matrix, and promote routing for Submit spine.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import type { EvidenceIntakeClass } from "@prisma/client";

export const INTAKE_CLASS_META: Record<
  EvidenceIntakeClass,
  { label: string; lane: string; promote: string; acceptHint: string }
> = {
  UNCLASSIFIED: {
    label: "Unclassified",
    lane: "spine",
    promote: "Classify first",
    acceptHint: "Any landed evidence awaiting class",
  },
  EYES_WEBSITE: {
    label: "Website URL",
    lane: "eyes",
    promote: "Product submission → acquire → extract → governance",
    acceptHint: "http(s) URL",
  },
  EYES_DOCUMENT: {
    label: "General document",
    lane: "eyes",
    promote: "Product submission → extract → normalize → governance",
    acceptHint: "PDF, DOCX, RTF, TXT (max 25 MB); no PPTX",
  },
  MARKET_MAHASEEL_PDF: {
    label: "Mahaseel price PDF",
    lane: "markets",
    promote: "Parse period PDF → market price rows (deduped)",
    acceptHint: "Text-layer PDF (Mahaseel bulletin)",
  },
  MARKET_JO_AMMAN_EXCEL: {
    label: "Jordan Amman Excel",
    lane: "markets",
    promote: "Parse Excel/CSV → Amman price rows (day dedupe)",
    acceptHint: ".xlsx / .xls / .csv (Arabic yearbook layout OK)",
  },
  PRODUCT_SOIL_REPORT: {
    label: "FlahaSOIL report",
    lane: "product",
    promote: "Parse report → comparison cases (never writes SOIL)",
    acceptHint: "Soil PDF/JSON report",
  },
  PRODUCT_CALC_REPORT: {
    label: "FlahaCALC report (irrigation / weather)",
    lane: "calc",
    promote: "Seal artifact → DRAFT IRRIGATION knowledge pack (CALC only; never writes FlahaCALC)",
    acceptHint: "PDF or JSON export notes for ETo/Kc/irrigation (text-layer PDF OK)",
  },
  PRODUCT_FAST_REPORT: {
    label: "FlahaFAST report (nutrient management)",
    lane: "fast",
    promote: "Seal artifact → DRAFT NUTRITION knowledge pack (FAST only; never writes FlahaFAST)",
    acceptHint: "PDF or JSON export notes for formulations / solution chemistry",
  },
};

export const PROMOTABLE_CLASSES: EvidenceIntakeClass[] = [
  "EYES_WEBSITE",
  "EYES_DOCUMENT",
  "MARKET_MAHASEEL_PDF",
  "MARKET_JO_AMMAN_EXCEL",
  "PRODUCT_SOIL_REPORT",
  "PRODUCT_CALC_REPORT",
  "PRODUCT_FAST_REPORT",
];

/** Sister products are three separate engines — never treat CALC and FAST as one. */
export const SISTER_PRODUCTS = [
  { code: "FlahaSOIL", domain: "Soil physics, chemistry, lab reports" },
  { code: "FlahaCALC", domain: "Irrigation, weather, ETo, Kc, water balance" },
  { code: "FlahaFAST", domain: "Nutrient management, formulations, hydroponics" },
] as const;
