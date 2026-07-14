import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ClassificationType,
  ProductEntityEligibility,
  SourceAuthorityType,
  SourceVerificationStatus,
} from "@prisma/client";
import {
  loadTaxonomies,
  taxonomyFiles,
  type TaxonomyDocument,
  type TaxonomyTerm,
  validateTaxonomies,
} from "../taxonomy/validator.js";

const classificationTypeByTaxonomy = {
  GENERAL_DOMAIN: "GENERAL_DOMAIN",
  GENERAL_EVENT_TYPE: "GENERAL_EVENT_TYPE",
  SECTOR: "SECTOR",
  AGRICULTURE_DOMAIN: "AGRICULTURE_DOMAIN",
  PRODUCT_CATEGORY: "PRODUCT_CATEGORY",
  TECHNOLOGY_CATEGORY: "TECHNOLOGY_CATEGORY",
  MARKET_CATEGORY: "MARKET_CATEGORY",
  IMPACT_TYPE: "IMPACT_TYPE",
  RELEVANCE_TARGET: "RELEVANCE_TARGET",
  GEOGRAPHIC_SCOPE: "GEOGRAPHIC_SCOPE",
} as const satisfies Record<string, ClassificationType>;

const sourceAuthorityTypes = new Set<SourceAuthorityType>([
  "INTERGOVERNMENTAL_ORGANIZATION",
  "GOVERNMENT_AGENCY",
  "REGULATORY_AUTHORITY",
  "PUBLIC_SERVICE_MEDIA",
  "COMMERCIAL_MEDIA",
  "RESEARCH_INSTITUTION",
  "UNIVERSITY",
  "NON_GOVERNMENTAL_ORGANIZATION",
  "INDUSTRY_ASSOCIATION",
  "COMMERCIAL_ORGANIZATION",
  "DATA_PROVIDER",
  "OTHER",
]);

const sourceVerificationStatuses = new Set<SourceVerificationStatus>([
  "PENDING",
  "ACCEPTED",
  "DEGRADED",
  "REJECTED",
]);

export interface ClassificationSeedTerm {
  type: ClassificationType;
  code: string;
  label: string;
  description: string;
  parentCode: string | null;
  standardCode: string | null;
  aliases: string[];
  assignable: boolean;
  active: boolean;
  sortOrder: number;
  entityEligibility: ProductEntityEligibility | null;
}

export interface OrganizationTypeSeedTerm {
  code: string;
  label: string;
  description: string;
  active: boolean;
  sortOrder: number;
}

export interface GovernedSeedPlan {
  classificationTerms: ClassificationSeedTerm[];
  organizationTypes: OrganizationTypeSeedTerm[];
}

function toClassificationSeedTerm(document: TaxonomyDocument, term: TaxonomyTerm): ClassificationSeedTerm {
  const type = classificationTypeByTaxonomy[
    document.taxonomyType as keyof typeof classificationTypeByTaxonomy
  ];
  return {
    type,
    code: term.code,
    label: term.label,
    description: term.definition,
    parentCode: term.parentCode,
    standardCode: term.standardCode,
    aliases: term.aliases,
    assignable: term.assignable,
    active: term.active,
    sortOrder: term.sortOrder,
    entityEligibility: term.entityEligibility ?? null,
  };
}

export async function buildGovernedSeedPlan(taxonomyDirectory: string): Promise<GovernedSeedPlan> {
  const inputs = await loadTaxonomies(taxonomyDirectory);
  const errors = validateTaxonomies(inputs);
  if (errors.length > 0) throw new Error(`Taxonomy validation failed:\n${errors.join("\n")}`);

  const documents = new Map(inputs.map((input) => [
    input.fileName,
    input.document as TaxonomyDocument,
  ]));
  const classificationTerms: ClassificationSeedTerm[] = [];
  const organizationTypes: OrganizationTypeSeedTerm[] = [];

  for (const [fileName, taxonomyType] of Object.entries(taxonomyFiles)) {
    const document = documents.get(fileName);
    if (!document) throw new Error(`Validated taxonomy ${fileName} is unexpectedly missing.`);
    if (taxonomyType === "ORGANIZATION_TYPE") {
      organizationTypes.push(...document.terms.map((term) => ({
        code: term.code,
        label: term.label,
        description: term.definition,
        active: term.active,
        sortOrder: term.sortOrder,
      })));
    } else {
      classificationTerms.push(...document.terms.map((term) => toClassificationSeedTerm(document, term)));
    }
  }

  if (classificationTerms.length !== 186) {
    throw new Error(`Expected 186 classification terms, found ${classificationTerms.length}.`);
  }
  if (organizationTypes.length !== 20) {
    throw new Error(`Expected 20 organization types, found ${organizationTypes.length}.`);
  }
  return { classificationTerms, organizationTypes };
}

