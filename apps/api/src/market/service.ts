/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Channel and Price Service
 * Introduction: Global markets with rich rows, cadence, and policy-driven review (auto vs human).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-31
 */
import type { PrismaClient, SourceAuthorityType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  canAutoApproveOfficial,
  parseReviewMode,
  resolveHarvestReview,
  type ChannelReviewMode,
  type PriceReviewDecisionSource,
} from "./reviewPolicy.js";
import {
  dedupeTrendPointsByDay,
  marketSeriesKey,
  marketVariantShortLabel,
  MAX_TREND_POINTS_PER_SERIES,
  MAX_TREND_SERIES,
} from "./seriesIdentity.js";
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
  /** Default HUMAN_REQUIRED. AUTO_APPROVE_OFFICIAL only for trusted official channels. */
  reviewMode?: ChannelReviewMode;
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
    const reviewMode = input.reviewMode ?? "HUMAN_REQUIRED";
    if (reviewMode !== "HUMAN_REQUIRED" && reviewMode !== "AUTO_APPROVE_OFFICIAL") {
      throw new MarketValidationError("INVALID_REVIEW_MODE", "reviewMode must be HUMAN_REQUIRED or AUTO_APPROVE_OFFICIAL.");
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
        reviewMode,
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
        reviewMode,
        notes: input.notes?.trim() || null,
      },
    });
  }

  /**
   * Change channel review policy (governance admin). Does not rewrite historical rows;
   * next harvest/record applies the new policy to new or changed fingerprints.
   */
  async setChannelReviewMode(params: { channelCode: string; reviewMode: ChannelReviewMode }) {
    let mode: ChannelReviewMode;
    try {
      mode = parseReviewMode(params.reviewMode);
    } catch {
      throw new MarketValidationError("INVALID_REVIEW_MODE", "reviewMode must be HUMAN_REQUIRED or AUTO_APPROVE_OFFICIAL.");
    }
    const channel = await this.db.marketChannel.findUnique({ where: { code: params.channelCode } });
    if (!channel) throw new MarketValidationError("CHANNEL_NOT_FOUND", `Unknown channel ${params.channelCode}.`);
    if (mode === "AUTO_APPROVE_OFFICIAL") {
      if (channel.verificationStatus !== "ACCEPTED" || !channel.ownershipVerified) {
        throw new MarketValidationError(
          "AUTO_APPROVE_NOT_ELIGIBLE",
          "AUTO_APPROVE_OFFICIAL requires verificationStatus=ACCEPTED and ownershipVerified=true.",
        );
      }
    }
    return this.db.marketChannel.update({
      where: { id: channel.id },
      data: { reviewMode: mode },
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

    const policyChannel = {
      code: channel.code,
      reviewMode: channel.reviewMode,
      verificationStatus: channel.verificationStatus,
      ownershipVerified: channel.ownershipVerified,
      enabled: channel.enabled,
    };
    const autoEligible = canAutoApproveOfficial(policyChannel);
    const created = [];
    const reviewReasons: Record<string, number> = {};
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

      const uniqueWhere = {
        channelId_observedOn_commodityCode_unit_currency_packDescription_originLabel: {
          channelId: channel.id,
          observedOn,
          commodityCode,
          unit,
          currency,
          packDescription,
          originLabel,
        },
      };

      const existing = await this.db.marketPriceObservation.findUnique({
        where: uniqueWhere,
        select: {
          id: true,
          reviewState: true,
          reviewDecisionSource: true,
          contentFingerprint: true,
          reviewedById: true,
          reviewedAt: true,
          reviewNote: true,
        },
      });

      const harvestReview = resolveHarvestReview({
        channel: policyChannel,
        existing: existing
          ? {
              reviewState: existing.reviewState,
              reviewDecisionSource: existing.reviewDecisionSource,
              contentFingerprint: existing.contentFingerprint,
            }
          : null,
        fingerprint,
      });
      reviewReasons[harvestReview.reason] = (reviewReasons[harvestReview.reason] ?? 0) + 1;

      // When preserving a prior human/policy decision, keep reviewer timestamps/notes.
      const preserve =
        harvestReview.reason.startsWith("preserve_") && existing != null
          ? {
              reviewState: existing.reviewState,
              reviewDecisionSource: existing.reviewDecisionSource,
              reviewedById: existing.reviewedById,
              reviewedAt: existing.reviewedAt,
              reviewNote: existing.reviewNote,
            }
          : {
              reviewState: harvestReview.reviewState,
              reviewDecisionSource: harvestReview.reviewDecisionSource,
              reviewedById: harvestReview.reviewedById,
              reviewedAt: harvestReview.reviewedAt,
              reviewNote: harvestReview.reviewNote,
            };

      const observation = await this.db.marketPriceObservation.upsert({
        where: uniqueWhere,
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
          reviewState: preserve.reviewState,
          reviewDecisionSource: preserve.reviewDecisionSource,
          reviewedById: preserve.reviewedById,
          reviewedAt: preserve.reviewedAt,
          reviewNote: preserve.reviewNote,
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
          reviewState: preserve.reviewState,
          reviewDecisionSource: preserve.reviewDecisionSource,
          reviewedById: preserve.reviewedById,
          reviewedAt: preserve.reviewedAt,
          reviewNote: preserve.reviewNote,
          correlationId: params.correlationId || null,
        },
      });
      created.push(observation);
    }
    return {
      channel,
      count: created.length,
      rows: created,
      reviewPolicy: {
        reviewMode: channel.reviewMode,
        autoApproveEligible: autoEligible,
        decisionBreakdown: reviewReasons,
        note: autoEligible
          ? "Channel policy AUTO_APPROVE_OFFICIAL applied (audit: CHANNEL_POLICY). Admin may switch to HUMAN_REQUIRED."
          : "Rows enter PENDING_REVIEW for human governance (default or policy not eligible).",
      },
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
    reviewDecisionSource?: PriceReviewDecisionSource;
    limit?: number;
  }) {
    if (params.from && params.to) {
      if (params.from > params.to) {
        throw new MarketValidationError("INVALID_DATE_RANGE", "from must be on or before to (YYYY-MM-DD).");
      }
      if (params.channelCode) {
        // Channel-scoped workbench may request wide history (up to 365d).
        assertFilterSpan(params.from, params.to, 365);
      } else {
        assertFilterSpan(params.from, params.to, 3);
      }
    } else if (params.from || params.to) {
      // Partial bounds allowed for workbench; validate format only.
      if (params.from) parseObservedOn(params.from);
      if (params.to) parseObservedOn(params.to);
    }
    const limit = Math.min(Math.max(params.limit ?? 100, 1), 1000);
    return this.db.marketPriceObservation.findMany({
      where: {
        tenantId: params.tenantId,
        reviewState: params.reviewState,
        reviewDecisionSource: params.reviewDecisionSource,
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
      orderBy: [
        { observedOn: "desc" },
        { commodityName: "asc" },
        { grade: "asc" },
        { cultivationMethod: "asc" },
        { commodityCode: "asc" },
      ],
      take: limit,
    });
  }

  /** Queue summary for PA review UI (pending human vs auto-approved counts). */
  async reviewQueueSummary(params: { tenantId: string; channelCode?: string; countryCode?: string }) {
    const channelFilter = {
      code: params.channelCode,
      countryCode: params.countryCode ? normalizeCountryCode(params.countryCode) : undefined,
    };
    const base = {
      tenantId: params.tenantId,
      channel: params.channelCode || params.countryCode ? channelFilter : undefined,
    };
    const [pending, approvedHuman, approvedPolicy, rejected] = await Promise.all([
      this.db.marketPriceObservation.count({ where: { ...base, reviewState: "PENDING_REVIEW" } }),
      this.db.marketPriceObservation.count({
        where: { ...base, reviewState: "APPROVED", reviewDecisionSource: "HUMAN" },
      }),
      this.db.marketPriceObservation.count({
        where: { ...base, reviewState: "APPROVED", reviewDecisionSource: "CHANNEL_POLICY" },
      }),
      this.db.marketPriceObservation.count({ where: { ...base, reviewState: "REJECTED" } }),
    ]);
    return {
      pendingReview: pending,
      approvedByHuman: approvedHuman,
      approvedByChannelPolicy: approvedPolicy,
      rejected,
      total: pending + approvedHuman + approvedPolicy + rejected,
    };
  }

  /**
   * Single-series trend (one grade/method or pack). Prefer priceTrendBundle for workbench overlays.
   * Dedupes same-day points; filters by grade+method identity (not pack alone when both set).
   */
  async priceTrend(params: {
    tenantId: string;
    channelCode: string;
    commodityCode: string;
    from?: string;
    to?: string;
    originLabel?: string;
    grade?: string;
    cultivationMethod?: string;
    packDescription?: string;
    limit?: number;
  }) {
    const channel = await this.db.marketChannel.findUnique({ where: { code: params.channelCode } });
    if (!channel) throw new MarketValidationError("CHANNEL_NOT_FOUND", `Unknown channel ${params.channelCode}.`);
    if (params.from && params.to) {
      if (params.from > params.to) {
        throw new MarketValidationError("INVALID_DATE_RANGE", "from must be on or before to (YYYY-MM-DD).");
      }
      assertFilterSpan(params.from, params.to, Math.max(channel.filterMaxSpanDays, 365));
    } else if (params.from || params.to) {
      if (params.from) parseObservedOn(params.from);
      if (params.to) parseObservedOn(params.to);
    }
    const code = normalizeCommodityCode(params.commodityCode);
    const grade = params.grade?.trim() || undefined;
    const cultivationMethod = params.cultivationMethod?.trim() || undefined;
    // Prefer grade+method filters; packDescription only when no grade/method identity.
    const packDescription =
      grade || cultivationMethod ? undefined : params.packDescription?.trim() || undefined;
    const take = Math.min(Math.max(params.limit ?? MAX_TREND_POINTS_PER_SERIES, 1), 2000);
    const rows = await this.db.marketPriceObservation.findMany({
      where: {
        tenantId: params.tenantId,
        channelId: channel.id,
        commodityCode: code,
        originLabel: params.originLabel?.trim().toUpperCase() || undefined,
        grade: grade || undefined,
        cultivationMethod: cultivationMethod || undefined,
        packDescription: packDescription || undefined,
        observedOn: {
          gte: params.from ? parseObservedOn(params.from) : undefined,
          lte: params.to ? parseObservedOn(params.to) : undefined,
        },
      },
      orderBy: [{ observedOn: "asc" }, { updatedAt: "asc" }],
      take,
    });
    const rawPoints = rows.map((r) => ({
      observedOn: toIsoDate(r.observedOn),
      periodFrom: r.periodFrom ? toIsoDate(r.periodFrom) : null,
      periodTo: r.periodTo ? toIsoDate(r.periodTo) : null,
      unitPrice: r.unitPrice?.toNumber() ?? null,
      priceMode: r.priceMode?.toNumber() ?? null,
      packPrice: r.packPrice?.toNumber() ?? null,
      priceHigh: r.priceHigh?.toNumber() ?? null,
      priceLow: r.priceLow?.toNumber() ?? null,
      currency: r.currency,
      quantityTons: r.quantityTons?.toNumber() ?? null,
      grade: r.grade,
      cultivationMethod: r.cultivationMethod,
      reviewState: r.reviewState,
      value: r.unitPrice?.toNumber() ?? r.priceMode?.toNumber() ?? r.packPrice?.toNumber() ?? null,
    }));
    const points = dedupeTrendPointsByDay(rawPoints);
    return {
      channelCode: channel.code,
      countryCode: channel.countryCode,
      commodityCode: code,
      grade: grade ?? null,
      cultivationMethod: cultivationMethod ?? null,
      packDescription: packDescription ?? null,
      seriesKey: marketSeriesKey({
        commodityCode: code,
        grade,
        cultivationMethod,
        packDescription,
      }),
      pointCount: points.length,
      points,
    };
  }

  /**
   * Multi-series trend for one commodity (all grade/method variants) in one DB read.
   * Workbench uses this so chart series stay synchronized with the master list.
   */
  async priceTrendBundle(params: {
    tenantId: string;
    channelCode: string;
    commodityCode: string;
    from?: string;
    to?: string;
    originLabel?: string;
    /** Optional: only this seriesKey (code|grade|method). */
    seriesKey?: string;
    limitPerSeries?: number;
  }) {
    const channel = await this.db.marketChannel.findUnique({ where: { code: params.channelCode } });
    if (!channel) throw new MarketValidationError("CHANNEL_NOT_FOUND", `Unknown channel ${params.channelCode}.`);
    if (params.from && params.to) {
      if (params.from > params.to) {
        throw new MarketValidationError("INVALID_DATE_RANGE", "from must be on or before to (YYYY-MM-DD).");
      }
      assertFilterSpan(params.from, params.to, Math.max(channel.filterMaxSpanDays, 365));
    } else if (params.from || params.to) {
      if (params.from) parseObservedOn(params.from);
      if (params.to) parseObservedOn(params.to);
    }

    const code = normalizeCommodityCode(params.commodityCode);
    const take = Math.min(Math.max(params.limitPerSeries ?? MAX_TREND_POINTS_PER_SERIES, 1) * MAX_TREND_SERIES, 4000);
    const rows = await this.db.marketPriceObservation.findMany({
      where: {
        tenantId: params.tenantId,
        channelId: channel.id,
        commodityCode: code,
        originLabel: params.originLabel?.trim().toUpperCase() || undefined,
        observedOn: {
          gte: params.from ? parseObservedOn(params.from) : undefined,
          lte: params.to ? parseObservedOn(params.to) : undefined,
        },
      },
      orderBy: [{ observedOn: "asc" }, { grade: "asc" }, { cultivationMethod: "asc" }, { updatedAt: "asc" }],
      take,
    });

    type Acc = {
      key: string;
      grade: string | null;
      cultivationMethod: string | null;
      packDescription: string | null;
      shortLabel: string;
      commodityName: string;
      points: Array<{
        observedOn: string;
        value: number | null;
        unitPrice: number | null;
        priceMode: number | null;
        packPrice: number | null;
        currency: string;
        grade: string | null;
        cultivationMethod: string | null;
        reviewState: string;
        periodFrom: string | null;
        periodTo: string | null;
      }>;
    };

    const byKey = new Map<string, Acc>();
    for (const r of rows) {
      const key = marketSeriesKey({
        commodityCode: code,
        grade: r.grade,
        cultivationMethod: r.cultivationMethod,
        packDescription: r.packDescription,
      });
      if (params.seriesKey && key !== params.seriesKey) continue;
      let acc = byKey.get(key);
      if (!acc) {
        acc = {
          key,
          grade: r.grade,
          cultivationMethod: r.cultivationMethod,
          packDescription: r.packDescription,
          shortLabel: marketVariantShortLabel({
            commodityCode: code,
            grade: r.grade,
            cultivationMethod: r.cultivationMethod,
            packDescription: r.packDescription,
          }),
          commodityName: r.commodityNameEn || r.commodityName,
          points: [],
        };
        byKey.set(key, acc);
      }
      acc.points.push({
        observedOn: toIsoDate(r.observedOn),
        value: r.unitPrice?.toNumber() ?? r.priceMode?.toNumber() ?? r.packPrice?.toNumber() ?? null,
        unitPrice: r.unitPrice?.toNumber() ?? null,
        priceMode: r.priceMode?.toNumber() ?? null,
        packPrice: r.packPrice?.toNumber() ?? null,
        currency: r.currency,
        grade: r.grade,
        cultivationMethod: r.cultivationMethod,
        reviewState: r.reviewState,
        periodFrom: r.periodFrom ? toIsoDate(r.periodFrom) : null,
        periodTo: r.periodTo ? toIsoDate(r.periodTo) : null,
      });
    }

    let series = [...byKey.values()]
      .map((s) => ({
        seriesKey: s.key,
        shortLabel: s.shortLabel,
        label: `${s.commodityName} · ${s.shortLabel}`,
        grade: s.grade,
        cultivationMethod: s.cultivationMethod,
        packDescription: s.packDescription,
        points: dedupeTrendPointsByDay(s.points),
      }))
      .filter((s) => s.points.length > 0)
      .sort((a, b) => a.shortLabel.localeCompare(b.shortLabel, undefined, { numeric: true }));

    const truncated = series.length > MAX_TREND_SERIES;
    if (truncated) series = series.slice(0, MAX_TREND_SERIES);

    return {
      channelCode: channel.code,
      countryCode: channel.countryCode,
      commodityCode: code,
      seriesCount: series.length,
      truncated,
      maxSeries: MAX_TREND_SERIES,
      series,
    };
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
        reviewDecisionSource: "HUMAN",
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
        reviewNote: params.note?.trim() || null,
      },
    });
  }

  /**
   * Batch human approve/reject (governance_review). Caps at 200 ids per call.
   */
  async reviewPriceBatch(params: {
    tenantId: string;
    reviewerId: string;
    priceIds: string[];
    reviewState: "APPROVED" | "REJECTED";
    note?: string;
  }) {
    const ids = [...new Set(params.priceIds.map((id) => id.trim()).filter(Boolean))];
    if (!ids.length) {
      throw new MarketValidationError("EMPTY_REVIEW_BATCH", "At least one priceId is required.");
    }
    if (ids.length > 200) {
      throw new MarketValidationError("REVIEW_BATCH_TOO_LARGE", "Maximum 200 priceIds per batch review.");
    }
    if (params.reviewState !== "APPROVED" && params.reviewState !== "REJECTED") {
      throw new MarketValidationError("INVALID_REVIEW_STATE", "reviewState must be APPROVED or REJECTED.");
    }
    const found = await this.db.marketPriceObservation.findMany({
      where: { tenantId: params.tenantId, id: { in: ids } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((r) => r.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new MarketValidationError(
        "PRICE_NOT_FOUND",
        `Price observation(s) not found in tenant: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
      );
    }
    const result = await this.db.marketPriceObservation.updateMany({
      where: { tenantId: params.tenantId, id: { in: ids } },
      data: {
        reviewState: params.reviewState,
        reviewDecisionSource: "HUMAN",
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
        reviewNote: params.note?.trim() || null,
      },
    });
    return { updated: result.count, reviewState: params.reviewState, reviewDecisionSource: "HUMAN" as const };
  }

  /**
   * Gate 4M-D: retention / series health per channel (target ≥ 365 calendar days of history).
   * Does not delete rows — report only. Product filter windows remain ≤ filterMaxSpanDays.
   */
  async retentionReport(params: { tenantId: string; targetDays?: number; countryCode?: string }) {
    const targetDays = Math.min(Math.max(params.targetDays ?? 365, 30), 3660);
    const channels = await this.db.marketChannel.findMany({
      where: params.countryCode
        ? { countryCode: normalizeCountryCode(params.countryCode) }
        : undefined,
      orderBy: [{ countryCode: "asc" }, { marketCode: "asc" }],
    });

    const channelsOut = [];
    for (const ch of channels) {
      const agg = await this.db.marketPriceObservation.aggregate({
        where: { tenantId: params.tenantId, channelId: ch.id },
        _count: { id: true },
        _min: { observedOn: true },
        _max: { observedOn: true },
      });
      const observationCount = agg._count.id;
      const firstObservedOn = agg._min.observedOn ? toIsoDate(agg._min.observedOn) : null;
      const lastObservedOn = agg._max.observedOn ? toIsoDate(agg._max.observedOn) : null;
      let spanDays = 0;
      if (agg._min.observedOn && agg._max.observedOn) {
        const a = Date.UTC(
          agg._min.observedOn.getUTCFullYear(),
          agg._min.observedOn.getUTCMonth(),
          agg._min.observedOn.getUTCDate(),
        );
        const b = Date.UTC(
          agg._max.observedOn.getUTCFullYear(),
          agg._max.observedOn.getUTCMonth(),
          agg._max.observedOn.getUTCDate(),
        );
        spanDays = Math.floor((b - a) / 86_400_000) + 1;
      }
      const distinctSeries = await this.db.marketPriceObservation.groupBy({
        by: ["commodityCode", "grade", "cultivationMethod", "packDescription", "originLabel"],
        where: { tenantId: params.tenantId, channelId: ch.id },
      });
      const daysBehindTarget = Math.max(0, targetDays - spanDays);
      const retentionStatus =
        observationCount === 0
          ? "EMPTY"
          : spanDays >= targetDays
            ? "MEETS_TARGET"
            : spanDays >= 30
              ? "BUILDING"
              : "EARLY";

      channelsOut.push({
        channelCode: ch.code,
        countryCode: ch.countryCode,
        name: ch.name,
        enabled: ch.enabled,
        harvestIntervalDays: ch.harvestIntervalDays,
        filterMaxSpanDays: ch.filterMaxSpanDays,
        reviewMode: ch.reviewMode,
        observationCount,
        distinctSeries: distinctSeries.length,
        firstObservedOn,
        lastObservedOn,
        spanDays,
        targetDays,
        daysBehindTarget,
        retentionStatus,
        note:
          retentionStatus === "MEETS_TARGET"
            ? `History span ${spanDays}d meets ≥${targetDays}d target.`
            : retentionStatus === "EMPTY"
              ? "No observations yet — run markets:harvest."
              : `Building series: ${spanDays}d of ${targetDays}d target (${daysBehindTarget}d to go). Keep daily/3-day harvest on schedule.`,
      });
    }

    const meets = channelsOut.filter((c) => c.retentionStatus === "MEETS_TARGET").length;
    const building = channelsOut.filter((c) => c.retentionStatus === "BUILDING" || c.retentionStatus === "EARLY").length;
    const empty = channelsOut.filter((c) => c.retentionStatus === "EMPTY").length;

    return {
      targetDays,
      generatedAt: new Date().toISOString(),
      summary: {
        channels: channelsOut.length,
        meetsTarget: meets,
        building,
        empty,
        totalObservations: channelsOut.reduce((n, c) => n + c.observationCount, 0),
      },
      channels: channelsOut,
      schedule: {
        taskName: "FlahaINTEL-MarketHarvest",
        note: "Daily Task Scheduler run; channel harvestIntervalDays still gates JO/MoCI (1d) vs Mahaseel (3d).",
      },
    };
  }
}
