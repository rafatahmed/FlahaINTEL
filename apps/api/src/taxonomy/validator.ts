import { readFile } from "node:fs/promises";
import path from "node:path";

export const taxonomyFiles = {
  "general-domains.json": "GENERAL_DOMAIN",
  "general-event-types.json": "GENERAL_EVENT_TYPE",
  "sectors.json": "SECTOR",
  "agriculture-domains.json": "AGRICULTURE_DOMAIN",
  "product-categories.json": "PRODUCT_CATEGORY",
  "technology-categories.json": "TECHNOLOGY_CATEGORY",
  "market-categories.json": "MARKET_CATEGORY",
  "impact-types.json": "IMPACT_TYPE",
  "relevance-targets.json": "RELEVANCE_TARGET",
  "geographic-scopes.json": "GEOGRAPHIC_SCOPE",
  "organization-types.json": "ORGANIZATION_TYPE",
} as const;

export type TaxonomyType = (typeof taxonomyFiles)[keyof typeof taxonomyFiles];

export interface TaxonomyTerm {
  code: string;
  label: string;
  definition: string;
  inclusionBoundary: string;
  parentCode: string | null;
  standardCode: string | null;
  aliases: string[];
  active: boolean;
  assignable: boolean;
  entityEligibility?: "CLASSIFICATION_ONLY" | "COMMERCIAL_PRODUCT";
  sortOrder: number;
}

export interface TaxonomyDocument {
  schemaVersion: number;
  taxonomyType: TaxonomyType;
  intelligenceLayer: "CONTEXTUAL" | "BRIDGE" | "AGRICULTURAL_IMPACT" | "SHARED";
  title: string;
  description: string;
  governanceNotes?: string[];
  terms: TaxonomyTerm[];
}

export interface NamedTaxonomyDocument {
  fileName: string;
  document: unknown;
}

const codePattern = /^[A-Z][A-Z0-9_]*$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateTermShape(
  fileName: string,
  taxonomyType: TaxonomyType,
  value: unknown,
  index: number,
  errors: string[],
): value is TaxonomyTerm {
  const at = `${fileName}: terms[${index}]`;
  if (!isObject(value)) {
    errors.push(`${at} must be an object.`);
    return false;
  }
  const priorErrorCount = errors.length;
  if (!nonBlank(value.code) || !codePattern.test(value.code)) errors.push(`${at}.code must be a stable uppercase code.`);
  if (!nonBlank(value.label)) errors.push(`${at}.label must be non-blank.`);
  if (!nonBlank(value.definition)) errors.push(`${at}.definition must be non-blank.`);
  if (!nonBlank(value.inclusionBoundary)) errors.push(`${at}.inclusionBoundary must be non-blank.`);
  if (value.parentCode !== null && (!nonBlank(value.parentCode) || !codePattern.test(value.parentCode))) {
    errors.push(`${at}.parentCode must be null or an uppercase code.`);
  }
  if (value.standardCode !== null && !nonBlank(value.standardCode)) errors.push(`${at}.standardCode must be null or non-blank.`);
  if (!Array.isArray(value.aliases) || value.aliases.some((alias) => !nonBlank(alias))) {
    errors.push(`${at}.aliases must contain only non-blank strings.`);
  }
  if (typeof value.active !== "boolean") errors.push(`${at}.active must be boolean.`);
  if (typeof value.assignable !== "boolean") errors.push(`${at}.assignable must be boolean.`);
  if (taxonomyType === "PRODUCT_CATEGORY") {
    if (!["CLASSIFICATION_ONLY", "COMMERCIAL_PRODUCT"].includes(String(value.entityEligibility))) {
      errors.push(`${at}.entityEligibility must be CLASSIFICATION_ONLY or COMMERCIAL_PRODUCT.`);
    }
  } else if (value.entityEligibility !== undefined) {
    errors.push(`${at}.entityEligibility is allowed only for PRODUCT_CATEGORY terms.`);
  }
  if (!Number.isInteger(value.sortOrder) || Number(value.sortOrder) < 0) errors.push(`${at}.sortOrder must be a non-negative integer.`);
  return errors.length === priorErrorCount;
}

