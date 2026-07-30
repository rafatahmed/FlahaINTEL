/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Channel and Price Service
 * Introduction: Global markets with rich rows, Jordan daily / Qatar 3-day cadence, 3-day filters.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { PrismaClient, SourceAuthorityType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  assertFilterSpan,
  channelCode,
  convertNativeToCurrency,
  defaultFilterMaxSpanDays,
  defaultHarvestIntervalDays,
  MarketValidationError,
  normalizeCommodityCode,
  normalizeCountryCode,
  normalizeCurrency,
  normalizeMarketCode,
  parseObservedOn,
  priceContentFingerprint,
  QRSH_TO_JOD,
  requireAnyPrice,
  requireEvidence,
  toIsoDate,
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
  harvestIntervalDays?: number;
  filterMaxSpanDays?: number;
  notes?: string | null;
};

export type PriceRowInput = {
  observedOn: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  commodityName: string;
  commodityCode?: string;
  commodityNameAr?: string | null;
  commodityNameEn?: string | null;
  originLabel?: string | null;
  unit: string;
  packDescription?: string;
  packPrice?: number | null;
  unitPrice?: number | null;
  priceHigh?: number | null;
  priceMode?: number | null;
  priceLow?: number | null;
  /** When set with native prices (e.g. QRSH), converts into currency using factor. */
  nativePriceUnit?: string | null;
  nativeToCurrencyFactor?: number | null;
  priceHighNative?: number | null;
  priceModeNative?: number | null;
  priceLowNative?: number | null;
  currency?: string;
  grade?: string | null;
  cultivationMethod?: string | null;
  quantityTons?: number | null;
  evidenceUrl?: string | null;
  evidenceArtifactId?: string | null;
};

