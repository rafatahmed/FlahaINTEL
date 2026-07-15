/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Provider Framework Types
 * Introduction: Defines closed control-plane provider, request, result, policy, and evidence contracts.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

export type ProviderFamily = "DATASET_VALIDATION" | "HTML_EXTRACTION" | "DOCUMENT_PROCESSING" | "STATIC_ACQUISITION" | "BROWSER_ACQUISITION";
export type ProviderCapability =
  | "DATASET_SCHEMA_INSPECTION" | "DATASET_ROW_VALIDATION" | "DATASET_TYPE_VALIDATION" | "DATASET_TABULAR_FALLBACK"
  | "HTML_TEXT_EXTRACTION" | "HTML_LINK_EXTRACTION" | "HTML_METADATA_EXTRACTION" | "HTML_ENCODING_DETECTION" | "HTML_STRUCTURAL_EXTRACTION"
  | "DOCUMENT_INSPECTION" | "DOCUMENT_TEXT_EXTRACTION" | "DOCUMENT_METADATA_EXTRACTION" | "DOCUMENT_LAYOUT_EXTRACTION" | "DOCUMENT_SECTION_EXTRACTION" | "DOCUMENT_TABLE_EXTRACTION" | "DOCUMENT_ANNOTATION_INVENTORY" | "DOCUMENT_EMBEDDED_ARTIFACT_INVENTORY" | "DOCUMENT_DIGITAL_TEXT_ASSESSMENT" | "DOCUMENT_BROAD_FORMAT_FALLBACK"
  | "STATIC_HTTP_ACQUISITION" | "CONTROLLED_CRAWLING" | "LINK_DISCOVERY" | "ROBOTS_POLICY" | "REDIRECT_HANDLING" | "RETRY_HANDLING" | "RATE_LIMITING" | "RAW_RESPONSE_CAPTURE" | "JAVASCRIPT_RENDERING" | "RENDERED_DOM_CAPTURE" | "BROWSER_NETWORK_INTERCEPTION" | "DOWNLOAD_DETECTION" | "POPUP_CONTAINMENT";
export type RuntimeKind = "NODE" | "PYTHON" | "JAVA" | "BROWSER" | "IN_PROCESS";
export type LifecycleStatus = "DISCOVERED" | "CATALOGUED" | "BENCHMARKED" | "HARDENED" | "DISABLED" | "REJECTED" | "DEFERRED";
export type ProductionAuthorization = "AUTHORIZED" | "NOT_AUTHORIZED";
export type SupportStatus = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED" | "TECHNICALLY_BLOCKED" | "DEFERRED";
export type Maturity = "BENCHMARKED" | "HARDENED" | "PRODUCTION_READY";
export type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "NOT_CHECKED" | "BLOCKED_BY_POLICY";
export type ExecutionMode = "BASELINE" | "BENCHMARK" | "STATIC" | "DYNAMIC" | "INSPECTION" | "FALLBACK";
export type DeterminismLevel = "DETERMINISTIC" | "BEST_EFFORT" | "NONDETERMINISTIC";
export type NetworkRequirement = "DENY_ALL" | "GOVERNED_REQUIRED";

export interface CapabilitySupport {
  capability: ProviderCapability; supportStatus: SupportStatus; maturity: Maturity;
  productionAuthorization: ProductionAuthorization; supportedMediaTypes: readonly string[]; supportedLanguages: readonly string[];
  constraints: readonly string[]; knownLimitations: readonly string[]; requiredRuntime: RuntimeKind;
  requiredPolicyFlags: readonly string[]; fallbackSuitability: "PRIMARY" | "FALLBACK" | "NONE"; evidenceReferences: readonly string[];
}
export interface ProviderDescriptor {
  providerId: string; providerFamily: ProviderFamily; displayName: string; implementationVersion: string; contractVersion: "1.0.0";
  runtimeKind: RuntimeKind; lifecycleStatus: LifecycleStatus; productionAuthorization: ProductionAuthorization;
  supportedCapabilities: readonly CapabilitySupport[]; supportedMediaTypes: readonly string[]; supportedLanguages: readonly string[];
  executionModes: readonly ExecutionMode[]; determinismLevel: DeterminismLevel; networkRequirement: NetworkRequirement;
  artifactBehavior: readonly ("INPUT_REFERENCE" | "OUTPUT_REFERENCE" | "RAW_RESPONSE" | "RENDERED_HTML" | "STRUCTURED_OUTPUT")[];
  selectable: boolean;
}
export interface ProviderAvailability { status: AvailabilityStatus; runtimeKind: RuntimeKind; expectedVersion: string; observedVersion?: string; artifactLockId?: string; modelLockId?: string; browserRevision?: string; checkedAt?: string; limitations: readonly string[] }

