/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaCALC and FlahaFAST Parameter Keys (separate products)
 * Introduction:
 * Canonical wire keys for irrigation/weather (FlahaCALC) and nutrient
 * management (FlahaFAST). Products are distinct — do not merge handoffs.
 * Packs never auto-update product code.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */

export const PRODUCT_TARGETS = ["FlahaCALC", "FlahaFAST", "FlahaSOIL"] as const;
export type ProductTarget = (typeof PRODUCT_TARGETS)[number];

export type CalcFastDomain =
  | "eto"
  | "crop_kc"
  | "irrigation_depth"
  | "soil_water_calc"
  | "landscape"
  | "water_quality_fast"
  | "nutrient_target"
  | "salt_formulation"
  | "equation";

export type FlahaCalcFastParameterSpec = {
  /** Canonical FlahaINTEL wire key for structured.parameter */
  key: string;
  unit?: string;
  domain: CalcFastDomain;
  /** Sister products that understand this identity */
  products: ProductTarget[];
  aliases?: string[];
  notes?: string;
};

/**
 * Aligns with FlahaCalc crop-parameters / irrigation-requirement / soil-parameters
 * and FlahaFast waterQuality / CropRecommendation / formulation targets.
 * Source recon: docs/knowledge/flahacalc-flahafast-recon.md
 */
