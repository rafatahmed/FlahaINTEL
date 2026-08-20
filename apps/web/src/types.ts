export const CLASSIFICATION_TYPES = [
  "GENERAL_DOMAIN", "GENERAL_EVENT_TYPE", "SECTOR", "AGRICULTURE_DOMAIN",
  "PRODUCT_CATEGORY", "TECHNOLOGY_CATEGORY", "MARKET_CATEGORY", "IMPACT_TYPE",
  "RELEVANCE_TARGET", "GEOGRAPHIC_SCOPE",
] as const;

export type ClassificationType = typeof CLASSIFICATION_TYPES[number];
export type AssignmentProvenance = "MANUAL" | "RULE_BASED" | "IMPORTED";
export type OrganizationProductRole =
  | "MANUFACTURER" | "BRAND_OWNER" | "DEVELOPER" | "DISTRIBUTOR"
  | "SUPPLIER" | "IMPORTER";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClassificationTerm {
  id: string;
  type: ClassificationType;
  code: string;
  label: string;
  description: string;
  parentId: string | null;
  parentCode?: string | null;
  standardCode: string | null;
  aliases: string[];
  assignable: boolean;
  active: boolean;
  sortOrder: number;
  entityEligibility: "CLASSIFICATION_ONLY" | "COMMERCIAL_PRODUCT" | null;
}

export interface OrganizationType {
  id: string;
  code: string;
  label: string;
  description: string;
  active: boolean;
  sortOrder: number;
}

export interface ClassificationAssignment {
  termId: string;
  provenance: AssignmentProvenance;
  provenanceRef: string | null;
  confidence: number | null;
  assignedAt: string;
  term: ClassificationTerm;
}

export interface SourceSummary { id: string; name: string }

export interface Article {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  collectedAt: string;
  sourceId: string;
  source: SourceSummary;
}

export interface ArticleOrganizationLink {
  organizationId: string;
  canonicalName: string;
  normalizedName: string;
  active: boolean;
  linkedAt: string;
  type: Pick<OrganizationType, "id" | "code" | "label">;
}

export interface ArticleProductLink {
  productId: string;
  code: string;
  name: string;
  active: boolean;
  linkedAt: string;
  category: Pick<ClassificationTerm, "id" | "code" | "label">;
}

export interface ArticleRelationships {
  organizations: ArticleOrganizationLink[];
  products: ArticleProductLink[];
}

export interface CollectionRun {
  id: string;
  status: "SUCCESS" | "FAILURE";
  startedAt: string;
  finishedAt: string;
  itemsFound: number;
  itemsAdded: number;
  error: string | null;
}

export interface RssSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  registryId: string | null;
  publisher: string | null;
  category: string | null;
  region: string | null;
  language: string | null;
  authorityType: string | null;
  verificationStatus: string | null;
  homepageUrl: string | null;
  evidenceUrl: string | null;
  ownershipVerified: boolean;
  lastCollectedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  collectionRuns: CollectionRun[];
  isCollecting: boolean;
}

export interface OrganizationProductLink {
  organizationId: string;
  productId: string;
  role: OrganizationProductRole;
  createdAt: string;
  product?: Product;
  organization?: Organization;
}

export interface Organization {
  id: string;
  typeId: string;
  canonicalName: string;
  normalizedName: string;
  homepageUrl: string | null;
  countryCode: string | null;
  region: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  type: OrganizationType;
  products?: OrganizationProductLink[];
}

export interface Product {
  id: string;
  code: string;
  name: string;
  categoryTermId: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  category: ClassificationTerm;
  organizations?: OrganizationProductLink[];
}

export interface EventEvidence {
  eventId: string;
  articleId: string;
  addedAt: string;
  article: Pick<Article, "id" | "title" | "url" | "publishedAt" | "sourceId">;
}

