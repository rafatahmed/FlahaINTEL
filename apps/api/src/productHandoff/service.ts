/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Product Handoff + Feed Policy Service (4I-B / 4B-A)
 * Introduction:
 * Builds APPROVED-only handoff envelopes under admin feed policies; audits exports.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import type { KnowledgePackTheme, Prisma, PrismaClient } from "@prisma/client";
import {
  buildHandoffEnvelope,
  DEFAULT_THEME_TO_PRODUCT,
  envelopeSha256,
  HANDOFF_ENVELOPE_VERSION,
  isSisterProductTarget,
  SISTER_PRODUCTS,
  type ProductHandoffEnvelope,
  type SisterProductTarget,
} from "./envelope.js";

export class ProductHandoffError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "ProductHandoffError";
  }
}

const DEFAULT_POLICIES: Array<{
  targetProduct: SisterProductTarget;
  allowedThemes: string[];
  allowMarketContext: boolean;
  allowComparisonNotes: boolean;
  notes: string;
}> = [
  {
    targetProduct: "FlahaCALC",
    allowedThemes: ["IRRIGATION"],
    allowMarketContext: false,
    allowComparisonNotes: false,
    notes: "Irrigation/weather only. Never NUTRITION or SOIL in CALC handoff.",
  },
  {
    targetProduct: "FlahaFAST",
    allowedThemes: ["NUTRITION"],
    allowMarketContext: false,
    allowComparisonNotes: false,
    notes: "Nutrient management only. Never IRRIGATION or SOIL in FAST handoff.",
  },
  {
    targetProduct: "FlahaSOIL",
    allowedThemes: ["SOIL"],
    allowMarketContext: false,
    allowComparisonNotes: true,
    notes: "Soil packs + optional comparison notes. Never auto-write FlahaSOIL.",
  },
];

export class ProductHandoffService {
  constructor(private readonly db: PrismaClient) {}

  /** Ensure default 4B-A policies exist for tenant (idempotent). */
  async ensureDefaultPolicies(tenantId: string, updatedById?: string) {
    for (const def of DEFAULT_POLICIES) {
      await this.db.productFeedPolicy.upsert({
        where: {
          tenantId_targetProduct: { tenantId, targetProduct: def.targetProduct },
        },
        create: {
          tenantId,
          targetProduct: def.targetProduct,
          allowedThemes: def.allowedThemes,
          requireApprovedPacks: true,
          allowMarketContext: def.allowMarketContext,
          allowComparisonNotes: def.allowComparisonNotes,
          enabled: true,
          notes: def.notes,
          updatedById: updatedById ?? null,
        },
        update: {},
      });
    }
    return this.listPolicies(tenantId);
  }

  async listPolicies(tenantId: string) {
    await this.ensureDefaultPolicies(tenantId);
    return this.db.productFeedPolicy.findMany({
      where: { tenantId },
      orderBy: { targetProduct: "asc" },
    });
  }

  async updatePolicy(params: {
    tenantId: string;
    targetProduct: string;
    updatedById: string;
    allowedThemes?: string[];
    requireApprovedPacks?: boolean;
    allowMarketContext?: boolean;
    allowComparisonNotes?: boolean;
    enabled?: boolean;
    notes?: string | null;
  }) {
    if (!isSisterProductTarget(params.targetProduct)) {
      throw new ProductHandoffError(
        "INVALID_TARGET",
        "targetProduct must be FlahaCALC | FlahaFAST | FlahaSOIL.",
      );
    }
    await this.ensureDefaultPolicies(params.tenantId, params.updatedById);
    const themes = params.allowedThemes?.map((t) => t.trim().toUpperCase()).filter(Boolean);
    if (themes) {
      const valid = new Set([
        "SOIL",
        "IRRIGATION",
        "NUTRITION",
        "DIGITAL_PLATFORM",
        "MARKET_CONTEXT",
        "OTHER",
      ]);
      for (const t of themes) {
        if (!valid.has(t)) {
          throw new ProductHandoffError("INVALID_THEME", `Unknown theme ${t}.`);
        }
      }
      // Hard guard: never allow cross-product default themes on wrong target
      if (params.targetProduct === "FlahaCALC" && themes.includes("NUTRITION")) {
        throw new ProductHandoffError(
          "POLICY_CROSS_PRODUCT",
          "FlahaCALC policy cannot include NUTRITION (use FlahaFAST).",
        );
      }
      if (params.targetProduct === "FlahaFAST" && themes.includes("IRRIGATION")) {
        throw new ProductHandoffError(
          "POLICY_CROSS_PRODUCT",
          "FlahaFAST policy cannot include IRRIGATION (use FlahaCALC).",
        );
      }
    }

    return this.db.productFeedPolicy.update({
      where: {
        tenantId_targetProduct: {
          tenantId: params.tenantId,
          targetProduct: params.targetProduct,
        },
      },
      data: {
        ...(themes ? { allowedThemes: themes } : {}),
        ...(params.requireApprovedPacks !== undefined
          ? { requireApprovedPacks: params.requireApprovedPacks }
          : {}),
        ...(params.allowMarketContext !== undefined
          ? { allowMarketContext: params.allowMarketContext }
          : {}),
        ...(params.allowComparisonNotes !== undefined
          ? { allowComparisonNotes: params.allowComparisonNotes }
          : {}),
        ...(params.enabled !== undefined ? { enabled: params.enabled } : {}),
        ...(params.notes !== undefined ? { notes: params.notes } : {}),
        updatedById: params.updatedById,
      },
    });
  }

