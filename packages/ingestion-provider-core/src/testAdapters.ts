/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: In-Memory Provider Test Adapters
 * Introduction: Supplies closed external-runtime-free adapters for framework verification only.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { providerError } from "./errors.js";
import type { ProviderAdapter, ProviderAvailability, ProviderDescriptor, ProviderExecutionContext, ProviderExecutionResult, ProviderRequest } from "./types.js";
export type FakeBehavior="SUCCESS"|"UNSUPPORTED"|"UNAVAILABLE"|"RETRYABLE_FAILURE"|"CONTRACT_VIOLATION"|"SLOW";
export class FakeProviderAdapter implements ProviderAdapter {
  constructor(readonly descriptor:ProviderDescriptor,private readonly behavior:FakeBehavior){}
  async checkAvailability():Promise<ProviderAvailability>{return{status:this.behavior==="UNAVAILABLE"?"UNAVAILABLE":"AVAILABLE",runtimeKind:this.descriptor.runtimeKind,expectedVersion:this.descriptor.implementationVersion,limitations:[]}}
  async execute(request:ProviderRequest,context:ProviderExecutionContext):Promise<ProviderExecutionResult<unknown>>{
    if(this.behavior==="SLOW")await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,100);context.signal.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("cancelled","AbortError"))},{once:true})});
    const base={providerId:this.behavior==="CONTRACT_VIOLATION"?"wrong.provider":this.descriptor.providerId,providerVersion:this.descriptor.implementationVersion,contractVersion:"1.0.0" as const,capability:request.capability,executionId:context.executionId,requestId:request.requestId,warnings:[],metrics:{startupDurationMs:0,executionDurationMs:1,totalDurationMs:1,inputBytes:request.inputArtifact?.byteLength??0,outputBytes:0,temporaryBytes:0,warningCount:0,artifactCount:0},provenance:{providerId:this.descriptor.providerId,providerVersion:this.descriptor.implementationVersion,contractVersion:"1.0.0",capability:request.capability,policyVersion:request.policySnapshot.policyVersion,inputArtifactHashes:request.inputArtifact?[request.inputArtifact.checksum]:[],outputArtifactHashes:[],selectionDecision:request.provenanceContext.selectionDecisionId,fallbackHistory:[],runtimeEvidenceReference:context.runtimeEvidenceReference,determinismClassification:this.descriptor.determinismLevel},policyVersion:request.policySnapshot.policyVersion,startedAt:"2026-07-16T00:00:00.000Z",completedAt:"2026-07-16T00:00:00.001Z"};
    if(this.behavior==="SUCCESS"||this.behavior==="CONTRACT_VIOLATION"||this.behavior==="SLOW")return{...base,outcome:"SUCCESS",artifacts:[],structuredOutput:{ok:true},error:null};
    const unavailable=this.behavior==="UNAVAILABLE";const retry=this.behavior==="RETRYABLE_FAILURE";
    return{...base,outcome:unavailable?"PROVIDER_UNAVAILABLE":retry?"RETRYABLE_FAILURE":"UNSUPPORTED",error:providerError(unavailable?"PROVIDER_UNAVAILABLE":retry?"PROVIDER_EXECUTION_FAILURE":"CAPABILITY_NOT_SUPPORTED",this.behavior)};
  }
}