export type ArtifactKind = "RAW" | "STAGING" | "NORMALIZED" | "EVIDENCE" | "DATASET" | "DIAGNOSTIC";
export interface ArtifactReference { artifactId:string; artifactClass:ArtifactKind; role:"INPUT"|"OUTPUT"|"MARKDOWN"|"STRUCTURED"|"IMAGE"|"TABLE"|"PARQUET"|"MANIFEST"|"LOG"; key:string; mediaType:string; byteLength:number; checksumAlgorithm:"SHA256"; checksum:string; immutable:boolean; createdAt:string }
export interface NetworkPolicy { mode: "DENY_ALL" | "EXACT_ORIGIN"; allowedOrigin?: string; maxRedirects: number; allowWebSockets: boolean }
export interface ProviderPolicySnapshot {
  policyVersion: string; networkPolicy: NetworkPolicy; filesystemPolicy: { stagingNamespace: string; allowAbsolutePaths: false };
  resourcePolicy: ExecutionLimits; languagePolicy: { allowedLanguages: readonly string[]; rejectUnsupported: true };
  contentPolicy: { allowEmbeddedArtifacts: boolean }; artifactPolicy: { allowedKinds: readonly ArtifactKind[]; requireSha256: true };
}
export interface ExecutionLimits {
  wallTimeoutMs: number; startupTimeoutMs: number; maxInputBytes: number; maxOutputBytes: number; maxArtifacts: number; maxWarnings: number; maxErrors: number; maxChildProcesses: number; maxTemporaryBytes: number;
  maxPages: number; maxRows: number; maxColumns: number; maxRedirects: number; maxRetries: number; maxDepth: number; maxUrls: number; maxNetworkRequests: number; maxDownloads: number; maxPopups: number;
}
export interface ProvenanceContext { correlationId: string; causationId: string | null; selectionDecisionId: string }
export interface SelectionPolicy { requireProductionAuthorization: boolean; preferredProviderId?: string; dynamicRoutingSignal?: "DYNAMIC_RENDER_REQUIRED" }
export interface BaseProviderRequest {
  requestId: string; providerFamily: ProviderFamily; capability: ProviderCapability; requestedProviderId?: string; selectionPolicy: SelectionPolicy;
  inputArtifact?: ArtifactReference; mediaType: string; languageHints: readonly string[]; mode: ExecutionMode; policySnapshot: ProviderPolicySnapshot; executionLimits: ExecutionLimits; provenanceContext: ProvenanceContext;
}
export interface DatasetProviderRequest extends BaseProviderRequest { providerFamily: "DATASET_VALIDATION"; payload: { delimiter: "," | "\t" | ";"; hasHeader: boolean; expectedColumns: readonly string[] } }
export interface HtmlProviderRequest extends BaseProviderRequest { providerFamily: "HTML_EXTRACTION"; payload: { extractText: boolean; extractLinks: boolean; extractMetadata: boolean; structuralMode: "BASELINE" | "DOM" } }
export interface DocumentProviderRequest extends BaseProviderRequest { providerFamily: "DOCUMENT_PROCESSING"; payload: { inspectionOnly: boolean; extractLayout: boolean; extractSections: boolean; extractTables: boolean; pageRange: { first: number; last: number } | null } }
export interface StaticAcquisitionProviderRequest extends BaseProviderRequest { providerFamily: "STATIC_ACQUISITION"; governedSource: { scheme: "http" | "https"; host: string; port: number; relativeRoute: string }; payload: { obeyRobots: boolean; discoverLinks: boolean } }
export interface BrowserAcquisitionProviderRequest extends BaseProviderRequest { providerFamily: "BROWSER_ACQUISITION"; governedSource: { scheme: "http" | "https"; host: string; port: number; relativeRoute: string }; payload: { waitUntil: "LOAD" | "DOM_CONTENT_LOADED" | "NETWORK_IDLE"; allowDownloads: boolean; allowPopups: false } }
export type ProviderRequest = DatasetProviderRequest | HtmlProviderRequest | DocumentProviderRequest | StaticAcquisitionProviderRequest | BrowserAcquisitionProviderRequest;

export type FallbackReason = "CAPABILITY_UNSUPPORTED" | "MEDIA_TYPE_UNSUPPORTED" | "DYNAMIC_RENDER_REQUIRED" | "PRIMARY_PROVIDER_UNAVAILABLE" | "PRIMARY_PROVIDER_TECHNICAL_FAILURE" | "POLICY_BLOCKED" | "RESOURCE_LIMIT_EXCEEDED";
export type NonFallbackReason = "INVALID_REQUEST" | "SECURITY_POLICY_VIOLATION" | "ARTIFACT_HASH_MISMATCH" | "UNSUPPORTED_LANGUAGE" | "PROVIDER_CONTRACT_VIOLATION";
export interface CandidateEvaluation { providerId: string; eligible: boolean; reasons: readonly string[] }
export interface SelectionResult { status: "SELECTED" | "NO_ELIGIBLE_PROVIDER"; selectedProviderId?: string; selectionReason: string; candidateEvaluations: readonly CandidateEvaluation[]; fallbackProviderIds: readonly string[]; unavailableReasons: readonly string[] }

