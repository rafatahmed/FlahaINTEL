/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaSOIL Parameter Keys (4S-B alignment)
 * Introduction:
 * Canonical wire keys and SoilTestLevel applicability for knowledge extracts,
 * aligned to FlahaSoil shared-types / report parameters.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */

export const SOIL_TEST_LEVELS = ["PRELIMINARY", "MODERATE", "ADVANCED"] as const;
export type SoilTestLevel = (typeof SOIL_TEST_LEVELS)[number];

export type FlahaSoilParameterSpec = {
  /** Canonical FlahaSOIL wire / report key */
  key: string;
  unit?: string;
  /** Lowest declared test level where this field is expected in the level matrix */
  appliesFromLevel: SoilTestLevel;
  /** Human labels / legacy aliases → normalized to key */
  aliases?: string[];
  /** Outside soil-test panel but valid for packs (e.g. irrigation water) */
  domain?: "soil" | "irrigation_water" | "model" | "qualitative";
};

/**
 * Aligns with FlahaSoil PRELIMINARY / MODERATE / ADVANCED field matrix
 * and common engine/report outputs used in PDF snapshots.
 */
export const FLAHA_SOIL_PARAMETERS: FlahaSoilParameterSpec[] = [
  // PRELIMINARY inputs
  { key: "sandPercent", unit: "%", appliesFromLevel: "PRELIMINARY", aliases: ["sand"] },
  { key: "siltPercent", unit: "%", appliesFromLevel: "PRELIMINARY", aliases: ["silt"] },
  { key: "clayPercent", unit: "%", appliesFromLevel: "PRELIMINARY", aliases: ["clay"] },
  {
    key: "organicMatterPercent",
    unit: "%",
    appliesFromLevel: "PRELIMINARY",
    aliases: ["organic_matter", "OM", "organicMatter", "organic matter"],
  },
  { key: "pH", unit: "pH", appliesFromLevel: "PRELIMINARY", aliases: ["ph", "pH_H2O"] },
  {
    key: "ecDsM",
    unit: "dS/m",
    appliesFromLevel: "PRELIMINARY",
    aliases: ["EC", "ECe", "ec", "ece", "electrical_conductivity"],
  },
  { key: "tdsMgL", unit: "mg/L", appliesFromLevel: "PRELIMINARY", aliases: ["TDS", "tds"] },

  // Physics / model (all levels may show; not lab measurements)
  { key: "textureClass", appliesFromLevel: "PRELIMINARY", aliases: ["USDA_texture", "texture"], domain: "model" },
  { key: "fieldCapacity", unit: "% v/v", appliesFromLevel: "PRELIMINARY", aliases: ["FC"], domain: "model" },
  { key: "wiltingPoint", unit: "% v/v", appliesFromLevel: "PRELIMINARY", aliases: ["WP"], domain: "model" },
  {
    key: "plantAvailableWater",
    unit: "% v/v",
    appliesFromLevel: "PRELIMINARY",
    aliases: ["PAW"],
    domain: "model",
  },
  { key: "bulkDensity", unit: "g/cm³", appliesFromLevel: "PRELIMINARY", aliases: ["bulk_density"], domain: "model" },
  {
    key: "saturatedConductivity",
    unit: "mm/h",
    appliesFromLevel: "PRELIMINARY",
    aliases: ["Ksat", "ksat"],
    domain: "model",
  },
  { key: "drainageClass", appliesFromLevel: "PRELIMINARY", domain: "model" },
  { key: "waterHoldingClass", appliesFromLevel: "PRELIMINARY", domain: "model" },

  // MODERATE chemistry
  { key: "ca", unit: "cmol(+)/kg", appliesFromLevel: "MODERATE", aliases: ["Ca", "calcium"] },
  { key: "mg", unit: "cmol(+)/kg", appliesFromLevel: "MODERATE", aliases: ["Mg", "magnesium"] },
  { key: "k", unit: "cmol(+)/kg", appliesFromLevel: "MODERATE", aliases: ["K", "potassium"] },
  { key: "na", unit: "cmol(+)/kg", appliesFromLevel: "MODERATE", aliases: ["Na", "sodium"] },
  { key: "cl", unit: "mg/kg", appliesFromLevel: "MODERATE", aliases: ["Cl", "chloride"] },
  { key: "n", unit: "mg/kg", appliesFromLevel: "MODERATE", aliases: ["N", "nitrogen"] },
  { key: "p", unit: "mg/kg", appliesFromLevel: "MODERATE", aliases: ["P", "phosphorus"] },
  { key: "cec", unit: "cmol(+)/kg", appliesFromLevel: "MODERATE", aliases: ["CEC"] },

  // ADVANCED
  { key: "fe", unit: "mg/kg", appliesFromLevel: "ADVANCED", aliases: ["Fe", "iron"] },
  { key: "mn", unit: "mg/kg", appliesFromLevel: "ADVANCED", aliases: ["Mn", "manganese"] },
  { key: "zn", unit: "mg/kg", appliesFromLevel: "ADVANCED", aliases: ["Zn", "zinc"] },
  { key: "cu", unit: "mg/kg", appliesFromLevel: "ADVANCED", aliases: ["Cu", "copper"] },
  { key: "b", unit: "mg/kg", appliesFromLevel: "ADVANCED", aliases: ["B", "boron"] },
  { key: "mo", unit: "mg/kg", appliesFromLevel: "ADVANCED", aliases: ["Mo", "molybdenum"] },
  { key: "s", unit: "mg/kg", appliesFromLevel: "ADVANCED", aliases: ["S", "sulphur", "sulfur"] },
  { key: "carbonate", unit: "mg/kg", appliesFromLevel: "ADVANCED", aliases: ["CO3"] },
  { key: "bicarbonate", unit: "mg/kg", appliesFromLevel: "ADVANCED", aliases: ["HCO3"] },
  { key: "sar", appliesFromLevel: "ADVANCED", aliases: ["SAR"] },
  { key: "esp", unit: "%", appliesFromLevel: "ADVANCED", aliases: ["ESP"] },
  {
    key: "heavyMetalsJson",
    appliesFromLevel: "ADVANCED",
    aliases: ["heavy_metals", "heavyMetals"],
  },

  // Irrigation water (not soil chemistry panel)
  {
    key: "irrigationWaterEcDsM",
    unit: "dS/m",
    appliesFromLevel: "PRELIMINARY",
    aliases: ["irrigation_water_EC", "irrigationWaterEC", "water_EC"],
    domain: "irrigation_water",
  },

  // Qualitative management topics (comparison narrative)
  {
    key: "soilMoistureManagement",
    appliesFromLevel: "PRELIMINARY",
    aliases: ["soil_moisture_management", "moisture_consistency"],
    domain: "qualitative",
  },
];