function validateHierarchy(fileName: string, terms: TaxonomyTerm[], errors: string[]) {
  const byCode = new Map(terms.map((term) => [term.code, term]));
  const parentCodes = new Set(terms.flatMap((term) => term.parentCode ? [term.parentCode] : []));
  for (const term of terms) {
    if (term.parentCode && !byCode.has(term.parentCode)) {
      errors.push(`${fileName}: ${term.code} references missing parent ${term.parentCode}.`);
    }
    if (term.parentCode === term.code) errors.push(`${fileName}: ${term.code} cannot be its own parent.`);
    if (!term.assignable && !parentCodes.has(term.code)) {
      errors.push(`${fileName}: non-assignable term ${term.code} must be a grouping parent.`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (code: string, trail: string[]) => {
    if (visiting.has(code)) {
      errors.push(`${fileName}: hierarchy cycle detected: ${[...trail, code].join(" -> ")}.`);
      return;
    }
    if (visited.has(code)) return;
    visiting.add(code);
    const parent = byCode.get(code)?.parentCode;
    if (parent && byCode.has(parent)) visit(parent, [...trail, code]);
    visiting.delete(code);
    visited.add(code);
  };
  for (const code of byCode.keys()) visit(code, []);
}

export function validateTaxonomies(inputs: NamedTaxonomyDocument[]): string[] {
  const errors: string[] = [];
  const byFile = new Map(inputs.map((input) => [input.fileName, input.document]));

  for (const [fileName, expectedType] of Object.entries(taxonomyFiles)) {
    const value = byFile.get(fileName);
    if (!value) {
      errors.push(`${fileName}: required taxonomy file is missing.`);
      continue;
    }
    if (!isObject(value)) {
      errors.push(`${fileName}: document must be an object.`);
      continue;
    }
    if (value.schemaVersion !== 1) errors.push(`${fileName}: schemaVersion must be 1.`);
    if (value.taxonomyType !== expectedType) errors.push(`${fileName}: taxonomyType must be ${expectedType}.`);
    if (!["CONTEXTUAL", "BRIDGE", "AGRICULTURAL_IMPACT", "SHARED"].includes(String(value.intelligenceLayer))) {
      errors.push(`${fileName}: intelligenceLayer is invalid.`);
    }
    if (!nonBlank(value.title)) errors.push(`${fileName}: title must be non-blank.`);
    if (!nonBlank(value.description)) errors.push(`${fileName}: description must be non-blank.`);
    if (value.governanceNotes !== undefined
      && (!Array.isArray(value.governanceNotes) || value.governanceNotes.some((note) => !nonBlank(note)))) {
      errors.push(`${fileName}: governanceNotes must contain only non-blank strings.`);
    }
    if (!Array.isArray(value.terms) || value.terms.length === 0) {
      errors.push(`${fileName}: terms must be a non-empty array.`);
      continue;
    }

    const shapedTerms = value.terms.filter((term, index) => validateTermShape(
      fileName,
      expectedType,
      term,
      index,
      errors,
    ));
    if (shapedTerms.length !== value.terms.length) continue;
    const terms = shapedTerms as TaxonomyTerm[];
    const codes = new Set<string>();
    const aliases = new Map<string, string>();
    for (const term of terms) {
      if (codes.has(term.code)) errors.push(`${fileName}: duplicate code ${term.code}.`);
      codes.add(term.code);
      for (const alias of term.aliases) {
        const normalized = alias.trim().toLocaleLowerCase("en");
        const prior = aliases.get(normalized);
        if (prior) errors.push(`${fileName}: duplicate alias "${alias}" on ${prior} and ${term.code}.`);
        else aliases.set(normalized, term.code);
      }
    }
    validateHierarchy(fileName, terms, errors);
  }

  for (const input of inputs) {
    if (!(input.fileName in taxonomyFiles)) errors.push(`${input.fileName}: unexpected taxonomy file.`);
  }
  return errors;
}

export async function loadTaxonomies(directory: string): Promise<NamedTaxonomyDocument[]> {
  return Promise.all(Object.keys(taxonomyFiles).map(async (fileName) => ({
    fileName,
    document: JSON.parse(await readFile(path.join(directory, fileName), "utf8")) as unknown,
  })));
}