interface RegistrySource {
  id: unknown;
  publisher: unknown;
  officialFeedUrl: unknown;
  publisherHomepage: unknown;
  officialEvidenceUrl: unknown;
  category: unknown;
  region: unknown;
  language: unknown;
  authorityType: unknown;
  verificationStatus: unknown;
  ownershipVerified: unknown;
  databaseSourceId: unknown;
}

interface RegistryDocument {
  sources?: RegistrySource[];
}

export interface StoredSourceIdentity {
  id: string;
  url: string;
  enabled: boolean;
}

export interface SourceMetadataUpdate {
  databaseSourceId: string;
  registryId: string;
  publisher: string;
  category: string;
  region: string;
  language: string;
  authorityType: SourceAuthorityType;
  verificationStatus: SourceVerificationStatus;
  homepageUrl: string;
  evidenceUrl: string;
  ownershipVerified: boolean;
}

function requiredString(value: unknown, field: string, registryId: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${registryId}: ${field} must be a non-blank string.`);
  }
  return value;
}

function mapAuthorityType(value: unknown, registryId: string): SourceAuthorityType {
  const mapped = value === "MEDIA_ORGANIZATION" ? "COMMERCIAL_MEDIA" : value;
  if (typeof mapped !== "string" || !sourceAuthorityTypes.has(mapped as SourceAuthorityType)) {
    throw new Error(`${registryId}: unsupported authorityType ${String(value)}.`);
  }
  return mapped as SourceAuthorityType;
}

export function buildSourceBackfillPlan(
  registry: RegistryDocument,
  storedSources: StoredSourceIdentity[],
): SourceMetadataUpdate[] {
  if (!Array.isArray(registry.sources)) throw new Error("Registry sources must be an array.");
  const candidates = registry.sources.filter((source) => source.databaseSourceId !== null);
  const byDatabaseId = new Map<string, RegistrySource>();
  const registryIds = new Set<string>();

  for (const candidate of candidates) {
    const registryId = requiredString(candidate.id, "id", "registry source");
    const databaseSourceId = requiredString(candidate.databaseSourceId, "databaseSourceId", registryId);
    if (registryIds.has(registryId)) throw new Error(`Duplicate registry id ${registryId}.`);
    if (byDatabaseId.has(databaseSourceId)) throw new Error(`Duplicate databaseSourceId ${databaseSourceId}.`);
    registryIds.add(registryId);
    byDatabaseId.set(databaseSourceId, candidate);
  }

  if (candidates.length !== storedSources.length) {
    throw new Error(`Registry/database source coverage mismatch: ${candidates.length} mapped registry records for ${storedSources.length} stored sources.`);
  }

  const updates = storedSources.map((stored) => {
    const candidate = byDatabaseId.get(stored.id);
    if (!candidate) throw new Error(`Stored source ${stored.id} has no registry record.`);
    const registryId = requiredString(candidate.id, "id", "registry source");
    const officialFeedUrl = requiredString(candidate.officialFeedUrl, "officialFeedUrl", registryId);
    if (stored.url !== officialFeedUrl) {
      throw new Error(`${registryId}: stored URL ${stored.url} does not equal official URL ${officialFeedUrl}.`);
    }
    const verificationStatus = requiredString(
      candidate.verificationStatus,
      "verificationStatus",
      registryId,
    );
    if (!sourceVerificationStatuses.has(verificationStatus as SourceVerificationStatus)) {
      throw new Error(`${registryId}: unsupported verificationStatus ${verificationStatus}.`);
    }
    if (typeof candidate.ownershipVerified !== "boolean") {
      throw new Error(`${registryId}: ownershipVerified must be boolean.`);
    }
    if (registryId === "nasa-jpl-news-existing") {
      if (stored.enabled) throw new Error("NASA JPL must remain disabled before metadata backfill.");
      if (verificationStatus !== "REJECTED") throw new Error("NASA JPL must retain REJECTED verification status.");
    }
    return {
      databaseSourceId: stored.id,
      registryId,
      publisher: requiredString(candidate.publisher, "publisher", registryId),
      category: requiredString(candidate.category, "category", registryId),
      region: requiredString(candidate.region, "region", registryId),
      language: requiredString(candidate.language, "language", registryId),
      authorityType: mapAuthorityType(candidate.authorityType, registryId),
      verificationStatus: verificationStatus as SourceVerificationStatus,
      homepageUrl: requiredString(candidate.publisherHomepage, "publisherHomepage", registryId),
      evidenceUrl: requiredString(candidate.officialEvidenceUrl, "officialEvidenceUrl", registryId),
      ownershipVerified: candidate.ownershipVerified,
    };
  });

  return updates.sort((a, b) => a.registryId.localeCompare(b.registryId));
}

export async function loadRegistry(registryPath: string): Promise<RegistryDocument> {
  return JSON.parse(await readFile(path.resolve(registryPath), "utf8")) as RegistryDocument;
}