const LEVEL_RANK: Record<SoilTestLevel, number> = {
  PRELIMINARY: 0,
  MODERATE: 1,
  ADVANCED: 2,
};

const byKey = new Map(FLAHA_SOIL_PARAMETERS.map((p) => [p.key, p]));
const aliasToKey = new Map<string, string>();
for (const p of FLAHA_SOIL_PARAMETERS) {
  aliasToKey.set(normAlias(p.key), p.key);
  for (const a of p.aliases ?? []) {
    aliasToKey.set(normAlias(a), p.key);
  }
}

function normAlias(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizeSoilTestLevel(raw: string): SoilTestLevel | null {
  const u = raw.trim().toUpperCase();
  if ((SOIL_TEST_LEVELS as readonly string[]).includes(u)) return u as SoilTestLevel;
  return null;
}

export function normalizeFlahaSoilParameter(raw: string): string | null {
  if (!raw?.trim()) return null;
  const direct = byKey.get(raw.trim());
  if (direct) return direct.key;
  return aliasToKey.get(normAlias(raw)) ?? null;
}

export function getParameterSpec(key: string): FlahaSoilParameterSpec | undefined {
  return byKey.get(key);
}

export function levelsAtOrAbove(from: SoilTestLevel): SoilTestLevel[] {
  const rank = LEVEL_RANK[from];
  return SOIL_TEST_LEVELS.filter((l) => LEVEL_RANK[l] >= rank);
}

/** Default soilTestLevels when only appliesFromLevel is known. */
export function defaultSoilTestLevels(appliesFrom: SoilTestLevel): SoilTestLevel[] {
  return levelsAtOrAbove(appliesFrom);
}

export function rankLevel(level: SoilTestLevel): number {
  return LEVEL_RANK[level];
}
