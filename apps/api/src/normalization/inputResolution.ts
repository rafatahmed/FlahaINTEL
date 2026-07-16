/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Normalization Input Resolution
 * Introduction: Resolves and verifies canonical extraction artifacts for Phase 3J normalization.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import type { InputRole, NormalizationCommand, NormalizationProfile, ResolvedInputArtifact, ResolvedNormalizationInputs } from "./contracts.js";
import { getProfile, profileHash } from "./profiles.js";

const ROLE_ORDER: InputRole[] = ["EXTRACTED_TEXT", "STRUCTURE", "METADATA", "TABLE", "RESULT"];
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function roleRank(role: string): number {
  const index = ROLE_ORDER.indexOf(role as InputRole);
  return index === -1 ? 99 : index;
}

async function readAll(store: FilesystemArtifactStore, artifactId: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of store.read(artifactId, { verifyChecksum: true })) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseMaybeJson(bytes: Buffer, mediaType: string): { json: unknown | null; text: string | null } {
  const text = bytes.toString("utf8");
  if (mediaType.includes("json") || text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
    try {
      return { json: JSON.parse(text), text };
    } catch {
      return { json: null, text };
    }
  }
  return { json: null, text };
}

export async function resolveNormalizationInputs(
  db: PrismaClient,
  store: FilesystemArtifactStore,
  command: NormalizationCommand,
): Promise<ResolvedNormalizationInputs> {
  if (!/^[0-9a-f-]{36}$/i.test(command.extractionJobId)) throw new Error("INVALID_EXTRACTION_JOB");
  if (command.contentType === PPTX) throw new Error("UNSUPPORTED_CONTENT_TYPE");
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(command.contentType) || command.contentType.includes("..") || command.contentType.includes("\\")) {
    throw new Error("INVALID_CONTENT_TYPE");
  }
  if (command.language.toLowerCase() === "ar") throw new Error("UNSUPPORTED_LANGUAGE");

  let profile: NormalizationProfile;
  try {
    profile = getProfile(command.profileId, command.profileVersion);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROFILE_UNAVAILABLE";
    throw new Error(message === "PROFILE_VERSION_MISMATCH" ? "PROFILE_VERSION_MISMATCH" : "PROFILE_UNAVAILABLE");
  }

  if (!profile.allowedMediaTypes.includes(command.contentType)) throw new Error("UNSUPPORTED_CONTENT_TYPE");
  if (!profile.allowedLanguages.includes(command.language.toLowerCase()) && command.language.toLowerCase() !== "en") {
    // non-en without explicit allow is review/unsupported for authoritative paths
    if (command.language.toLowerCase() !== "en") throw new Error("UNSUPPORTED_LANGUAGE");
  }

  const extractionJob = await db.ingestionJob.findUnique({ where: { id: command.extractionJobId } });
  if (!extractionJob) throw new Error("EXTRACTION_JOB_NOT_FOUND");
  if (extractionJob.state !== "SUCCEEDED") throw new Error("EXTRACTION_JOB_NOT_SUCCEEDED");
  if (extractionJob.mediaType !== command.contentType) throw new Error("UNSUPPORTED_CONTENT_TYPE");

  const links = await db.ingestionArtifactLink.findMany({
    where: { jobId: command.extractionJobId },
    orderBy: [{ relationship: "asc" }, { artifactId: "asc" }],
  });
  if (!links.length) throw new Error("EXTRACTION_ARTIFACTS_MISSING");

  const requested = command.sourceArtifactIds?.length
    ? [...command.sourceArtifactIds].sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.artifactId.localeCompare(b.artifactId))
    : links
        .filter(l => ROLE_ORDER.includes(l.relationship as InputRole))
        .map(l => ({ artifactId: l.artifactId, role: l.relationship as InputRole }))
        .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.artifactId.localeCompare(b.artifactId));

  const byRole = new Map<InputRole, ResolvedInputArtifact>();
  for (const item of requested) {
    if (item.role === ("DIAGNOSTIC" as InputRole)) throw new Error("DIAGNOSTIC_NOT_AUTHORITATIVE");
    if (!ROLE_ORDER.includes(item.role)) throw new Error("INVALID_INPUT_ROLE");
    const link = links.find(l => l.artifactId === item.artifactId);
    if (!link) throw new Error("ARTIFACT_NOT_OWNED_BY_EXTRACTION_JOB");
    if (link.relationship !== item.role) throw new Error("ARTIFACT_ROLE_MISMATCH");

    const metadata = await store.metadata(item.artifactId);
    if (metadata.state === "QUARANTINED") throw new Error("QUARANTINED_INPUT");
    if (metadata.state !== "PROMOTED" || !metadata.finalKey || metadata.byteLength === null || !metadata.checksum) {
      throw new Error("ARTIFACT_NOT_IMMUTABLE");
    }
    if (metadata.byteLength !== Number(link.byteSize) || metadata.checksum !== link.sha256) throw new Error("HASH_MISMATCH");
    if (metadata.finalKey.includes("..") || metadata.finalKey.startsWith("/") || /^[A-Za-z]:/.test(metadata.finalKey)) {
      throw new Error("UNSAFE_ARTIFACT_PATH");
    }

    let absolute: string;
    try {
      absolute = await store.verifyPromotedPath(item.artifactId, Number(link.byteSize), link.sha256);
    } catch (error) {
      const message = error instanceof Error ? error.message : "HASH_MISMATCH";
      if (message.includes("not a regular") || message.includes("symbolic") || message.includes("reparse")) throw new Error("SYMLINK_OR_REPARSE_ESCAPE");
      throw new Error("HASH_MISMATCH");
    }
    void absolute;

    let bytes: Buffer;
    try {
      bytes = await readAll(store, item.artifactId);
    } catch {
      throw new Error("TRANSIENT_ARTIFACT_READ_FAILURE");
    }
    if (bytes.length !== Number(link.byteSize) || createHash("sha256").update(bytes).digest("hex") !== link.sha256) {
      throw new Error("HASH_MISMATCH");
    }

    const parsed = parseMaybeJson(bytes, link.mediaType);
    byRole.set(item.role, {
      artifactId: item.artifactId,
      role: item.role,
      mediaType: link.mediaType,
      byteLength: Number(link.byteSize),
      checksum: link.sha256,
      key: metadata.finalKey,
      bytes,
      json: parsed.json,
      text: parsed.text,
    });
  }

  for (const role of profile.requiredRoles) {
    if (!byRole.has(role)) throw new Error(`REQUIRED_ARTIFACT_MISSING:${role}`);
  }

  const artifacts = [...byRole.values()].sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.artifactId.localeCompare(b.artifactId));

  // Acquisition lineage: extraction input may reference an acquisition artifact; walk optional job link.
  let sourceAcquisitionJobId: string | null = null;
  let acquisitionMetadata: Record<string, unknown> | null = null;
  if (extractionJob.inputArtifactId) {
    const acquisitionLink = await db.ingestionArtifactLink.findFirst({
      where: { artifactId: extractionJob.inputArtifactId, relationship: { in: ["RAW_RESPONSE", "RENDERED_HTML", "INPUT"] } },
      orderBy: { createdAt: "asc" },
    });
    if (acquisitionLink) {
      const acquisitionJob = await db.ingestionJob.findUnique({ where: { id: acquisitionLink.jobId } });
      if (acquisitionJob && (acquisitionJob.jobType === "STATIC_ACQUISITION" || acquisitionJob.jobType === "BROWSER_ACQUISITION")) {
        sourceAcquisitionJobId = acquisitionJob.id;
        const metaLink = await db.ingestionArtifactLink.findFirst({
          where: { jobId: acquisitionJob.id, relationship: "METADATA" },
          orderBy: { createdAt: "asc" },
        });
        if (metaLink) {
          try {
            const bytes = await readAll(store, metaLink.artifactId);
            acquisitionMetadata = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
          } catch {
            acquisitionMetadata = null;
          }
        }
      }
    }
  }

  const inputHash = createHash("sha256")
    .update(
      JSON.stringify({
        artifacts: artifacts.map(a => ({ artifactId: a.artifactId, role: a.role, sha256: a.checksum })),
        profileId: profile.profileId,
        profileVersion: profile.profileVersion,
      }),
    )
    .digest("hex");

  void profileHash;

  return {
    extractionJobId: command.extractionJobId,
    sourceAcquisitionJobId,
    contentType: command.contentType,
    language: command.language.toLowerCase(),
    profile,
    artifacts,
    acquisitionMetadata,
    governedSourceMetadata: null,
    inputHash,
  };
}
