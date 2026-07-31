/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Product Lanes (sister products)
 * Introduction:
 * Systematic map theme → FlahaSOIL | FlahaCALC | FlahaFAST | Markets.
 * CALC (irrigation/weather) and FAST (nutrients) are never one product.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */

export type ProductLaneId = "soil" | "calc" | "fast" | "markets";

export type ProductLaneDef = {
  id: ProductLaneId;
  /** Primary sister product or Markets */
  product: "FlahaSOIL" | "FlahaCALC" | "FlahaFAST" | "Markets";
  /** Pack themes owned by this lane */
  themes: string[];
  color: "success" | "info" | "secondary" | "warning";
  domain: string;
  inScope: string[];
  outOfScope: string[];
  tools: string[];
  sampleCodes: string[];
  neverAutoUpdateFlag: string;
};

/** Locked product matrix for Knowledge UI */
export const PRODUCT_LANES: ProductLaneDef[] = [
  {
    id: "soil",
    product: "FlahaSOIL",
    themes: ["SOIL"],
    color: "success",
    domain: "Soil physics, chemistry, lab interpretation",
    inScope: [
      "Lab thresholds (pH, EC, CEC, SAR…)",
      "Methods & soil test levels (PRELIMINARY → ADVANCED)",
      "Comparison cases vs FlahaSOIL reports",
      "Report PDF/JSON import (bridge)",
    ],
    outOfScope: [
      "Irrigation scheduling / ETo / Kc (→ FlahaCALC)",
      "Hydroponic recipes / nutrient ppm targets (→ FlahaFAST)",
      "Market prices (→ Markets)",
    ],
    tools: ["Packs", "Threshold bank", "Comparison cases", "Report import"],
    sampleCodes: [
      "soil-thresholds-baseline-v1",
      "flahasoil-comparison-notes-v1",
      "literature-threshold-bank-v1",
    ],
    neverAutoUpdateFlag: "doesNotAutoUpdateFlahaSOIL",
  },
  {
    id: "calc",
    product: "FlahaCALC",
    themes: ["IRRIGATION"],
    color: "info",
    domain: "Irrigation and weather (water need)",
    inScope: [
      "Reference ETo (FAO-56 / ASCE)",
      "Crop Kc, stages, root depth, depletion p",
      "ETc, net/gross irrigation, efficiency, runtime notes",
      "Landscape KL / water-saving methods",
      "Weather / climate context for irrigation",
    ],
    outOfScope: [
      "Nutrient ppm targets, salt recipes (→ FlahaFAST)",
      "Soil lab chemistry panels (→ FlahaSOIL)",
      "Commodity market prices (→ Markets)",
    ],
    tools: ["Irrigation packs only", "Human review", "4I-B CALC-only handoff export"],
    sampleCodes: ["irrigation-calc-kc-etc-backbone-v1", "irrigation-water-saving-notes-v1"],
    neverAutoUpdateFlag: "doesNotAutoUpdateFlahaCALC",
  },
  {
    id: "fast",
    product: "FlahaFAST",
    themes: ["NUTRITION"],
    color: "secondary",
    domain: "Nutrient management (hydroponics / fertigation chemistry)",
    inScope: [
      "Solution EC / pH bands",
      "Target element ppm (N, P, K, Ca, Mg, micros…)",
      "Source water ions, alkalinity",
      "Salt / formulation / stock-solution notes",
      "Crop nutrient profile stages",
    ],
    outOfScope: [
      "ETo, Kc, irrigation runtime (→ FlahaCALC)",
      "Soil exchange chemistry / SAR as soil report (→ FlahaSOIL)",
      "Market prices (→ Markets)",
    ],
    tools: ["Nutrition packs only", "Human review", "Handoff later (FAST-only envelope)"],
    sampleCodes: ["nutrition-fast-water-targets-v1"],
    neverAutoUpdateFlag: "doesNotAutoUpdateFlahaFAST",
  },
  {
    id: "markets",
    product: "Markets",
    themes: ["MARKET_CONTEXT"],
    color: "warning",
    domain: "Market price context for farm advice",
    inScope: ["Analyst packs from live prices", "Freshness, top commodities, cadence"],
    outOfScope: [
      "FlahaSOIL / FlahaCALC / FlahaFAST algorithms",
      "Auto-advising farmers without human review",
    ],
    tools: ["Rebuild on Markets page", "Review packs here"],
    sampleCodes: ["market-analyst-*-v1"],
    neverAutoUpdateFlag: "n/a",
  },
];

export function laneById(id: ProductLaneId): ProductLaneDef {
  return PRODUCT_LANES.find((l) => l.id === id)!;
}

export function primaryProductForTheme(theme: string): string {
  for (const lane of PRODUCT_LANES) {
    if (lane.themes.includes(theme)) return lane.product;
  }
  return "Other";
}

export function productChipColor(
  product: string,
): "default" | "primary" | "secondary" | "success" | "warning" | "info" {
  if (product === "FlahaSOIL") return "success";
  if (product === "FlahaCALC") return "info";
  if (product === "FlahaFAST") return "secondary";
  if (product === "Markets") return "warning";
  return "default";
}