  private async resolveTenantCode(tenantId: string): Promise<string> {
    const t = await this.db.tenant.findUnique({ where: { id: tenantId }, select: { code: true } });
    if (!t) throw new ProductHandoffError("TENANT_NOT_FOUND", "Tenant not found.", 404);
    return t.code;
  }

  /**
   * Export handoff envelope for one sister product from APPROVED packs only.
   */
  async exportHandoff(params: {
    tenantId: string;
    exportedById: string;
    exportedByEmail?: string;
    targetProduct: string;
    packIds?: string[];
    packCodes?: string[];
  }): Promise<{ exportId: string; envelope: ProductHandoffEnvelope; sha256: string }> {
    if (!isSisterProductTarget(params.targetProduct)) {
      throw new ProductHandoffError(
        "INVALID_TARGET",
        "targetProduct must be FlahaCALC | FlahaFAST | FlahaSOIL.",
      );
    }
    const target = params.targetProduct;
    const policies = await this.ensureDefaultPolicies(params.tenantId, params.exportedById);
    const policy = policies.find((p) => p.targetProduct === target);
    if (!policy || !policy.enabled) {
      throw new ProductHandoffError(
        "POLICY_DISABLED",
        `Feed policy for ${target} is missing or disabled.`,
        409,
      );
    }

    let allowedThemes = [...policy.allowedThemes];
    if (policy.allowMarketContext && !allowedThemes.includes("MARKET_CONTEXT")) {
      allowedThemes.push("MARKET_CONTEXT");
    }

    const where: Prisma.KnowledgePackWhereInput = {
      tenantId: params.tenantId,
      reviewState: policy.requireApprovedPacks ? "APPROVED" : undefined,
      theme: { in: allowedThemes as KnowledgePackTheme[] },
    };
    if (params.packIds?.length) {
      where.id = { in: params.packIds };
    } else if (params.packCodes?.length) {
      where.code = { in: params.packCodes.map((c) => c.trim().toLowerCase()) };
    }

    const packs = await this.db.knowledgePack.findMany({
      where,
      include: { items: { orderBy: { sequence: "asc" } } },
      orderBy: { code: "asc" },
    });

    if (!packs.length) {
      throw new ProductHandoffError(
        "NO_APPROVED_PACKS",
        `No packs eligible for ${target} handoff (need APPROVED packs with themes: ${allowedThemes.join(", ")}).`,
        404,
      );
    }

    // Reject any pack whose theme maps to a different default product (defense in depth).
    for (const pack of packs) {
      const mapped = DEFAULT_THEME_TO_PRODUCT[pack.theme];
      if (mapped && mapped !== target && pack.theme !== "MARKET_CONTEXT") {
        throw new ProductHandoffError(
          "THEME_TARGET_MISMATCH",
          `Pack ${pack.code} theme ${pack.theme} maps to ${mapped}, not ${target}.`,
        );
      }
      if (policy.requireApprovedPacks && pack.reviewState !== "APPROVED") {
        throw new ProductHandoffError(
          "PACK_NOT_APPROVED",
          `Pack ${pack.code} is ${pack.reviewState}; only APPROVED packs export.`,
        );
      }
    }

    const tenantCode = await this.resolveTenantCode(params.tenantId);
    const envelope = buildHandoffEnvelope({
      tenantCode,
      target,
      packs,
      exportedByUserId: params.exportedById,
      exportedByEmail: params.exportedByEmail,
      feedPolicyEnforced: true,
      includeComparisonNotes: policy.allowComparisonNotes,
    });
    assertEnvelopeInvariants(envelope);
    const sha256 = envelopeSha256(envelope);

    const row = await this.db.productHandoffExport.create({
      data: {
        tenantId: params.tenantId,
        exportedById: params.exportedById,
        targetProduct: target,
        envelopeVersion: HANDOFF_ENVELOPE_VERSION,
        envelopeSha256: sha256,
        packCodes: packs.map((p) => p.code),
        packIds: packs.map((p) => p.id),
        envelope: envelope as unknown as Prisma.InputJsonValue,
      },
    });

    return { exportId: row.id, envelope, sha256 };
  }

