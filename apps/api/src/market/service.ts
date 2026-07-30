/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Channel and Price Service
 * Introduction: Upserts global market channels and tenant price observations (Gates 4M-0 / 4M-A).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { PrismaClient, SourceAuthorityType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  channelCode,
  MarketValidationError,
  normalizeCommodityCode,
  normalizeCountryCode,
  normalizeCurrency,
  normalizeMarketCode,
  parseObservedOn,
  priceContentFingerprint,
  requireEvidence,
  requirePrice,
} from "./validation.js";

export type UpsertChannelInput = {
  countryCode: string;
  marketCode: string;
  name: string;
  publisher: string;
  officialUrl: string;
  homepageUrl?: string | null;
  evidenceUrl?: string | null;
  ownershipVerified?: boolean;
  authorityType?: SourceAuthorityType | null;
  verificationStatus?: "PENDING" | "ACCEPTED" | "DEGRADED" | "REJECTED";
  enabled?: boolean;
  language?: string;
  currencyDefault?: string;
  notes?: string | null;
};

export type PriceRowInput = {
  observedOn: string;
  commodityName: string;
  commodityCode?: string;
  originLabel?: string | null;
  unit: string;
  packDescription?: string;
  packPrice?: number | null;
  unitPrice?: number | null;
  currency?: string;
  evidenceUrl?: string | null;
  evidenceArtifactId?: string | null;
};

export class MarketService {
  constructor(private readonly db: PrismaClient) {}

  async upsertChannel(input: UpsertChannelInput) {
    const countryCode = normalizeCountryCode(input.countryCode);
    const marketCode = normalizeMarketCode(input.marketCode);
    const code = channelCode(countryCode, marketCode);
    const currencyDefault = normalizeCurrency(input.currencyDefault ?? "QAR");
    if (!input.name?.trim() || !input.publisher?.trim() || !input.officialUrl?.trim()) {
      throw new MarketValidationError("INVALID_CHANNEL", "name, publisher, and officialUrl are required.");
    }
    requireEvidence({ evidenceUrl: input.evidenceUrl ?? input.officialUrl, evidenceArtifactId: null });

    return this.db.marketChannel.upsert({
      where: { code },
      create: {
        code,
        countryCode,
        marketCode,
        name: input.name.trim(),
        publisher: input.publisher.trim(),
        authorityType: input.authorityType ?? "GOVERNMENT_AGENCY",
        officialUrl: input.officialUrl.trim(),
        homepageUrl: input.homepageUrl?.trim() || null,
        evidenceUrl: input.evidenceUrl?.trim() || input.officialUrl.trim(),
        ownershipVerified: input.ownershipVerified ?? false,
        verificationStatus: input.verificationStatus ?? "PENDING",
        enabled: input.enabled ?? true,
        language: input.language?.trim() || "en",
        currencyDefault,
        notes: input.notes?.trim() || null,
      },
      update: {
        name: input.name.trim(),
        publisher: input.publisher.trim(),
        authorityType: input.authorityType ?? "GOVERNMENT_AGENCY",
        officialUrl: input.officialUrl.trim(),
        homepageUrl: input.homepageUrl?.trim() || null,
        evidenceUrl: input.evidenceUrl?.trim() || input.officialUrl.trim(),
        ownershipVerified: input.ownershipVerified ?? false,
        verificationStatus: input.verificationStatus ?? "PENDING",
        enabled: input.enabled ?? true,
        language: input.language?.trim() || "en",
        currencyDefault,
        notes: input.notes?.trim() || null,
      },
    });
  }

  async listChannels(filter?: { countryCode?: string }) {
    return this.db.marketChannel.findMany({
      where: filter?.countryCode ? { countryCode: normalizeCountryCode(filter.countryCode) } : undefined,
      orderBy: [{ countryCode: "asc" }, { marketCode: "asc" }],
    });
  }

