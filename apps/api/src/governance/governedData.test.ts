import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGovernedSeedPlan, buildSourceBackfillPlan, loadRegistry } from "./governedData.js";

const taxonomyDirectory = fileURLToPath(new URL("../../../../docs/taxonomy/", import.meta.url));
const registryPath = fileURLToPath(new URL("../../../../docs/rss-source-registry.json", import.meta.url));

describe("governed data planning", () => {
  it("builds the approved taxonomy and organization-type seed counts", async () => {
    const plan = await buildGovernedSeedPlan(taxonomyDirectory);
    expect(plan.classificationTerms).toHaveLength(186);
    expect(plan.organizationTypes).toHaveLength(20);
    expect(plan.classificationTerms.every((term) => term.code === term.code.toUpperCase())).toBe(true);
  });

  it("maps legacy media authority and preserves NASA JPL governance", async () => {
    const registry = await loadRegistry(registryPath);
    const mapped = (registry.sources ?? []).filter((source) => source.databaseSourceId !== null).map((source) => ({
      id: String(source.databaseSourceId),
      url: String(source.officialFeedUrl),
      enabled: source.id !== "nasa-jpl-news-existing",
    }));
    const plan = buildSourceBackfillPlan(registry, mapped);
    expect(plan).toHaveLength(8);
    expect(plan.find((source) => source.registryId === "al-jazeera-english-all")?.authorityType).toBe("COMMERCIAL_MEDIA");
    expect(plan.find((source) => source.registryId === "nasa-jpl-news-existing")?.verificationStatus).toBe("REJECTED");
  });

  it("refuses the complete source backfill on a URL mismatch", async () => {
    const registry = await loadRegistry(registryPath);
    const mapped = (registry.sources ?? []).filter((source) => source.databaseSourceId !== null).map((source) => ({
      id: String(source.databaseSourceId),
      url: String(source.officialFeedUrl),
      enabled: source.id !== "nasa-jpl-news-existing",
    }));
    mapped[0] = { ...mapped[0], url: "https://example.invalid/mismatch.xml" };
    expect(() => buildSourceBackfillPlan(registry, mapped)).toThrow(/does not equal official URL/);
  });
});