export const FLAHA_CALC_FAST_PARAMETERS: FlahaCalcFastParameterSpec[] = [
  // —— FlahaCalc ETo ——
  {
    key: "etoMm",
    unit: "mm",
    domain: "eto",
    products: ["FlahaCALC"],
    aliases: ["ETo", "eto", "reference_et"],
  },
  {
    key: "methodEto",
    domain: "eto",
    products: ["FlahaCALC"],
    aliases: ["FAO56", "ASCE", "eto_method"],
    notes: "Enum: FAO56 | ASCE",
  },
  {
    key: "timeScale",
    domain: "eto",
    products: ["FlahaCALC"],
    notes: "hourly | daily | monthly",
  },

  // —— Crop Kc ——
  {
    key: "kc",
    domain: "crop_kc",
    products: ["FlahaCALC"],
    aliases: ["Kc", "crop_coefficient"],
  },
  { key: "kcIni", domain: "crop_kc", products: ["FlahaCALC"], aliases: ["kc_ini"] },
  { key: "kcMid", domain: "crop_kc", products: ["FlahaCALC"], aliases: ["kc_mid"] },
  { key: "kcEnd", domain: "crop_kc", products: ["FlahaCALC"], aliases: ["kc_end"] },
  {
    key: "growthStage",
    domain: "crop_kc",
    products: ["FlahaCALC"],
    notes: "initial | development | mid | late",
  },
  {
    key: "cropName",
    domain: "crop_kc",
    products: ["FlahaCALC"],
    aliases: ["crop"],
    notes: "Must match Calc cropDatabase name when comparing to product table",
  },
  {
    key: "rootDepthM",
    unit: "m",
    domain: "crop_kc",
    products: ["FlahaCALC"],
    aliases: ["root_depth", "Zr"],
  },
  {
    key: "depletionFractionP",
    domain: "crop_kc",
    products: ["FlahaCALC"],
    aliases: ["p", "depletion_fraction"],
  },
  {
    key: "stageIniDays",
    unit: "d",
    domain: "crop_kc",
    products: ["FlahaCALC"],
    aliases: ["stage_ini"],
  },
  {
    key: "stageDevDays",
    unit: "d",
    domain: "crop_kc",
    products: ["FlahaCALC"],
    aliases: ["stage_dev"],
  },
  {
    key: "stageMidDays",
    unit: "d",
    domain: "crop_kc",
    products: ["FlahaCALC"],
    aliases: ["stage_mid"],
  },
  {
    key: "stageLateDays",
    unit: "d",
    domain: "crop_kc",
    products: ["FlahaCALC"],
    aliases: ["stage_late"],
  },

  // —— Irrigation depth / volume ——
  {
    key: "etcMm",
    unit: "mm",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
    aliases: ["ETc", "etc"],
  },
  {
    key: "rainfallMm",
    unit: "mm",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
    aliases: ["P", "rainfall"],
  },
  {
    key: "effectiveRainfallMm",
    unit: "mm",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
    aliases: ["Pe"],
  },
  {
    key: "effectiveRainfallMethod",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
    notes: "QUICK_FRACTION_0_8 | NONE",
  },
  {
    key: "netIrrigationMm",
    unit: "mm",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
    aliases: ["net_I", "In"],
  },
  {
    key: "grossIrrigationMm",
    unit: "mm",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
    aliases: ["gross_I", "Ig"],
  },
  {
    key: "applicationEfficiency",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
    aliases: ["Ea", "efficiency"],
  },
  {
    key: "irrigationSystemName",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
    aliases: ["irrigation_system"],
  },
  {
    key: "applicationRateMmPerH",
    unit: "mm/h",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
    notes: "Verified operational rate vs catalogue illustrative rate",
  },
  {
    key: "areaHa",
    unit: "ha",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
  },
  {
    key: "volumeM3",
    unit: "m³",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
  },
  {
    key: "runtimeHours",
    unit: "h",
    domain: "irrigation_depth",
    products: ["FlahaCALC"],
    notes: "Operational only when verified application rate present",
  },

  // —— Calc FAO-56 Table 19 soil water (not SOIL engine) ——
  {
    key: "fieldCapacity",
    unit: "m³/m³",
    domain: "soil_water_calc",
    products: ["FlahaCALC", "FlahaSOIL"],
    aliases: ["θFC", "FC"],
    notes: "Calc uses FAO-56 Table 19 defaults; SOIL may use Saxton–Rawls — compare carefully",
  },
  {
    key: "wiltingPoint",
    unit: "m³/m³",
    domain: "soil_water_calc",
    products: ["FlahaCALC", "FlahaSOIL"],
    aliases: ["θWP", "WP"],
  },
  {
    key: "awc",
    unit: "m³/m³",
    domain: "soil_water_calc",
    products: ["FlahaCALC"],
    aliases: ["available_water_capacity"],
  },
  {
    key: "tawMm",
    unit: "mm",
    domain: "soil_water_calc",
    products: ["FlahaCALC"],
    aliases: ["TAW"],
  },
  {
    key: "rawMm",
    unit: "mm",
    domain: "soil_water_calc",
    products: ["FlahaCALC"],
    aliases: ["RAW"],
  },
  {
    key: "depletionMm",
    unit: "mm",
    domain: "soil_water_calc",
    products: ["FlahaCALC"],
    aliases: ["Dr", "depletion"],
  },
  {
    key: "ksStress",
    domain: "soil_water_calc",
    products: ["FlahaCALC"],
    aliases: ["Ks", "stress_coefficient"],
  },

  // —— Landscape ——
  {
    key: "landscapeKl",
    domain: "landscape",
    products: ["FlahaCALC"],
    aliases: ["KL", "K_L"],
  },
  {
    key: "landscapeMethod",
    domain: "landscape",
    products: ["FlahaCALC"],
    notes: "Product default WUCOLS_KL_V1",
  },

  // —— FlahaFast water ——
  {
    key: "solutionEc",
    unit: "dS/m",
    domain: "water_quality_fast",
    products: ["FlahaFAST"],
    aliases: ["ec", "EC", "water_ec"],
    notes: "Confirm display unit in Fast UI when exporting",
  },
  {
    key: "solutionPh",
    unit: "pH",
    domain: "water_quality_fast",
    products: ["FlahaFAST"],
    aliases: ["ph", "pH", "water_ph"],
  },
  {
    key: "waterElementPpm",
    unit: "ppm",
    domain: "water_quality_fast",
    products: ["FlahaFAST"],
    notes: "Pair with elementSymbol",
  },
  {
    key: "alkalinity",
    domain: "water_quality_fast",
    products: ["FlahaFAST"],
  },
  {
    key: "hardness",
    domain: "water_quality_fast",
    products: ["FlahaFAST"],
  },
  {
    key: "irrigationWaterEcDsM",
    unit: "dS/m",
    domain: "water_quality_fast",
    products: ["FlahaCALC", "FlahaFAST", "FlahaSOIL"],
    aliases: ["irrigation_water_ec"],
    notes: "Cross-theme; not interchangeable with soil ECe without method context",
  },

  // —— Nutrient targets ——
  {
    key: "targetElementPpm",
    unit: "ppm",
    domain: "nutrient_target",
    products: ["FlahaFAST"],
    notes: "Pair with elementSymbol",
  },
  {
    key: "elementSymbol",
    domain: "nutrient_target",
    products: ["FlahaFAST"],
    aliases: ["element"],
    notes: "N P K Ca Mg S Fe Mn Zn B Cu Mo …",
  },
  {
    key: "cropTypeBucket",
    domain: "nutrient_target",
    products: ["FlahaFAST"],
    notes: "e.g. Leafy greens | Fruiting vegetables | Herbs | Berries | Microgreens",
  },
  {
    key: "growthStageNutrient",
    domain: "nutrient_target",
    products: ["FlahaFAST"],
    notes: "seedling | vegetative | mature | …",
  },

  // —— Salts / formulation ——
  {
    key: "saltName",
    domain: "salt_formulation",
    products: ["FlahaFAST"],
  },
  {
    key: "saltFormula",
    domain: "salt_formulation",
    products: ["FlahaFAST"],
  },
  {
    key: "saltElementPercent",
    unit: "%",
    domain: "salt_formulation",
    products: ["FlahaFAST"],
  },
  {
    key: "batchVolumeL",
    unit: "L",
    domain: "salt_formulation",
    products: ["FlahaFAST"],
  },

  // —— Equation identity ——
  {
    key: "equationId",
    domain: "equation",
    products: ["FlahaCALC", "FlahaFAST"],
    notes: "e.g. ETc_Kc_ETo, Net_I_ETc_Pe, Gross_I_Net_Ea",
  },
];