  async recordPriceBatch(params: {
    tenantId: string;
    createdById: string;
    channelCode: string;
    sourceBatchId: string;
    correlationId?: string;
    rows: PriceRowInput[];
  }) {
    if (!params.rows.length) {
      throw new MarketValidationError("EMPTY_BATCH", "At least one price row is required.");
    }
    const channel = await this.db.marketChannel.findUnique({ where: { code: params.channelCode } });
    if (!channel) throw new MarketValidationError("CHANNEL_NOT_FOUND", `Unknown channel ${params.channelCode}.`);
    if (!channel.enabled) throw new MarketValidationError("CHANNEL_DISABLED", "Channel is disabled.");

    const created = [];
    for (const row of params.rows) {
      requireEvidence(row);
      requirePrice(row.packPrice ?? null, row.unitPrice ?? null);
      const observedOn = parseObservedOn(row.observedOn);
      const commodityCode = normalizeCommodityCode(row.commodityCode || row.commodityName);
      const currency = normalizeCurrency(row.currency || channel.currencyDefault);
      const unit = row.unit.trim();
      if (!unit) throw new MarketValidationError("INVALID_UNIT", "unit is required.");
      const packDescription = (row.packDescription ?? "").trim();
      const packPrice =
        row.packPrice == null ? null : new Prisma.Decimal(row.packPrice.toFixed(4));
      const unitPrice =
        row.unitPrice == null ? null : new Prisma.Decimal(row.unitPrice.toFixed(4));
      const fingerprint = priceContentFingerprint({
        channelCode: channel.code,
        observedOn: row.observedOn,
        commodityCode,
        unit,
        currency,
        packDescription,
        packPrice: packPrice?.toFixed(4) ?? null,
        unitPrice: unitPrice?.toFixed(4) ?? null,
      });

      const observation = await this.db.marketPriceObservation.upsert({
        where: {
          channelId_observedOn_commodityCode_unit_currency_packDescription: {
            channelId: channel.id,
            observedOn,
            commodityCode,
            unit,
            currency,
            packDescription,
          },
        },
        create: {
          tenantId: params.tenantId,
          channelId: channel.id,
          observedOn,
          commodityCode,
          commodityName: row.commodityName.trim(),
          originLabel: row.originLabel?.trim() || null,
          unit,
          packDescription,
          packPrice,
          unitPrice,
          currency,
          evidenceUrl: row.evidenceUrl?.trim() || null,
          evidenceArtifactId: row.evidenceArtifactId || null,
          sourceBatchId: params.sourceBatchId,
          contentFingerprint: fingerprint,
          createdById: params.createdById,
          correlationId: params.correlationId || null,
        },
        update: {
          commodityName: row.commodityName.trim(),
          originLabel: row.originLabel?.trim() || null,
          packPrice,
          unitPrice,
          evidenceUrl: row.evidenceUrl?.trim() || null,
          evidenceArtifactId: row.evidenceArtifactId || null,
          sourceBatchId: params.sourceBatchId,
          contentFingerprint: fingerprint,
          reviewState: "PENDING_REVIEW",
          reviewedById: null,
          reviewedAt: null,
          reviewNote: null,
          correlationId: params.correlationId || null,
        },
      });
      created.push(observation);
    }
    return { channel, count: created.length, rows: created };
  }

  async listPrices(params: {
    tenantId: string;
    countryCode?: string;
    channelCode?: string;
    commodityCode?: string;
    from?: string;
    to?: string;
    reviewState?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
    limit?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
    return this.db.marketPriceObservation.findMany({
      where: {
        tenantId: params.tenantId,
        reviewState: params.reviewState,
        commodityCode: params.commodityCode ? normalizeCommodityCode(params.commodityCode) : undefined,
        observedOn: {
          gte: params.from ? parseObservedOn(params.from) : undefined,
          lte: params.to ? parseObservedOn(params.to) : undefined,
        },
        channel: {
          code: params.channelCode,
          countryCode: params.countryCode ? normalizeCountryCode(params.countryCode) : undefined,
        },
      },
      include: { channel: true },
      orderBy: [{ observedOn: "desc" }, { commodityCode: "asc" }],
      take: limit,
    });
  }

  async reviewPrice(params: {
    tenantId: string;
    priceId: string;
    reviewerId: string;
    reviewState: "APPROVED" | "REJECTED";
    note?: string;
  }) {
    const existing = await this.db.marketPriceObservation.findFirst({
      where: { id: params.priceId, tenantId: params.tenantId },
    });
    if (!existing) throw new MarketValidationError("PRICE_NOT_FOUND", "Price observation not found in tenant.");
    return this.db.marketPriceObservation.update({
      where: { id: existing.id },
      data: {
        reviewState: params.reviewState,
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
        reviewNote: params.note?.trim() || null,
      },
    });
  }
}