  async listExports(tenantId: string, limit = 50) {
    return this.db.productHandoffExport.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        targetProduct: true,
        envelopeVersion: true,
        envelopeSha256: true,
        packCodes: true,
        packIds: true,
        createdAt: true,
        exportedById: true,
      },
    });
  }

  async getExport(tenantId: string, id: string) {
    const row = await this.db.productHandoffExport.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new ProductHandoffError("EXPORT_NOT_FOUND", "Handoff export not found.", 404);
    return row;
  }

  /**
   * 4B-B PA scorecard: pack health, market freshness, review queues, handoff readiness.
   */
  async paDashboard(tenantId: string) {
    await this.ensureDefaultPolicies(tenantId);
    const [
      packByState,
      packByTheme,
      marketPending,
      marketApproved,
      channels,
      soilReady,
      soilApproved,
      exportsLast7d,
      policies,
    ] = await Promise.all([
      this.db.knowledgePack.groupBy({
        by: ["reviewState"],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.db.knowledgePack.groupBy({
        by: ["theme", "reviewState"],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.db.marketPriceObservation.count({
        where: { tenantId, reviewState: "PENDING_REVIEW" },
      }),
      this.db.marketPriceObservation.count({
        where: { tenantId, reviewState: "APPROVED" },
      }),
      this.db.marketChannel.findMany({
        where: { enabled: true },
        select: { code: true, name: true, countryCode: true, harvestIntervalDays: true },
      }),
      this.db.flahaSoilComparisonCase.count({
        where: { tenantId, status: "READY_FOR_REVIEW" },
      }),
      this.db.flahaSoilComparisonCase.count({
        where: { tenantId, status: "APPROVED" },
      }),
      this.db.productHandoffExport.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.db.productFeedPolicy.findMany({ where: { tenantId } }),
    ]);

    // Last observation per channel (freshness)
    const channelFreshness = await Promise.all(
      channels.map(async (ch) => {
        const last = await this.db.marketPriceObservation.findFirst({
          where: { tenantId, channel: { code: ch.code } },
          orderBy: { observedOn: "desc" },
          select: { observedOn: true },
        });
        const lastDay = last?.observedOn ? last.observedOn.toISOString().slice(0, 10) : null;
        const ageDays =
          lastDay != null
            ? Math.floor((Date.now() - new Date(`${lastDay}T00:00:00.000Z`).getTime()) / 86_400_000)
            : null;
        return {
          channelCode: ch.code,
          name: ch.name,
          countryCode: ch.countryCode,
          harvestIntervalDays: ch.harvestIntervalDays,
          lastObservedOn: lastDay,
          ageDays,
          stale:
            ageDays == null
              ? true
              : ageDays > Math.max(ch.harvestIntervalDays * 2, 3),
        };
      }),
    );

    const packsApproved = packByState.find((r) => r.reviewState === "APPROVED")?._count._all ?? 0;
    const packsReady = packByState.find((r) => r.reviewState === "READY_FOR_REVIEW")?._count._all ?? 0;
    const packsDraft = packByState.find((r) => r.reviewState === "DRAFT")?._count._all ?? 0;

    const handoffReadyByTarget = SISTER_PRODUCTS.map((target) => {
      const policy = policies.find((p) => p.targetProduct === target);
      const themes = new Set(policy?.allowedThemes ?? []);
      const approved = packByTheme
        .filter((r) => r.reviewState === "APPROVED" && themes.has(r.theme))
        .reduce((n, r) => n + r._count._all, 0);
      return {
        targetProduct: target,
        policyEnabled: policy?.enabled ?? false,
        allowedThemes: policy?.allowedThemes ?? [],
        approvedPackCount: approved,
        canExport: Boolean(policy?.enabled && approved > 0),
      };
    });

    return {
      gate: "4B-B",
      generatedAt: new Date().toISOString(),
      packs: {
        draft: packsDraft,
        readyForReview: packsReady,
        approved: packsApproved,
        byThemeReview: packByTheme.map((r) => ({
          theme: r.theme,
          reviewState: r.reviewState,
          count: r._count._all,
        })),
      },
      markets: {
        pendingReview: marketPending,
        approved: marketApproved,
        channelFreshness,
        staleChannelCount: channelFreshness.filter((c) => c.stale).length,
      },
      soil: {
        readyForReview: soilReady,
        approved: soilApproved,
      },
      handoff: {
        exportsLast7d,
        byTarget: handoffReadyByTarget,
      },
      policies: policies.map((p) => ({
        targetProduct: p.targetProduct,
        enabled: p.enabled,
        allowedThemes: p.allowedThemes,
        requireApprovedPacks: p.requireApprovedPacks,
      })),
      governance: {
        autoApplyBlocked: true,
        humanOnly: true,
      },
    };
  }
}

function assertEnvelopeInvariants(envelope: ProductHandoffEnvelope) {
  if (!envelope.autoApplyBlocked) {
    throw new ProductHandoffError("ENVELOPE_INVALID", "autoApplyBlocked must be true.");
  }
  if (envelope.targets.length !== 1) {
    throw new ProductHandoffError("ENVELOPE_INVALID", "Exactly one target product required.");
  }
  for (const p of envelope.sourcePacks) {
    if (p.reviewState !== "APPROVED") {
      throw new ProductHandoffError("ENVELOPE_INVALID", `Pack ${p.code} not APPROVED in envelope.`);
    }
  }
}
