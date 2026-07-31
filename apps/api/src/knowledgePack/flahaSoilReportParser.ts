/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaSOIL Report Text Parser
 * Introduction: Extracts control fields and key parameters from FlahaSOIL PDF/report text.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */

export type ParsedFlahaSoilReport = {
  reportNumber: string | null;
  reportDate: string | null;
  testLevel: "PRELIMINARY" | "MODERATE" | "ADVANCED" | null;
  sampleId: string | null;
  locationName: string | null;
  overallSummary: string | null;
  textureClass: string | null;
  values: Partial<
    Record<
      | "ecDsM"
      | "pH"
      | "organicMatterPercent"
      | "sar"
      | "esp"
      | "cec"
      | "sandPercent"
      | "siltPercent"
      | "clayPercent"
      | "fieldCapacity"
      | "wiltingPoint"
      | "plantAvailableWater"
      | "bulkDensity"
      | "n"
      | "p"
      | "ca"
      | "mg"
      | "k"
      | "na",
      number
    >
  >;
  rawTextLength: number;
  parseNotes: string[];
};

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1]?.trim() || null;
}

function num(s: string | undefined | null): number | null {
  if (s == null) return null;
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse FlahaSOIL professional PDF text (layout from pdftotext / pdfplumber).
 * Tolerant of OCR-ish artifacts (H‚O, etc.).
 */
export function parseFlahaSoilReportText(text: string): ParsedFlahaSoilReport {
  const t = text.replace(/\u0000/g, " ");
  const notes: string[] = [];
  const values: ParsedFlahaSoilReport["values"] = {};

  const reportNumber =
    firstMatch(t, /REPORT\s*NUMBER[\s\S]{0,40}?(FLH-\d{4}-\d+)/i) ||
    firstMatch(t, /\b(FLH-\d{4}-\d+)\b/i);

  const reportDate =
    firstMatch(t, /REPORT\s*DATE[\s\S]{0,40}?(\d{1,2}\s+\w+\s+\d{4})/i) ||
    firstMatch(t, /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i);

  let testLevel: ParsedFlahaSoilReport["testLevel"] = null;
  const levelRaw =
    firstMatch(t, /TEST\s*LEVEL[\s\S]{0,30}?\b(PRELIMINARY|MODERATE|ADVANCED)\b/i) ||
    firstMatch(t, /Test\s*level:\s*(PRELIMINARY|MODERATE|ADVANCED)/i) ||
    firstMatch(t, /\b(ADVANCED|MODERATE|PRELIMINARY)\s+report\b/i);
  if (levelRaw) testLevel = levelRaw.toUpperCase() as ParsedFlahaSoilReport["testLevel"];

  const sampleId =
    firstMatch(t, /SAMPLE\s*ID[\s\S]{0,40}?([a-z0-9]{20,})/i) ||
    firstMatch(t, /Sample:\s*([a-z0-9]{20,})/i);

  const locationName =
    firstMatch(t, /COORDINATES\s+LOCATION[\s\S]{0,20}?[—\-]\s*([^\n]+)/i) ||
    firstMatch(t, /LOCATION[\s\n]+[—\-]?\s*([A-Za-z0-9][^\n]{2,60})/i);

  const overallSummary = firstMatch(t, /Executive summary\s*\n([^\n]+)/i);
  const textureClass =
    firstMatch(t, /USDA texture class:\s*([^\n.]+)/i) ||
    firstMatch(t, /USDA texture class\s+[—\-]\s+([A-Za-z ]+)/i);

  // Sand / silt / clay  60 / 25 / 15
  const textureFrac = t.match(/Sand\s*\/\s*silt\s*\/\s*clay\s*%?\s*([\d.]+)\s*\/\s*([\d.]+)\s*\/\s*([\d.]+)/i);
  if (textureFrac) {
    values.sandPercent = num(textureFrac[1]) ?? undefined;
    values.siltPercent = num(textureFrac[2]) ?? undefined;
    values.clayPercent = num(textureFrac[3]) ?? undefined;
  }

  const om = t.match(/Organic matter\s*%?\s*([\d.]+)/i);
  if (om) values.organicMatterPercent = num(om[1]) ?? undefined;

  const ph = t.match(/pH\s*(?:\([^)]*\))?\s*[—\-]?\s*([\d.]+)/i) || t.match(/pH\s*\([^)]*\)\s*[—\-]?\s*([\d.]+)/i);
  // Prefer chemical table line "pH (H2O)" style
  const phTable = t.match(/pH[^\n]{0,20}?([\d]+\.[\d]+)/i);
  if (phTable) values.pH = num(phTable[1]) ?? undefined;
  else if (ph) values.pH = num(ph[1]) ?? undefined;

  const ece =
    t.match(/Electrical conductivity\s*\(ECe\)\s*dS\/m\s*([\d.]+)/i) ||
    t.match(/ECe\s*\(Salinity\)\s*([\d.]+)\s*dS\/m/i) ||
    t.match(/\bECe\b[^\d]{0,20}([\d.]+)\s*dS\/m/i);
  if (ece) values.ecDsM = num(ece[1]) ?? undefined;

  const cec = t.match(/\bCEC\b\s*cmol\(\+\)\/kg\s*([\d.]+)/i) || t.match(/\bCEC\b[^\d]{0,15}([\d.]+)/i);
  if (cec) values.cec = num(cec[1]) ?? undefined;

  const sar =
    t.match(/SAR\s*\/\s*ESP[^\d]{0,10}([\d.]+)\s*\/\s*([\d.]+)/i) ||
    t.match(/\bSAR\b\s*([\d.]+)/i);
  if (sar) {
    values.sar = num(sar[1]) ?? undefined;
    if (sar[2]) values.esp = num(sar[2]) ?? undefined;
  }
  const espLine = t.match(/\bESP\b[^\d]{0,10}([\d.]+)\s*%/i);
  if (espLine && values.esp == null) values.esp = num(espLine[1]) ?? undefined;

  const fc = t.match(/Field capacity[^\d]{0,30}([\d.]+)/i);
  if (fc) values.fieldCapacity = num(fc[1]) ?? undefined;
  const wp = t.match(/Wilting point[^\d]{0,30}([\d.]+)/i);
  if (wp) values.wiltingPoint = num(wp[1]) ?? undefined;
  const paw = t.match(/Plant-available water[^\d]{0,30}([\d.]+)/i);
  if (paw) values.plantAvailableWater = num(paw[1]) ?? undefined;
  const bd = t.match(/Bulk density[^\d]{0,20}([\d.]+)/i);
  if (bd) values.bulkDensity = num(bd[1]) ?? undefined;

  const n = t.match(/Nitrogen\s*\(N\)\s*mg\/kg\s*([\d.]+)/i);
  if (n) values.n = num(n[1]) ?? undefined;
  const p = t.match(/Phosphorus\s*\(P\)\s*mg\/kg\s*([\d.]+)/i);
  if (p) values.p = num(p[1]) ?? undefined;

  const ca = t.match(/Exchangeable Ca\s*cmol\(\+\)\/kg\s*([\d.]+)/i);
  if (ca) values.ca = num(ca[1]) ?? undefined;
  const mg = t.match(/Exchangeable Mg\s*cmol\(\+\)\/kg\s*([\d.]+)/i);
  if (mg) values.mg = num(mg[1]) ?? undefined;
  const k = t.match(/Exchangeable K\s*cmol\(\+\)\/kg\s*([\d.]+)/i);
  if (k) values.k = num(k[1]) ?? undefined;
  const na = t.match(/Exchangeable Na\s*cmol\(\+\)\/kg\s*([\d.]+)/i);
  if (na) values.na = num(na[1]) ?? undefined;

  if (!reportNumber) notes.push("reportNumber not found");
  if (!testLevel) notes.push("testLevel not found");
  if (Object.keys(values).length === 0) notes.push("no numeric parameters extracted");

  return {
    reportNumber,
    reportDate,
    testLevel,
    sampleId,
    locationName,
    overallSummary,
    textureClass: textureClass?.trim() || null,
    values,
    rawTextLength: t.length,
    parseNotes: notes,
  };
}

