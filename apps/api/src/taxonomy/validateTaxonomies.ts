import { fileURLToPath } from "node:url";
import { loadTaxonomies, validateTaxonomies } from "./validator.js";

const taxonomyDirectory = fileURLToPath(new URL("../../../../docs/taxonomy/", import.meta.url));
const inputs = await loadTaxonomies(taxonomyDirectory);
const errors = validateTaxonomies(inputs);

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  const total = inputs.reduce((sum, input) => {
    const document = input.document as { terms: unknown[] };
    return sum + document.terms.length;
  }, 0);
  console.log(`Validated ${inputs.length} taxonomy files containing ${total} terms.`);
}