export type ProviderOutcome = "SUCCESS" | "UNSUPPORTED" | "POLICY_BLOCKED" | "RETRYABLE_FAILURE" | "NON_RETRYABLE_FAILURE" | "RESOURCE_LIMIT" | "CANCELLED" | "PROVIDER_UNAVAILABLE" | "CONTRACT_VIOLATION";
export interface ProviderMetrics { startupDurationMs: number; executionDurationMs: number; totalDurationMs: number; inputBytes: number; outputBytes: number; temporaryBytes: number; warningCount: number; artifactCount: number }
export interface ProviderProvenance { providerId: string; providerVersion: string; contractVersion: string; capability: ProviderCapability; policyVersion: string; inputArtifactHashes: readonly string[]; outputArtifactHashes: readonly string[]; selectionDecision: string; fallbackHistory: readonly { providerId: string; reason: FallbackReason }[]; runtimeEvidenceReference: string | null; determinismClassification: DeterminismLevel }
export interface ProviderExecutionBase { outcome: ProviderOutcome; providerId: string; providerVersion: string; contractVersion: "1.0.0"; capability: ProviderCapability; executionId: string; requestId: string; warnings: readonly string[]; metrics: ProviderMetrics; provenance: ProviderProvenance; policyVersion: string; startedAt: string; completedAt: string }
export interface ProviderSuccess<T> extends ProviderExecutionBase { outcome: "SUCCESS"; artifacts: readonly ArtifactReference[]; structuredOutput: T; error: null }
export interface ProviderFailure extends ProviderExecutionBase { outcome: Exclude<ProviderOutcome,"SUCCESS">; artifacts?: never; structuredOutput?: never; error: ProviderError }
export type ProviderExecutionResult<T> = ProviderSuccess<T> | ProviderFailure;
export type ProviderErrorCode = "INVALID_PROVIDER_REQUEST" | "PROVIDER_NOT_FOUND" | "CAPABILITY_NOT_SUPPORTED" | "MEDIA_TYPE_NOT_SUPPORTED" | "LANGUAGE_NOT_SUPPORTED" | "PROVIDER_NOT_ELIGIBLE" | "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "PROVIDER_STARTUP_FAILURE" | "PROVIDER_EXECUTION_FAILURE" | "PROVIDER_PROTOCOL_FAILURE" | "PROVIDER_OUTPUT_INVALID" | "ARTIFACT_REFERENCE_INVALID" | "ARTIFACT_HASH_MISMATCH" | "NETWORK_POLICY_VIOLATION" | "FILESYSTEM_POLICY_VIOLATION" | "RESOURCE_LIMIT_EXCEEDED" | "FALLBACK_EXHAUSTED" | "CANCELLED";
export interface ProviderError { code: ProviderErrorCode; message: string; retryable: boolean; fallbackEligible: boolean; securityRelevant: boolean }
export interface ProviderExecutionContext { executionId: string; signal: AbortSignal; stagingArtifacts: readonly ArtifactReference[]; diagnosticLimitBytes: number; runtimeEvidenceReference: string | null }
export interface ProviderAdapter<R extends ProviderRequest = ProviderRequest,T = unknown> { readonly descriptor: ProviderDescriptor; checkAvailability(): Promise<ProviderAvailability>; execute(request:R,context:ProviderExecutionContext):Promise<ProviderExecutionResult<T>> }
export interface DatasetStructuredOutput { schemaSummary:readonly {name:string;type:string}[]; rowCount:number; validRowCount:number; invalidRowCount:number; validationIssues:readonly string[]; typeEvidence:readonly string[] }
export interface HtmlStructuredOutput { textArtifact:ArtifactReference|null; metadata:readonly {name:string;content:string}[]; links:readonly string[]; encodingEvidence:readonly string[]; structureEvidence:readonly string[] }
export interface DocumentStructuredOutput { textArtifact:ArtifactReference|null; metadata:readonly {name:string;content:string}[]; pages:number; sections:number; tables:number; layoutEvidence:readonly string[]; digitalTextAssessment:"DIGITAL"|"IMAGE_ONLY"|"UNKNOWN"; unsupportedLanguageReason:string|null }
export interface StaticAcquisitionStructuredOutput { rawResponseArtifact:ArtifactReference; status:number; finalUrl:string; redirectChain:readonly string[]; headers:readonly {name:string;value:string}[]; discoveredLinks:readonly string[]; robotsDecision:"ALLOW"|"DENY"|"NOT_APPLICABLE" }
export interface BrowserAcquisitionStructuredOutput { rawResponseArtifact:ArtifactReference; renderedHtmlArtifact:ArtifactReference; status:number; finalUrl:string; redirectChain:readonly string[]; networkInventory:readonly {url:string;classification:"ALLOWED"|"BLOCKED"|"FAILED"}[]; downloadInventory:readonly {suggestedName:string;disposition:"DETECTED_AND_CANCELLED"}[]; popupInventory:readonly {url:string;disposition:"CLOSED"}[] }