function dec(n: number | null | undefined): Prisma.Decimal | null {
  if (n == null || !Number.isFinite(n)) return null;
  return new Prisma.Decimal(Number(n.toFixed(4)));
}

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
    const harvestIntervalDays =
      input.harvestIntervalDays ?? defaultHarvestIntervalDays(countryCode, marketCode);
    const filterMaxSpanDays = input.filterMaxSpanDays ?? defaultFilterMaxSpanDays(countryCode);
    if (harvestIntervalDays < 1 || filterMaxSpanDays < 1) {
      throw new MarketValidationError("INVALID_CADENCE", "harvestIntervalDays and filterMaxSpanDays must be >= 1.");
    }

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
        harvestIntervalDays,
        filterMaxSpanDays,
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
        harvestIntervalDays,
        filterMaxSpanDays,
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

  /**
   * Validates a filter window for product pulls (owner rule: up to 3 days).
   * Jordan can be queried daily; still use span <= filterMaxSpanDays when pulling ranges.
   */
  assertChannelFilterWindow(channelCodeValue: string, from: string, to: string) {
    return this.db.marketChannel.findUnique({ where: { code: channelCodeValue } }).then((ch) => {
      if (!ch) throw new MarketValidationError("CHANNEL_NOT_FOUND", `Unknown channel ${channelCodeValue}.`);
      assertFilterSpan(from, to, ch.filterMaxSpanDays);
      return ch;
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
      const observedOn = parseObservedOn(row.observedOn);
      const periodFrom = row.periodFrom ? parseObservedOn(row.periodFrom) : null;
      const periodTo = row.periodTo ? parseObservedOn(row.periodTo) : null;
      if (periodFrom && periodTo) assertFilterSpan(toIsoDate(periodFrom), toIsoDate(periodTo), 366);

      const commodityCode = normalizeCommodityCode(row.commodityCode || row.commodityNameEn || row.commodityName);
      const currency = normalizeCurrency(row.currency || channel.currencyDefault);
      const unit = row.unit.trim();
      if (!unit) throw new MarketValidationError("INVALID_UNIT", "unit is required.");
      const packDescription = (row.packDescription ?? "").trim();
      const originLabel = (row.originLabel ?? "").trim().toUpperCase();

      let priceHigh = row.priceHigh ?? null;
      let priceMode = row.priceMode ?? null;
      let priceLow = row.priceLow ?? null;
      let unitPrice = row.unitPrice ?? null;
      let packPrice = row.packPrice ?? null;
      const nativeUnit = row.nativePriceUnit?.trim().toUpperCase() || null;
      const factor =
        row.nativeToCurrencyFactor ??
        (nativeUnit === "QRSH" || nativeUnit === "PIASTER" || nativeUnit === "QIRSH" ? QRSH_TO_JOD : null);

      if (factor != null) {
        if (row.priceHighNative != null) priceHigh = convertNativeToCurrency(row.priceHighNative, factor);
        if (row.priceModeNative != null) priceMode = convertNativeToCurrency(row.priceModeNative, factor);
        if (row.priceLowNative != null) priceLow = convertNativeToCurrency(row.priceLowNative, factor);
        // Prefer mode as unit price when Amman-style
        if (unitPrice == null && priceMode != null) unitPrice = priceMode;
      }

      requireAnyPrice({
        packPrice,
        unitPrice,
        priceHigh,
        priceMode,
        priceLow,
        priceHighNative: row.priceHighNative,
        priceModeNative: row.priceModeNative,
        priceLowNative: row.priceLowNative,
      });

      const fingerprint = priceContentFingerprint({
        channelCode: channel.code,
        observedOn: toIsoDate(observedOn),
        commodityCode,
        unit,
        currency,
        packDescription,
        originLabel,
        packPrice: packPrice != null ? packPrice.toFixed(4) : null,
        unitPrice: unitPrice != null ? unitPrice.toFixed(4) : null,
        priceHigh: priceHigh != null ? priceHigh.toFixed(4) : null,
        priceMode: priceMode != null ? priceMode.toFixed(4) : null,
        priceLow: priceLow != null ? priceLow.toFixed(4) : null,
        grade: (row.grade ?? "").trim(),
        cultivationMethod: (row.cultivationMethod ?? "").trim(),
      });

      const nameEn = row.commodityNameEn?.trim() || (channel.language === "en" ? row.commodityName.trim() : null);
      const nameAr = row.commodityNameAr?.trim() || null;

      const observation = await this.db.marketPriceObservation.upsert({
        where: {
          channelId_observedOn_commodityCode_unit_currency_packDescription_originLabel: {
            channelId: channel.id,
            observedOn,
            commodityCode,
            unit,
            currency,
            packDescription,
            originLabel,
          },
        },
        create: {
          tenantId: params.tenantId,
          channelId: channel.id,
          observedOn,
          periodFrom,
          periodTo,
          commodityCode,
          commodityName: row.commodityName.trim(),
          commodityNameAr: nameAr,
          commodityNameEn: nameEn,
          originLabel,
          unit,
          packDescription,
          packPrice: dec(packPrice),
          unitPrice: dec(unitPrice),
          priceHigh: dec(priceHigh),
          priceMode: dec(priceMode),
          priceLow: dec(priceLow),
          nativePriceUnit: nativeUnit,
          nativeToCurrencyFactor: factor != null ? new Prisma.Decimal(factor) : null,
          priceHighNative: dec(row.priceHighNative),
          priceModeNative: dec(row.priceModeNative),
          priceLowNative: dec(row.priceLowNative),
          currency,
          grade: row.grade?.trim() || null,
          cultivationMethod: row.cultivationMethod?.trim() || null,
          quantityTons: row.quantityTons != null ? new Prisma.Decimal(row.quantityTons.toFixed(3)) : null,
          evidenceUrl: row.evidenceUrl?.trim() || null,
          evidenceArtifactId: row.evidenceArtifactId || null,
          sourceBatchId: params.sourceBatchId,
          contentFingerprint: fingerprint,
          createdById: params.createdById,
          correlationId: params.correlationId || null,
        },
        update: {
          periodFrom,
          periodTo,
          commodityName: row.commodityName.trim(),
          commodityNameAr: nameAr,
          commodityNameEn: nameEn,
          packPrice: dec(packPrice),
          unitPrice: dec(unitPrice),
          priceHigh: dec(priceHigh),
          priceMode: dec(priceMode),
          priceLow: dec(priceLow),
          nativePriceUnit: nativeUnit,
          nativeToCurrencyFactor: factor != null ? new Prisma.Decimal(factor) : null,
          priceHighNative: dec(row.priceHighNative),
          priceModeNative: dec(row.priceModeNative),
          priceLowNative: dec(row.priceLowNative),
          grade: row.grade?.trim() || null,
          cultivationMethod: row.cultivationMethod?.trim() || null,
          quantityTons: row.quantityTons != null ? new Prisma.Decimal(row.quantityTons.toFixed(3)) : null,
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
    return {
      channel,
      count: created.length,
      rows: created,
      cadence: {
        harvestIntervalDays: channel.harvestIntervalDays,
        filterMaxSpanDays: channel.filterMaxSpanDays,
        note:
          channel.countryCode === "JO"
            ? "Jordan: daily harvest; product filter window max 3 days."
            : channel.marketCode.includes("mahaseel")
              ? "Qatar Mahaseel: harvest every 3 days; filter window max 3 days."
              : channel.countryCode === "QA"
                ? "Qatar MoCI daily lists: harvest daily; filter window max 3 days."
                : "Use channel harvestIntervalDays and filterMaxSpanDays.",
      },
    };
  }

  async recordDaySummaries(params: {
    tenantId: string;
    channelCode: string;
    observedOn: string;
    originLabel?: string;
    sourceBatchId: string;
    evidenceUrl?: string;
    summaries: Array<{ category: string; quantityTons: number; unitLabel?: string }>;
  }) {
    const channel = await this.db.marketChannel.findUnique({ where: { code: params.channelCode } });
    if (!channel) throw new MarketValidationError("CHANNEL_NOT_FOUND", `Unknown channel ${params.channelCode}.`);
    const observedOn = parseObservedOn(params.observedOn);
    const originLabel = (params.originLabel ?? "").trim().toUpperCase();
    const out = [];
    for (const s of params.summaries) {
      const row = await this.db.marketDaySummary.upsert({
        where: {
          channelId_observedOn_originLabel_category: {
            channelId: channel.id,
            observedOn,
            originLabel,
            category: s.category.trim().toLowerCase(),
          },
        },
        create: {
          tenantId: params.tenantId,
          channelId: channel.id,
          observedOn,
          originLabel,
          category: s.category.trim().toLowerCase(),
          quantityTons: new Prisma.Decimal(s.quantityTons.toFixed(3)),
          unitLabel: s.unitLabel ?? "tons",
          evidenceUrl: params.evidenceUrl ?? null,
          sourceBatchId: params.sourceBatchId,
        },
        update: {
          quantityTons: new Prisma.Decimal(s.quantityTons.toFixed(3)),
          unitLabel: s.unitLabel ?? "tons",
          evidenceUrl: params.evidenceUrl ?? null,
          sourceBatchId: params.sourceBatchId,
        },
      });
      out.push(row);
    }
    return out;
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
    if (params.from && params.to && params.channelCode) {
      await this.assertChannelFilterWindow(params.channelCode, params.from, params.to);
    } else if (params.from && params.to) {
      // Default worldwide filter max 3 days when channel not specified
      assertFilterSpan(params.from, params.to, 3);
    }
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
