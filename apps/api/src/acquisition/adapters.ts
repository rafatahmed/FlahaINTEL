/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Governed Acquisition Runtime Adapters
 * Introduction:
 * Executes closed Scrapy and Playwright operations through the canonical bounded WorkerSupervisor JSONL protocol.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-22
 */
import { randomUUID } from "node:crypto";
import { access, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { ProtocolValidator, WorkerSupervisor, type SupervisorOptions, type WorkerRequest } from "@flaha-intel/worker-supervisor";
import { playwrightWorkerEnv } from "../production/runtimeBins.js";
import { sanitizeHeaders, validateLocator } from "./networkPolicy.js";
import type { AcquisitionAdapter, AcquisitionAdapterResult, AdapterFailure, AcquisitionAttemptContext, AcquisitionEvidence } from "./contracts.js";

export type AcquisitionRuntime = { executable: string; script: string; args?: string[]; runtime?: "PYTHON" | "NODE"; schemas?: string };
type Wire = { operation:string; executionId:string; providerId:string; providerVersion:string; capability:string; status?:number; finalUrl?:string; redirectChain?:string[]; headers?:Record<string,string>; discoveredLinks?:string[]; networkInventory?:AcquisitionEvidence["networkInventory"]; downloads?:AcquisitionEvidence["downloads"]; popups?:AcquisitionEvidence["popups"]; robotsDecision?:AcquisitionEvidence["robotsDecision"]; artifacts?:Array<{artifactId:string;role:string;mediaType:string;stagingKey:string;byteLength:number;checksum:string;writeComplete:true}> };

function options(runtime:AcquisitionRuntime, timeoutMs:number, workingDirectory:string, temporaryDirectory:string):SupervisorOptions {
  return { pythonExecutable:runtime.executable,workerEntryPoint:runtime.script,workingDirectory,temporaryDirectory,runtime:runtime.runtime ?? (runtime.executable===process.execPath?"NODE":"PYTHON"),timeoutMs:timeoutMs+5_000,cancellationGraceMs:500,maximumLineBytes:1_048_576,maximumMessages:64,maximumProgress:32,maximumStderrBytes:8_192,environment:playwrightWorkerEnv() };
}

export async function missingBrowserRuntime(source: NodeJS.ProcessEnv = process.env): Promise<AdapterFailure | null> {
  const chromium = playwrightWorkerEnv(source).PLAYWRIGHT_CHROMIUM_PATH;
  const production = source.NODE_ENV === "production" || source.AUTH_MODE === "production";
  if (!chromium) {
    if (!production) return null;
    return { outcome: "FAILED", code: "BROWSER_RUNTIME_MISSING", message: "PLAYWRIGHT_CHROMIUM_PATH is not set on this host. Run ops/scripts/linux/provision-runtimes.sh. Do not resubmit until Chromium exists.", retryable: false, fallbackEligible: false, securityRelevant: false };
  }
  try { await access(chromium); return null; }
  catch {
    return { outcome: "FAILED", code: "BROWSER_RUNTIME_MISSING", message: `Chromium is not at ${chromium}. Run ops/scripts/linux/provision-runtimes.sh. Do not resubmit until that binary exists.`, retryable: false, fallbackEligible: false, securityRelevant: false };
  }
}
async function execute(runtime:AcquisitionRuntime,context:AcquisitionAttemptContext,providerId:string,providerVersion:string,dynamic:boolean):Promise<AcquisitionAdapterResult> {
  const url=await validateLocator(context.locator); const operation=dynamic?"BROWSER_ACQUISITION":"STATIC_ACQUISITION"; const correlationId=randomUUID(); const stagingPrefix=`staging/${context.jobId}/${context.attemptId}`;
  const request:WorkerRequest={contractVersion:"1.0.0",correlationId,causationId:null,jobId:context.jobId,attemptId:context.attemptId,messageType:"WORKER_REQUEST",sentAt:new Date().toISOString(),operation,provider:{providerId,providerVersion,adapterVersion:"3H.1.0"},policySnapshot:{stagingPrefix,policyVersion:"3H.1"},payload:{operation,outputStagingPrefix:stagingPrefix,executionId:context.attemptId,capability:context.capability,governedLocator:context.locator,networkPolicy:{mode:"EXACT_ORIGIN",allowedOrigin:`${url.protocol}//${url.host}`},executionLimits:context.limits,artifactAllocations:context.allocations,deadline:new Date(Date.now()+context.limits.wallTimeoutMs).toISOString()}};
  const schemas=runtime.schemas??path.resolve("packages/ingestion-contracts/schemas/v1"); const validator=await ProtocolValidator.fromSchemaDirectory(schemas);const temporaryDirectory=path.join(context.workingDirectory,".worker-temp",correlationId);await mkdir(temporaryDirectory,{recursive:true}); const running=new WorkerSupervisor(options(runtime,context.limits.wallTimeoutMs,context.workingDirectory,temporaryDirectory),validator).start(request); const cancel=()=>running.cancel(); context.signal.addEventListener("abort",cancel,{once:true});
  try {
    const supervised=await running.result; const terminal=supervised.result;
    if(supervised.outcome==="CANCELLED")return {outcome:"CANCELLED",code:"CANCELLED",message:"Acquisition cancelled.",retryable:false,fallbackEligible:false,securityRelevant:false};
    if(supervised.outcome==="FAILED"){const error=terminal.error as Record<string,unknown>;return {outcome:"FAILED",code:String(error.code??"PROVIDER_EXECUTION_FAILURE"),message:String(error.message??"Worker failed.").slice(0,512),retryable:Boolean(error.retryable),fallbackEligible:error.code==="DYNAMIC_RENDER_REQUIRED",securityRelevant:error.category==="POLICY_VIOLATION"};}
    const wire=terminal.result as Wire;
    if(wire.providerId!==providerId||wire.providerVersion!==providerVersion||wire.capability!==context.capability||wire.operation!==operation)throw new Error("Acquisition result authority mismatch.");
    const artifacts=wire.artifacts??[]; const expected=new Map(context.allocations.map(value=>[value.artifactId,value])); const seen=new Set<string>();
    for(const artifact of artifacts){const allocated=expected.get(artifact.artifactId);if(!allocated||seen.has(artifact.artifactId)||artifact.role!==allocated.role||artifact.mediaType!==allocated.mediaType||artifact.stagingKey!==allocated.stagingKey||artifact.byteLength<0||artifact.byteLength>allocated.maximumBytes||!/^[a-f0-9]{64}$/.test(artifact.checksum)||artifact.writeComplete!==true)throw new Error("Acquisition artifact result violates its allocation.");seen.add(artifact.artifactId)}
    if(!artifacts.some(value=>value.role==="RAW_RESPONSE")||dynamic&&!artifacts.some(value=>value.role==="RENDERED_HTML")||artifacts.length!==context.allocations.length)throw new Error("Acquisition result omitted a required allocation.");
    return {outcome:"SUCCESS",artifacts:artifacts as never,evidence:{status:wire.status??0,finalUrl:wire.finalUrl??url.href,redirectChain:wire.redirectChain??[],headers:sanitizeHeaders(wire.headers??{}),discoveredLinks:wire.discoveredLinks??[],networkInventory:wire.networkInventory??[],downloads:wire.downloads??[],popups:wire.popups??[],robotsDecision:wire.robotsDecision??"NOT_APPLICABLE",runtimeEvidence:dynamic?"playwright-1.61.1/chromium-r1228":"scrapy-2.17.0"}};
  } catch(error) { if(context.signal.aborted)return {outcome:"CANCELLED",code:"CANCELLED",message:"Acquisition cancelled.",retryable:false,fallbackEligible:false,securityRelevant:false}; return {outcome:"FAILED",code:"PROVIDER_PROTOCOL_FAILURE",message:String(error).slice(0,512),retryable:false,fallbackEligible:false,securityRelevant:true}; }
  finally { context.signal.removeEventListener("abort",cancel); await rm(temporaryDirectory,{recursive:true,force:true,maxRetries:10,retryDelay:100}); }
}
export class ScrapyAcquisitionAdapter implements AcquisitionAdapter { readonly providerId="acquisition.scrapy" as const; readonly providerVersion="2.17.0"; constructor(private readonly runtime:AcquisitionRuntime){} execute(context:AcquisitionAttemptContext){return execute(this.runtime,context,this.providerId,this.providerVersion,false)} }
export class PlaywrightAcquisitionAdapter implements AcquisitionAdapter { readonly providerId="acquisition.playwright" as const; readonly providerVersion="1.61.1"; constructor(private readonly runtime:AcquisitionRuntime){} async execute(context:AcquisitionAttemptContext){if(!["JAVASCRIPT_RENDERING","RENDERED_DOM_CAPTURE"].includes(context.capability))return {outcome:"FAILED" as const,code:"INVALID_PROVIDER_REQUEST",message:"Playwright requires an explicit dynamic capability.",retryable:false,fallbackEligible:false,securityRelevant:true};const missing=await missingBrowserRuntime();if(missing)return missing;return execute(this.runtime,context,this.providerId,this.providerVersion,true)} }
