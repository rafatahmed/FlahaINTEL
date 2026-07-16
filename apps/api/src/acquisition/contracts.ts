/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Acquisition Workflow Contracts
 * Introduction:
 * Defines closed Phase 3H application, adapter, evidence, and artifact contracts.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import type { Actor } from "../ingestionJobs/domain.js";
import type { ExecutionLimits, ProviderCapability } from "@flaha-intel/ingestion-provider-core";

export type AcquisitionCapability = Extract<ProviderCapability, "STATIC_HTTP_ACQUISITION" | "CONTROLLED_CRAWLING" | "LINK_DISCOVERY" | "JAVASCRIPT_RENDERING" | "RENDERED_DOM_CAPTURE">;
export interface GovernedLocator { mode: "PUBLIC" | "FIXTURE"; scheme: "http" | "https"; host: string; port: number; relativeRoute: string; }
export interface AcquisitionLimits { maxDepth: number; maxUrls: number; maxRedirects: number; maxNetworkRequests: number; maxDownloads: number; maxPopups: number; maxResponseBytes: number; wallTimeoutMs: number; }
export interface AcquisitionCommand { idempotencyKey: string; sourceId?: string; locator: GovernedLocator; priority?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL"; limits: AcquisitionLimits; executionLimits?: Partial<ExecutionLimits>; actor: Actor; }
export interface ControlledCrawlCommand extends AcquisitionCommand { capability: "CONTROLLED_CRAWLING" | "LINK_DISCOVERY"; obeyRobots: true; }
export interface DynamicAcquisitionCommand extends AcquisitionCommand { capability: "JAVASCRIPT_RENDERING" | "RENDERED_DOM_CAPTURE"; routingSignal: "DYNAMIC_RENDER_REQUIRED"; allowDownloads: boolean; }
export type ArtifactRole = "RAW_RESPONSE" | "RENDERED_HTML" | "METADATA" | "RESULT" | "DIAGNOSTIC";
export interface AcquisitionArtifactAllocation { artifactId: string; role: ArtifactRole; mediaType: string; stagingKey: string; maximumBytes: number; }
export interface CapturedArtifact { artifactId: string; role: ArtifactRole; mediaType: string; stagingKey: string; byteLength: number; checksum: string; writeComplete: true; }
export interface AcquisitionEvidence { status: number; finalUrl: string; redirectChain: string[]; headers: Record<string, string>; discoveredLinks: string[]; networkInventory: { url: string; classification: "ALLOWED" | "BLOCKED" | "FAILED" }[]; downloads: { suggestedName: string; disposition: "DETECTED_AND_CANCELLED" }[]; popups: { url: string; disposition: "CLOSED" }[]; robotsDecision: "ALLOW" | "DENY" | "NOT_APPLICABLE"; runtimeEvidence: string; }
export interface AdapterSuccess { outcome: "SUCCESS"; artifacts: CapturedArtifact[]; evidence: AcquisitionEvidence; }
export interface AdapterFailure { outcome: "FAILED" | "CANCELLED"; code: string; message: string; retryable: boolean; fallbackEligible: boolean; securityRelevant: boolean; }
export type AcquisitionAdapterResult = AdapterSuccess | AdapterFailure;
export interface AcquisitionAttemptContext { jobId: string; attemptId: string; capability: AcquisitionCapability; locator: GovernedLocator; limits: AcquisitionLimits; allocations: AcquisitionArtifactAllocation[]; workingDirectory: string; signal: AbortSignal; }
export interface AcquisitionAdapter { providerId: "acquisition.scrapy" | "acquisition.playwright"; providerVersion: string; execute(context: AcquisitionAttemptContext): Promise<AcquisitionAdapterResult>; }
