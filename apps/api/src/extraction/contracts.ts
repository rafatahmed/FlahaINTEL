/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Extraction Routing Contracts
 * Introduction: Defines closed Phase 3I commands, allocations, adapters, and metadata-only results.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import type { ArtifactReference,ExecutionLimits,ProviderCapability } from "@flaha-intel/ingestion-provider-core";import type { Actor } from "../ingestionJobs/domain.js";
export type ExtractionCapability=Extract<ProviderCapability,`HTML_${string}`|`DOCUMENT_${string}`>;export type ExtractionRole="EXTRACTED_TEXT"|"METADATA"|"STRUCTURE"|"TABLE"|"RESULT"|"DIAGNOSTIC";
export interface ExtractionCommand{inputArtifact:ArtifactReference;mediaType:string;capability:ExtractionCapability;languageHints:string[];idempotencyKey:string;priority?:"LOW"|"NORMAL"|"HIGH"|"CRITICAL";executionLimits?:Partial<ExecutionLimits>;mode?:"BASELINE"|"BENCHMARK"|"INSPECTION";actor:Actor}
export interface ExtractionAllocation{artifactId:string;role:ExtractionRole;mediaType:string;stagingKey:string;maximumBytes:number}export interface ExtractedArtifact extends Omit<ExtractionAllocation,"maximumBytes">{byteLength:number;checksum:string;writeComplete:true}
export type ExtractionAdapterResult={outcome:"SUCCESS";artifacts:ExtractedArtifact[];evidence:Record<string,unknown>;runtimeEvidence:string}|{outcome:"FAILED"|"CANCELLED";code:string;message:string;retryable:boolean;fallbackEligible:boolean;securityRelevant:boolean};
export interface ExtractionContext{jobId:string;attemptId:string;capability:ExtractionCapability;inputArtifact:ArtifactReference;policyVersion:string;limits:ExecutionLimits;languageHints:string[];allocations:ExtractionAllocation[];workingDirectory:string;signal:AbortSignal}
export interface ExtractionAdapter{providerId:string;providerVersion:string;execute(context:ExtractionContext):Promise<ExtractionAdapterResult>}
