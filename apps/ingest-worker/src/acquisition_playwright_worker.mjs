/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Governed Playwright Acquisition Worker
 * Introduction: Executes one closed browser operation and writes only control-plane allocated staging files.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-21
 */
import { createHash } from "node:crypto";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwright = process.env.PLAYWRIGHT_MODULE
  ? require(process.env.PLAYWRIGHT_MODULE)
  : require("../../../.benchmark-runtime/browser-playwright-1.61.1/node_modules/playwright");

const reader=createInterface({input:process.stdin,crlfDelay:Infinity});
const request=JSON.parse(await new Promise(resolve=>reader.once("line",resolve)));reader.close();
const payload=request.payload;let browser;
const ctx=(type,sequence)=>({contractVersion:"1.0.0",correlationId:request.correlationId,causationId:request.jobId,jobId:request.jobId,attemptId:request.attemptId,messageType:type,sequence});
const metrics={wallTimeMs:0,peakMemoryBytes:0,bytesRead:0,bytesWritten:0};
const descriptor=()=>({...request.provider,contractVersions:["1.0.0"],operations:[request.operation],inputMediaTypes:[],outputMediaTypes:["text/html","application/json"],capabilities:["CANCELLATION"],offlineCapable:false,deterministicClaim:"NON_DETERMINISTIC",requiresNetwork:true,binaryDigest:null,modelDigests:[],generatedAt:request.sentAt});
const emit=value=>process.stdout.write(`${JSON.stringify(value)}\n`);
const terminal=(outcome,result=null,error=null)=>emit({...ctx("WORKER_RESULT",1),startedAt:request.sentAt,finishedAt:request.sentAt,outcome,providerDescriptor:descriptor(),warnings:[],metrics,result,error});
async function writeAllocation(role,bytes){
  const allocation=payload.artifactAllocations.find(value=>value.role===role);if(!allocation)throw new Error(`missing ${role} allocation`);
  const normalized=allocation.stagingKey.replaceAll("\\","/");if(path.isAbsolute(normalized)||normalized.split("/").includes("..")||!normalized.startsWith(`${payload.outputStagingPrefix}/`))throw new Error("invalid allocation path");
  const target=path.resolve(normalized),root=path.resolve(".");if(path.relative(root,target).startsWith("..")||(await lstat(target)).isSymbolicLink())throw new Error("allocation escape");
  if(bytes.length>allocation.maximumBytes)throw new Error("allocation limit");const handle=await open(target,"r+");try{await handle.truncate(0);await handle.write(bytes);await handle.sync()}finally{await handle.close()}
  return {artifactId:allocation.artifactId,role,mediaType:allocation.mediaType,stagingKey:allocation.stagingKey,byteLength:bytes.length,checksum:createHash("sha256").update(bytes).digest("hex"),writeComplete:true};
}
try{
  if(request.operation!=="BROWSER_ACQUISITION"||payload.operation!==request.operation||request.provider.providerId!=="acquisition.playwright"||!["JAVASCRIPT_RENDERING","RENDERED_DOM_CAPTURE"].includes(payload.capability))throw new Error("closed operation authority mismatch");
  emit({...ctx("WORKER_PROGRESS",0),occurredAt:request.sentAt,stage:"PROBE",status:"STARTED",completedUnits:0,totalUnits:1,unit:"STEPS",metrics});
  const l=payload.governedLocator;const url=(l.scheme==="https"&&l.port===443)||(l.scheme==="http"&&l.port===80)?`${l.scheme}://${l.host}${l.relativeRoute}`:`${l.scheme}://${l.host}:${l.port}${l.relativeRoute}`;const origin=new URL(url);const effectivePort=u=>u.port||(u.protocol==="https:"?"443":u.protocol==="http:"?"80":"");const allowed=value=>{try{const u=new URL(value);return u.protocol===origin.protocol&&u.hostname.toLowerCase()===origin.hostname.toLowerCase()&&effectivePort(u)===effectivePort(origin)&&!u.username&&!u.password}catch{return false}};
  const launchOpts={headless:true,args:["--disable-extensions","--disable-webrtc","--no-sandbox","--disable-dev-shm-usage"]};
  if(process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath=process.env.PLAYWRIGHT_CHROMIUM_PATH;
  browser=await playwright.chromium.launch(launchOpts);const context=await browser.newContext({acceptDownloads:false,serviceWorkers:"block",permissions:[]});const page=await context.newPage(),network=[],downloads=[],popups=[];
  await context.route("**/*",route=>{const target=route.request().url();network.push({url:target,classification:allowed(target)?"ALLOWED":"BLOCKED"});return allowed(target)?route.continue():route.abort("blockedbyclient")});await context.routeWebSocket("**",socket=>socket.close());
  page.on("popup",popup=>{popups.push({url:popup.url(),disposition:"CLOSED"});void popup.close()});page.on("download",download=>{downloads.push({suggestedName:download.suggestedFilename(),disposition:"DETECTED_AND_CANCELLED"});void download.cancel()});
  const response=await page.goto(url,{waitUntil:"networkidle",timeout:payload.executionLimits.wallTimeoutMs});const raw=Buffer.from(await(await context.request.get(url)).body()),rendered=Buffer.from(await page.content());const headers=await response?.allHeaders()??{},discoveredLinks=await page.locator("a").evaluateAll(nodes=>nodes.slice(0,100).map(node=>node.href));
  const metadata=Buffer.from(JSON.stringify({headers,redirectChain:[],networkInventory:network.slice(0,payload.executionLimits.maxNetworkRequests),downloads:downloads.slice(0,payload.executionLimits.maxDownloads),popups:popups.slice(0,payload.executionLimits.maxPopups)}));
  const resultBytes=Buffer.from(JSON.stringify({status:response?.status()??0,finalUrl:page.url(),discoveredLinks,robotsDecision:"NOT_APPLICABLE"}));
  const artifacts=[await writeAllocation("RAW_RESPONSE",raw),await writeAllocation("RENDERED_HTML",rendered),await writeAllocation("METADATA",metadata),await writeAllocation("RESULT",resultBytes)];
  terminal("SUCCEEDED",{operation:request.operation,executionId:payload.executionId,providerId:"acquisition.playwright",providerVersion:"1.61.1",capability:payload.capability,status:response?.status()??0,finalUrl:page.url(),redirectChain:[],headers,discoveredLinks,networkInventory:network.slice(0,payload.executionLimits.maxNetworkRequests),downloads:downloads.slice(0,payload.executionLimits.maxDownloads),popups:popups.slice(0,payload.executionLimits.maxPopups),robotsDecision:"NOT_APPLICABLE",artifacts});await context.close();
}catch(error){terminal("FAILED",null,{code:"PROVIDER_EXECUTION_FAILURE",category:"PROVIDER_FAILURE",retryable:false,message:String(error?.message??error).slice(0,512)})}finally{if(browser)await browser.close()}