export interface IntelligenceEvent {
  id: string;
  primaryEventTypeTermId: string;
  title: string;
  summary: string | null;
  startsAt: string | null;
  endsAt: string | null;
  observedAt: string | null;
  locationName: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  primaryEventType: ClassificationTerm;
  classifications?: ClassificationAssignment[];
  evidence?: EventEvidence[];
}

export interface ArticleFilters {
  q?: string;
  sourceId?: string;
  classificationType?: ClassificationType;
  termId?: string;
  page?: number;
  limit?: number;
}

export interface EntityFilters {
  q?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

export interface EventFilters extends EntityFilters {
  primaryEventTypeTermId?: string;
  termId?: string;
  classificationType?: ClassificationType;
  geographicTermId?: string;
  startsAtFrom?: string;
  startsAtTo?: string;
}

export type ArticlePage = Page<Article>;

export interface SchedulerStatus {
  enabled: boolean;
  started: boolean;
  stopping: boolean;
  running: boolean;
  intervalMinutes: number;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  activeSourceIds: string[];
}

export type GovernanceReviewState =
  | "PENDING_EVALUATION"
  | "READY_FOR_REVIEW"
  | "NEEDS_CORRECTION"
  | "ON_HOLD"
  | "APPROVED"
  | "REJECTED"
  | "PROMOTION_ELIGIBLE"
  | "PROMOTED"
  | "WITHDRAWN";

export interface GovernanceCandidate {
  id: string;
  tenantId: string;
  normalizedArtifactId: string;
  normalizedContentHash: string;
  sourceId: string | null;
  contentType: string;
  language: string;
  normalizationProfile: string;
  normalizationVersion: string;
  evidenceCompleteness: "COMPLETE" | "PARTIAL" | "INSUFFICIENT" | "CONFLICTING";
  reviewState: GovernanceReviewState;
  promotionState: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  assignedReviewerId: string | null;
  candidateVersion: number;
  currentDecisionVersion: number;
  version: number;
  titlePreview: string | null;
  documentTitle: string | null;
  warningSummary: string[] | unknown;
  qualityIndicators: string[] | unknown;
  createdAt: string;
  updatedAt: string;
  source?: { id: string; name: string; url: string; enabled: boolean } | null;
}

export interface GovernanceDecision {
  id: string;
  candidateId: string;
  previousState: GovernanceReviewState | null;
  newState: GovernanceReviewState;
  action: string;
  actorId: string;
  reasonCode: string;
  note: string | null;
  reviewedContentHash: string;
  candidateVersion: number;
  decisionSequence: number;
  correlationId: string;
  createdAt: string;
  actor?: { id: string; displayName: string; email: string };
}

export interface GovernanceEvidence {
  candidateId: string;
  lineage: {
    acquisitionJobId: string | null;
    extractionJobId: string | null;
    normalizationJobId: string;
    normalizedArtifactId: string;
    normalizedContentHash: string;
    harvestedAt?: string | null;
    submittedAt?: string | null;
  };
  artifact: {
    artifactId: string;
    state: string;
    checksum: string | null;
    finalKey: string | null;
    byteLength: number | null;
  } | null;
  evidenceCompleteness: string;
  evidenceReasons: unknown;
  checks: unknown;
  warnings: unknown;
  qualityIndicators: unknown;
  sourcePolicy: {
    id: string;
    sourceId: string;
    sourceStatus: string;
    allowedContentTypes: string[];
    allowedLanguages: string[];
    trustTier: string;
    version: number;
  } | null;
}

export interface GovernancePreview {
  candidateId: string;
  documentTitle: string | null;
  language: string | null;
  contentType: string;
  plainTextPreview: string;
  truncated: boolean;
  authors: string[];
  publicationDate: string | null;
  publisher?: string | null;
  canonicalSourceLocator?: string | null;
  finalAcquiredLocator?: string | null;
  contentHash: string;
  previewUnavailable?: boolean;
}

export interface GovernanceAuthContext {
  userId: string;
  tenantId: string;
}
