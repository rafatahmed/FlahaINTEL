/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Provider Error Taxonomy
 * Introduction: Defines retry, fallback, and security semantics without string inference.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import type { ProviderError,ProviderErrorCode } from "./types.js";
const RETRY=new Set<ProviderErrorCode>(["PROVIDER_UNAVAILABLE","PROVIDER_TIMEOUT","PROVIDER_STARTUP_FAILURE","PROVIDER_EXECUTION_FAILURE"]);const FALLBACK=new Set<ProviderErrorCode>(["CAPABILITY_NOT_SUPPORTED","MEDIA_TYPE_NOT_SUPPORTED","PROVIDER_UNAVAILABLE","PROVIDER_TIMEOUT","PROVIDER_STARTUP_FAILURE","PROVIDER_EXECUTION_FAILURE","RESOURCE_LIMIT_EXCEEDED"]);const SECURITY=new Set<ProviderErrorCode>(["ARTIFACT_REFERENCE_INVALID","ARTIFACT_HASH_MISMATCH","NETWORK_POLICY_VIOLATION","FILESYSTEM_POLICY_VIOLATION","PROVIDER_PROTOCOL_FAILURE"]);
export function providerError(code:ProviderErrorCode,message:string):ProviderError{return Object.freeze({code,message,retryable:RETRY.has(code),fallbackEligible:FALLBACK.has(code),securityRelevant:SECURITY.has(code)})}
