/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Provider Fallback Policy
 * Introduction: Builds finite capability-compatible fallback chains from typed reasons.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import type { FallbackReason, NonFallbackReason, ProviderCapability } from "./types.js"; import { ProviderRegistry } from "./registry.js";
export const FALLBACK_ELIGIBILITY:Readonly<Record<FallbackReason,boolean>>=Object.freeze({CAPABILITY_UNSUPPORTED:true,MEDIA_TYPE_UNSUPPORTED:true,DYNAMIC_RENDER_REQUIRED:true,PRIMARY_PROVIDER_UNAVAILABLE:true,PRIMARY_PROVIDER_TECHNICAL_FAILURE:true,POLICY_BLOCKED:true,RESOURCE_LIMIT_EXCEEDED:true});
export const TERMINAL_REASONS:readonly NonFallbackReason[]=Object.freeze(["INVALID_REQUEST","SECURITY_POLICY_VIOLATION","ARTIFACT_HASH_MISMATCH","UNSUPPORTED_LANGUAGE","PROVIDER_CONTRACT_VIOLATION"]);
export function buildFallbackChain(registry:ProviderRegistry,primary:string,candidates:readonly string[],capability:ProviderCapability,reason:FallbackReason|NonFallbackReason):readonly string[]{if((TERMINAL_REASONS as readonly string[]).includes(reason))return Object.freeze([]);const result:string[]=[];const seen=new Set([primary]);const family=registry.getProvider(primary)?.providerFamily;for(const id of candidates){const p=registry.getProvider(id);if(!p||seen.has(id)||p.providerFamily!==family||!p.selectable||!p.supportedCapabilities.some(s=>s.capability===capability&&["SUPPORTED","PARTIALLY_SUPPORTED"].includes(s.supportStatus)))continue;seen.add(id);result.push(id)}return Object.freeze(result);}
