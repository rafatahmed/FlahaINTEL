/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Worker Protocol Validator
 * Introduction:
 * Enforces message shape, ownership, operation, and staging-prefix rules.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-15
 * Last modified: 2026-07-16
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { WorkerProtocolError } from "./errors.js";
import type { WorkerMessage, WorkerRequest } from "./types.js";

interface Shape { required: string[]; properties: Record<string, unknown> }

export class ProtocolValidator {
  private constructor(private readonly progressShape: Shape, private readonly resultShape: Shape) {}
  static async fromSchemaDirectory(directory: string): Promise<ProtocolValidator> {
    const load = async (name: string) => JSON.parse(await readFile(path.join(directory, name), "utf8")) as Shape;
    return new ProtocolValidator(await load("worker-progress.schema.json"), await load("worker-result.schema.json"));
  }
  validateShape(value: unknown): WorkerMessage {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkerProtocolError("Worker message must be an object.");
    const object = value as Record<string, unknown>;
    const shape = object.messageType === "WORKER_PROGRESS" ? this.progressShape : object.messageType === "WORKER_RESULT" ? this.resultShape : null;
    if (!shape) throw new WorkerProtocolError("Worker emitted an unknown message type.");
    for (const field of shape.required) if (!(field in object)) throw new WorkerProtocolError(`Worker message is missing ${field}.`);
    for (const field of Object.keys(object)) if (!(field in shape.properties)) throw new WorkerProtocolError(`Worker message contains unknown field ${field}.`);
    if (!Number.isSafeInteger(object.sequence) || (object.sequence as number) < 0) throw new WorkerProtocolError("Worker sequence is invalid.");
    return object as WorkerMessage;
  }
  validateOwnership(message: WorkerMessage, request: WorkerRequest): void {
    for (const field of ["contractVersion", "correlationId", "jobId", "attemptId"] as const) {
      if (message[field] !== request[field]) throw new WorkerProtocolError(`Worker ${field} does not match the active request.`);
    }
    if (message.messageType === "WORKER_RESULT") {
      const result = message.result as Record<string, unknown> | null;
      if (message.outcome === "SUCCEEDED" && (!result || result.operation !== request.operation)) throw new WorkerProtocolError("Worker result operation does not match the request.");
      if (message.providerDescriptor && (message.providerDescriptor as Record<string, unknown>).providerId !== request.provider.providerId) throw new WorkerProtocolError("Worker provider identity does not match the request.");
      if (result && request.operation.endsWith("_ACQUISITION")) {
        if (result.executionId !== request.payload.executionId) throw new WorkerProtocolError("Worker execution identity does not match the request.");
        if (result.providerId !== request.provider.providerId || result.providerVersion !== request.provider.providerVersion) throw new WorkerProtocolError("Worker acquisition provider does not match the request.");
        if (result.capability !== request.payload.capability) throw new WorkerProtocolError("Worker acquisition capability does not match the request.");
        const allocations = new Map(((request.payload.artifactAllocations as Array<Record<string, unknown>>) ?? []).map(value => [value.artifactId, value]));
        const artifacts = (result.artifacts as Array<Record<string, unknown>>) ?? []; const seen = new Set<unknown>();
        for (const artifact of artifacts) {
          const allocation = allocations.get(artifact.artifactId); if (!allocation || seen.has(artifact.artifactId)) throw new WorkerProtocolError("Worker returned an unknown or duplicate artifact allocation.");
          if (artifact.role !== allocation.role || artifact.mediaType !== allocation.mediaType || artifact.stagingKey !== allocation.stagingKey) throw new WorkerProtocolError("Worker artifact authority does not match its allocation.");
          seen.add(artifact.artifactId);
        }
      }
      if (result && ["HTML_EXTRACTION","DOCUMENT_EXTRACTION","DOCUMENT_INSPECTION"].includes(request.operation)) {
        if (result.executionId !== request.payload.executionId || result.providerId !== request.provider.providerId || result.providerVersion !== request.provider.providerVersion || result.capability !== request.payload.capability || result.policyVersion !== request.payload.policyVersion) throw new WorkerProtocolError("Worker extraction authority does not match the request.");
        const allocations=new Map(((request.payload.outputAllocations as Array<Record<string,unknown>>)??[]).map(value=>[value.artifactId,value]));const seen=new Set<unknown>();
        for(const artifact of ((result.artifacts as Array<Record<string,unknown>>)??[])){const allocation=allocations.get(artifact.artifactId);if(!allocation||seen.has(artifact.artifactId)||artifact.role!==allocation.role||artifact.mediaType!==allocation.mediaType||artifact.stagingKey!==allocation.stagingKey)throw new WorkerProtocolError("Worker extraction artifact violates its allocation.");seen.add(artifact.artifactId)}
      }
      this.validateStagingReferences(result, request.policySnapshot.stagingPrefix);
    }
  }
  private validateStagingReferences(value: unknown, prefix: string): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const item of value) this.validateStagingReferences(item, prefix); return; }
    const object = value as Record<string, unknown>;
    if (object.artifactClass === "STAGING" && (typeof object.key !== "string" || !(object.key === prefix || object.key.startsWith(`${prefix}/`)))) {
      throw new WorkerProtocolError("Worker output is outside the allocated staging prefix.");
    }
    for (const nested of Object.values(object)) this.validateStagingReferences(nested, prefix);
  }
}
