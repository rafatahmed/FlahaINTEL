/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Acquisition Protocol Fault Fixture
 * Introduction: Emits deterministic allocation and ownership faults for control-plane contract tests.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { createHash } from "node:crypto";import { writeFile } from "node:fs/promises";import { createInterface } from "node:readline";
const reader=createInterface({input:process.stdin,crlfDelay:Infinity}),request=JSON.parse(await new Promise(resolve=>reader.once("line",resolve)));reader.close();const payload=request.payload,mode=payload.governedLocator.relativeRoute.split("/").at(-1);const ctx=(type,sequence)=>({contractVersion:"1.0.0",correlationId:request.correlationId,causationId:request.jobId,jobId:request.jobId,attemptId:request.attemptId,messageType:type,sequence});const metrics={wallTimeMs:0,peakMemoryBytes:0,bytesRead:0,bytesWritten:0};const descriptor={...request.provider,contractVersions:["1.0.0"],operations:[request.operation],inputMediaTypes:[],outputMediaTypes:["text/html"],capabilities:[],offlineCapable:false,deterministicClaim:"DETERMINISTIC",requiresNetwork:false,binaryDigest:null,modelDigests:[],generatedAt:request.sentAt};
process.stdout.write(`${JSON.stringify({...ctx("WORKER_PROGRESS",0),occurredAt:request.sentAt,stage:"PROBE",status:"STARTED",completedUnits:0,totalUnits:1,unit:"STEPS",metrics})}\n`);if(mode==="crash")process.exit(7);if(mode==="timeout")await new Promise(()=>{});
const artifacts=[];for(const allocation of payload.artifactAllocations){const bytes=Buffer.from(`${allocation.role}:${mode}`);await writeFile(allocation.stagingKey,bytes);artifacts.push({artifactId:allocation.artifactId,role:allocation.role,mediaType:allocation.mediaType,stagingKey:allocation.stagingKey,byteLength:bytes.length,checksum:createHash("sha256").update(bytes).digest("hex"),writeComplete:true})}
const result={operation:request.operation,executionId:payload.executionId,providerId:request.provider.providerId,providerVersion:request.provider.providerVersion,capability:payload.capability,status:200,finalUrl:"http://fixture/",redirectChain:[],headers:{},discoveredLinks:[],networkInventory:[],downloads:[],popups:[],robotsDecision:"ALLOW",artifacts};
if(mode==="wrong-execution")result.executionId="00000000-0000-4000-8000-000000000999";if(mode==="wrong-provider")result.providerId="acquisition.invalid";if(mode==="wrong-capability")result.capability=payload.capability==="JAVASCRIPT_RENDERING"?"STATIC_HTTP_ACQUISITION":"JAVASCRIPT_RENDERING";if(mode==="unknown-allocation"||mode==="unallocated-reference")result.artifacts[0].artifactId="00000000-0000-4000-8000-000000000999";if(mode==="wrong-relationship")result.artifacts[0].role="DIAGNOSTIC";if(mode==="hash-mismatch")result.artifacts[0].checksum="0".repeat(64);if(mode==="size-mismatch")result.artifacts[0].byteLength++;if(mode==="duplicate-artifact")result.artifacts.push({...result.artifacts[0]});if(mode==="missing-raw")result.artifacts=result.artifacts.filter(value=>value.role!=="RAW_RESPONSE");if(mode==="missing-rendered")result.artifacts=result.artifacts.filter(value=>value.role!=="RENDERED_HTML");
const terminal={...ctx("WORKER_RESULT",1),startedAt:request.sentAt,finishedAt:request.sentAt,outcome:"SUCCEEDED",providerDescriptor:descriptor,warnings:[],metrics,result,error:null};if(mode==="wrong-job")terminal.jobId="00000000-0000-4000-8000-000000000999";if(mode==="wrong-attempt")terminal.attemptId="00000000-0000-4000-8000-000000000999";process.stdout.write(`${JSON.stringify(terminal)}\n`);