const aliasIndex = new Map<string, string>();
for (const spec of FLAHA_CALC_FAST_PARAMETERS) {
  aliasIndex.set(spec.key.toLowerCase(), spec.key);
  for (const a of spec.aliases ?? []) {
    aliasIndex.set(a.toLowerCase(), spec.key);
  }
}

export function normalizeCalcFastParameterKey(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return aliasIndex.get(t.toLowerCase()) ?? null;
}

export function getCalcFastParameterSpec(keyOrAlias: string): FlahaCalcFastParameterSpec | undefined {
  const key = normalizeCalcFastParameterKey(keyOrAlias) ?? keyOrAlias.trim();
  return FLAHA_CALC_FAST_PARAMETERS.find((s) => s.key === key);
}

export function listCalcFastParametersByProduct(product: ProductTarget): FlahaCalcFastParameterSpec[] {
  return FLAHA_CALC_FAST_PARAMETERS.filter((s) => s.products.includes(product));
}

/** Structured flags required on 4I extracts that touch sister products */
export const HANDOFF_NO_AUTO_FLAGS = {
  doesNotAutoUpdateFlahaCALC: true,
  doesNotAutoUpdateFlahaFAST: true,
  doesNotAutoUpdateFlahaSOIL: true,
  autoApplyBlocked: true,
} as const;

export type HandoffEnvelopeV1 = {
  envelopeVersion: "flaha-intel-product-handoff-v1";
  generatedAt: string;
  tenantCode: string;
  targets: ProductTarget[];
  autoApplyBlocked: true;
  sourcePacks: Array<{
    code: string;
    theme: string;
    reviewState: string;
  }>;
  equations: Array<{
    equationId: string;
    form: string;
    product?: ProductTarget;
  }>;
  parameters: Array<{
    key: string;
    value?: number | string;
    unit?: string | null;
    cropName?: string;
    elementSymbol?: string;
    confidence?: string;
    evidenceItemId?: string;
  }>;
  notes: string[];
};
