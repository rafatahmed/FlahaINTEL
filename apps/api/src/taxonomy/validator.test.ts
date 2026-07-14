import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadTaxonomies, type NamedTaxonomyDocument, validateTaxonomies } from "./validator.js";

const taxonomyDirectory = fileURLToPath(new URL("../../../../docs/taxonomy/", import.meta.url));
type MutableDocument = Record<string, unknown> & { terms: Array<Record<string, unknown>> };

function validInputs(): Promise<NamedTaxonomyDocument[]> {
  return loadTaxonomies(taxonomyDirectory);
}

function documentAt(inputs: NamedTaxonomyDocument[], index: number): MutableDocument {
  return inputs[index].document as MutableDocument;
}

function includesError(inputs: NamedTaxonomyDocument[], fragment: string): boolean {
  return validateTaxonomies(inputs).some((error) => error.includes(fragment));
}

describe("taxonomy validation", () => {
  it("validates the governed repository taxonomies", async () => {
    expect(validateTaxonomies(await validInputs())).toEqual([]);
  });

  it("detects a missing required file", async () => {
    const inputs = await validInputs();
    inputs.splice(0, 1);
    expect(includesError(inputs, "required taxonomy file is missing")).toBe(true);
  });

  it("detects an unexpected file", async () => {
    const inputs = await validInputs();
    inputs.push({ fileName: "unexpected.json", document: {} });
    expect(includesError(inputs, "unexpected taxonomy file")).toBe(true);
  });

  it("detects a wrong taxonomy type", async () => {
    const inputs = await validInputs();
    documentAt(inputs, 0).taxonomyType = "SECTOR";
    expect(includesError(inputs, "taxonomyType must be GENERAL_DOMAIN")).toBe(true);
  });

  it("validates the document envelope", async () => {
    const inputs = await validInputs();
    const document = documentAt(inputs, 0);
    document.schemaVersion = 2;
    document.intelligenceLayer = "UNKNOWN";
    document.title = "";
    document.description = "";
    document.governanceNotes = [""];
    const errors = validateTaxonomies(inputs);
    expect(errors.some((error) => error.includes("schemaVersion"))).toBe(true);
    expect(errors.some((error) => error.includes("intelligenceLayer"))).toBe(true);
    expect(errors.some((error) => error.includes("title"))).toBe(true);
    expect(errors.some((error) => error.includes("description"))).toBe(true);
    expect(errors.some((error) => error.includes("governanceNotes"))).toBe(true);
  });

  it("requires a non-empty term array", async () => {
    const inputs = await validInputs();
    documentAt(inputs, 0).terms = [];
    expect(includesError(inputs, "terms must be a non-empty array")).toBe(true);
  });

  it("requires term objects and non-blank labels", async () => {
    const inputs = await validInputs();
    const document = documentAt(inputs, 0);
    document.terms[0].label = "";
    document.terms[1] = "invalid" as unknown as Record<string, unknown>;
    const errors = validateTaxonomies(inputs);
    expect(errors.some((error) => error.includes("label"))).toBe(true);
    expect(errors.some((error) => error.includes("must be an object"))).toBe(true);
  });

  it("detects duplicate codes", async () => {
    const inputs = await validInputs();
    const terms = documentAt(inputs, 0).terms;
    terms[1].code = terms[0].code;
    expect(includesError(inputs, "duplicate code")).toBe(true);
  });

  it("detects case-insensitive duplicate aliases", async () => {
    const inputs = await validInputs();
    const terms = documentAt(inputs, 0).terms;
    terms[0].aliases = ["Shared alias"];
    terms[1].aliases = ["shared ALIAS"];
    expect(includesError(inputs, "duplicate alias")).toBe(true);
  });

  it("detects missing parents", async () => {
    const inputs = await validInputs();
    documentAt(inputs, 0).terms[0].parentCode = "MISSING_PARENT";
    expect(includesError(inputs, "missing parent")).toBe(true);
  });

  it("detects self-parenting", async () => {
    const inputs = await validInputs();
    const term = documentAt(inputs, 0).terms[0];
    term.parentCode = term.code;
    expect(includesError(inputs, "cannot be its own parent")).toBe(true);
  });

  it("detects multi-node hierarchy cycles", async () => {
    const inputs = await validInputs();
    const terms = documentAt(inputs, 1).terms;
    terms[0].parentCode = terms[1].code;
    terms[1].parentCode = terms[2].code;
    terms[2].parentCode = terms[0].code;
    expect(includesError(inputs, "hierarchy cycle")).toBe(true);
  });

  it("reports malformed aliases without crashing", async () => {
    const inputs = await validInputs();
    documentAt(inputs, 3).terms[0].aliases = "not-an-array";
    expect(includesError(inputs, "aliases")).toBe(true);
  });

  it("rejects invalid codes", async () => {
    const inputs = await validInputs();
    documentAt(inputs, 2).terms[0].code = "not-stable";
    expect(includesError(inputs, "stable uppercase code")).toBe(true);
  });

  it("requires definitions and inclusion boundaries", async () => {
    const inputs = await validInputs();
    const term = documentAt(inputs, 2).terms[0];
    term.definition = "";
    term.inclusionBoundary = "";
    const errors = validateTaxonomies(inputs);
    expect(errors.some((error) => error.includes("definition"))).toBe(true);
    expect(errors.some((error) => error.includes("inclusionBoundary"))).toBe(true);
  });

  it("validates parent codes, standard codes and active values", async () => {
    const inputs = await validInputs();
    const term = documentAt(inputs, 2).terms[0];
    term.parentCode = "invalid-parent";
    term.standardCode = "";
    term.active = "yes";
    const errors = validateTaxonomies(inputs);
    expect(errors.some((error) => error.includes("parentCode"))).toBe(true);
    expect(errors.some((error) => error.includes("standardCode"))).toBe(true);
    expect(errors.some((error) => error.includes("active"))).toBe(true);
  });

  it("rejects invalid sort order", async () => {
    const inputs = await validInputs();
    documentAt(inputs, 2).terms[0].sortOrder = -1;
    expect(includesError(inputs, "sortOrder")).toBe(true);
  });

  it("rejects invalid assignable values and non-assignable leaves", async () => {
    const inputs = await validInputs();
    documentAt(inputs, 2).terms[0].assignable = "yes";
    expect(includesError(inputs, "assignable must be boolean")).toBe(true);

    const leafInputs = await validInputs();
    documentAt(leafInputs, 2).terms[0].assignable = false;
    expect(includesError(leafInputs, "must be a grouping parent")).toBe(true);
  });

  it("validates product entity eligibility", async () => {
    const inputs = await validInputs();
    documentAt(inputs, 4).terms[0].entityEligibility = "INVALID";
    expect(includesError(inputs, "entityEligibility must be")).toBe(true);

    const absentInputs = await validInputs();
    delete documentAt(absentInputs, 4).terms[0].entityEligibility;
    expect(includesError(absentInputs, "entityEligibility must be")).toBe(true);

    const nonProductInputs = await validInputs();
    documentAt(nonProductInputs, 0).terms[0].entityEligibility = "CLASSIFICATION_ONLY";
    expect(includesError(nonProductInputs, "allowed only for PRODUCT_CATEGORY")).toBe(true);
  });
});