/** JSON report envelope (future FlahaSOIL API shape — loose adapter). */
export function parseFlahaSoilReportJson(body: unknown): ParsedFlahaSoilReport {
  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const chem = (o.chemistryInput || o.chemistry || o.values || {}) as Record<string, unknown>;
  const tex = (o.textureInput || o.texture || {}) as Record<string, unknown>;
  const meta = (o.meta || o.control || o) as Record<string, unknown>;

  const levelRaw = String(meta.testLevel || o.testLevel || "").toUpperCase();
  const testLevel =
    levelRaw === "PRELIMINARY" || levelRaw === "MODERATE" || levelRaw === "ADVANCED"
      ? levelRaw
      : null;

  const values: ParsedFlahaSoilReport["values"] = {};
  const map: Array<[keyof ParsedFlahaSoilReport["values"], unknown]> = [
    ["pH", chem.pH ?? chem.ph],
    ["ecDsM", chem.ecDsM ?? chem.ECe ?? chem.ec],
    ["organicMatterPercent", tex.organicMatterPercent ?? chem.organicMatterPercent],
    ["sar", chem.sar],
    ["esp", chem.esp],
    ["cec", chem.cec],
    ["sandPercent", tex.sandPercent],
    ["siltPercent", tex.siltPercent],
    ["clayPercent", tex.clayPercent],
    ["n", chem.n],
    ["p", chem.p],
    ["ca", chem.ca],
    ["mg", chem.mg],
    ["k", chem.k],
    ["na", chem.na],
  ];
  for (const [k, v] of map) {
    if (typeof v === "number" && Number.isFinite(v)) values[k] = v;
    else if (typeof v === "string" && num(v) != null) values[k] = num(v)!;
  }

  return {
    reportNumber: meta.reportNumber != null ? String(meta.reportNumber) : o.reportNumber != null ? String(o.reportNumber) : null,
    reportDate: meta.reportDate != null ? String(meta.reportDate) : null,
    testLevel,
    sampleId: meta.sampleId != null ? String(meta.sampleId) : o.sampleId != null ? String(o.sampleId) : null,
    locationName: meta.locationName != null ? String(meta.locationName) : null,
    overallSummary: o.executiveSummary != null ? String(o.executiveSummary) : null,
    textureClass: o.textureClass != null ? String(o.textureClass) : null,
    values,
    rawTextLength: 0,
    parseNotes: ["parsed from JSON envelope"],
  };
}
