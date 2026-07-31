/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Markets Hub Page
 * Introduction:
 * Country/channel market UI — overview, prices workbench (grouped table + synced multi-series trend),
 * retention, analyst packs.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-31
 */
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { BrandedState } from "../components/BrandedState";
import { SimpleBarChart } from "../components/SimpleBarChart";
import { seriesColor, SimpleLineChart, type ChartSeries } from "../components/SimpleLineChart";
import {
  buildCommodityGroups,
  displayName,
  isoDay,
  num,
  priceOf,
  seriesKeyOf,
  validateDateWindow,
  type PriceRowLike,
} from "../markets/grouping";

type AnalyticsView = "daily" | "by_year" | "monthly" | "annual" | "histogram";

type MarketAnalytics = Awaited<ReturnType<typeof api.marketPriceAnalytics>>;

type Channel = {
  code: string;
  name: string;
  countryCode: string;
  marketCode?: string;
  currencyDefault?: string;
  reviewMode?: string;
  harvestIntervalDays?: number;
  enabled?: boolean;
};

type PriceRow = PriceRowLike & {
  priceHigh?: string | number | null;
  priceLow?: string | number | null;
  quantityTons?: string | number | null;
  reviewDecisionSource?: string;
  originLabel?: string | null;
  channel?: Channel;
};

type RetentionChannel = {
  channelCode?: string;
  observationCount?: number;
  spanDays?: number;
  firstObservedOn?: string | null;
  lastObservedOn?: string | null;
  retentionStatus?: string;
};

type MarketsLane = "overview" | "prices" | "retention" | "packs";

const COUNTRY_LABEL: Record<string, string> = {
  QA: "Qatar",
  JO: "Jordan",
  CA: "Canada",
};

function channelLayout(code: string): "mahaseel" | "amman" | "generic" {
  if (code.includes("mahaseel")) return "mahaseel";
  if (code.includes("amman")) return "amman";
  return "generic";
}

function layoutHint(code: string): string {
  const l = channelLayout(code);
  if (l === "mahaseel") return "PDF bulletin · grade + method · price/kg";
  if (l === "amman") return "High / mode / low · tons · AR+EN";
  return "Official list · unit price";
}

function retentionColor(status?: string): "default" | "success" | "warning" | "error" {
  if (status === "MEETS_TARGET") return "success";
  if (status === "EMPTY") return "default";
  if (status === "BUILDING") return "warning";
  return "default";
}

function reviewColor(state: string): "default" | "success" | "error" | "warning" {
  if (state === "APPROVED") return "success";
  if (state === "REJECTED") return "error";
  if (state === "PENDING_REVIEW") return "warning";
  return "default";
}

export function MarketsPage() {
  const [lane, setLane] = useState<MarketsLane>("overview");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [channelCode, setChannelCode] = useState("");
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  /** Master selection: which commodity group is focused. */
  const [selectedCommodityCode, setSelectedCommodityCode] = useState("");
  /** Detail highlight: which grade/method series (optional; empty = all variants on chart). */
  const [selectedSeriesKey, setSelectedSeriesKey] = useState("");
  const [commodityQuery, setCommodityQuery] = useState("");
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [trendSeries, setTrendSeries] = useState<ChartSeries[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendWarning, setTrendWarning] = useState("");
  const [analytics, setAnalytics] = useState<MarketAnalytics | null>(null);
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>("daily");
  const [analyticsAutoView, setAnalyticsAutoView] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [retention, setRetention] = useState<{
    targetDays: number;
    summary: Record<string, number>;
    channels: RetentionChannel[];
  } | null>(null);
  const [analystBusy, setAnalystBusy] = useState(false);
  const [analystPacks, setAnalystPacks] = useState<Array<Record<string, unknown>>>([]);

  /** Monotonic tokens so slower responses never overwrite newer workbench state. */
  const pricesLoadGen = useRef(0);
  const trendLoadGen = useRef(0);
  const layout = channelLayout(channelCode);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.marketChannels();
      const list = (res.channels || []) as Channel[];
      setChannels(list);
      setChannelCode((prev) => {
        if (prev && list.some((c) => c.code === prev)) return prev;
        const preferred =
          list.find((c) => c.code === "qa-mahaseel-local-vegetables") ||
          list.find((c) => c.code === "jo-amman-central-market") ||
          list.find((c) => c.code === "qa-moci-daily-vegetables") ||
          list[0];
        return preferred?.code || "";
      });
      try {
        setRetention(await api.marketRetention({ targetDays: 365 }));
      } catch {
        setRetention(null);
      }
      try {
        const kp = await api.knowledgePacks({ theme: "MARKET_CONTEXT" });
        setAnalystPacks((kp.packs || []) as Array<Record<string, unknown>>);
      } catch {
        setAnalystPacks([]);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load channels.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const loadPrices = useCallback(async () => {
    if (!channelCode) return;
    const dateErr = validateDateWindow(from, to);
    if (dateErr) {
      setError(dateErr);
      return;
    }
    const gen = ++pricesLoadGen.current;
    setPricesLoading(true);
    try {
      setError("");
      const [priceRes, sumRes] = await Promise.all([
        api.marketPrices({
          channelCode,
          from: from || undefined,
          to: to || undefined,
          limit: 1000,
        }),
        api.marketReviewSummary({ channelCode }),
      ]);
      if (gen !== pricesLoadGen.current) return;
      const rows = (priceRes.prices || []) as PriceRow[];
      setPrices(rows);
      setSummary(sumRes.summary || null);

      const nextGroups = buildCommodityGroups(rows);
      setSelectedCommodityCode((prev) => {
        if (prev && nextGroups.some((g) => g.commodityCode === prev)) return prev;
        return nextGroups[0]?.commodityCode || "";
      });
      setSelectedSeriesKey((prev) => {
        if (!prev) return "";
        // Keep variant selection only if still present under the chosen commodity.
        const still = nextGroups.some((g) => g.variants.some((v) => v.key === prev));
        return still ? prev : "";
      });
      setExpandedCodes((prev) => {
        if (prev.size) {
          // Drop expansions for commodities no longer in the load.
          const next = new Set([...prev].filter((c) => nextGroups.some((g) => g.commodityCode === c)));
          if (next.size) return next;
        }
        if (nextGroups[0]) return new Set([nextGroups[0].commodityCode]);
        return new Set();
      });
    } catch (e) {
      if (gen !== pricesLoadGen.current) return;
      setError(e instanceof Error ? e.message : "Failed to load prices.");
    } finally {
      if (gen === pricesLoadGen.current) setPricesLoading(false);
    }
  }, [channelCode, from, to]);

  useEffect(() => {
    if (lane === "prices" || lane === "overview") {
      void loadPrices();
    }
  }, [lane, loadPrices]);

  const groups = useMemo(() => buildCommodityGroups(prices), [prices]);

  const filteredGroups = useMemo(() => {
    const q = commodityQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.commodityCode.toLowerCase().includes(q) ||
        (g.nameAr && g.nameAr.includes(commodityQuery.trim())) ||
        g.variants.some((v) => v.shortLabel.toLowerCase().includes(q)),
    );
  }, [groups, commodityQuery]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.commodityCode === selectedCommodityCode) || null,
    [groups, selectedCommodityCode],
  );

  const selectedVariant = useMemo(() => {
    if (!selectedGroup || !selectedSeriesKey) return null;
    return selectedGroup.variants.find((v) => v.key === selectedSeriesKey) || null;
  }, [selectedGroup, selectedSeriesKey]);

  /** Detail rows: selected commodity only (or all if none). Newest first. */
  const detailRows = useMemo(() => {
    if (!selectedGroup) return prices;
    if (selectedVariant) return selectedVariant.rows;
    return selectedGroup.variants.flatMap((v) => v.rows).sort((a, b) => {
      const d = isoDay(b.observedOn).localeCompare(isoDay(a.observedOn));
      if (d !== 0) return d;
      return seriesKeyOf(a).localeCompare(seriesKeyOf(b));
    });
  }, [selectedGroup, selectedVariant, prices]);

  // Analytics + chart series for selected commodity/variant (channel-agnostic).
  useEffect(() => {
    if (lane !== "prices" || !channelCode || !selectedGroup) {
      setTrendSeries([]);
      setAnalytics(null);
      setTrendWarning("");
      return;
    }
    const dateErr = validateDateWindow(from, to);
    if (dateErr) {
      setTrendSeries([]);
      setAnalytics(null);
      setTrendWarning(dateErr);
      return;
    }

    const gen = ++trendLoadGen.current;
    setTrendLoading(true);
    setTrendWarning("");

    const seriesKey =
      selectedSeriesKey ||
      (selectedGroup.variants.length === 1 ? selectedGroup.variants[0]!.key : undefined);
    const preferValue =
      layout === "amman" ? ("priceMode" as const) : layout === "mahaseel" ? ("unitPrice" as const) : ("auto" as const);

    void (async () => {
      try {
        // When multiple variants and none selected: show grade/method overlay (bundle).
        // When one series focused: comprehensive analytics.
        if (!seriesKey && selectedGroup.variants.length > 1) {
          const bundle = await api.marketPriceTrendBundle({
            channelCode,
            commodityCode: selectedGroup.commodityCode,
            from: from || undefined,
            to: to || undefined,
            limit: 400,
          });
          if (gen !== trendLoadGen.current) return;
          setAnalytics(null);
          const chart: ChartSeries[] = (bundle.series || [])
            .map((s, i) => ({
              id: s.seriesKey,
              label: s.shortLabel,
              color: seriesColor(i),
              points: (s.points || [])
                .filter((p) => p.value != null && Number.isFinite(p.value))
                .map((p) => ({ x: String(p.observedOn).slice(0, 10), y: p.value as number })),
            }))
            .filter((s) => s.points.length > 0);
          setTrendSeries(chart);
          if (!chart.length) setTrendWarning("No trend points for variants in this window.");
          else setAnalyticsView("daily");
          return;
        }

        const a = await api.marketPriceAnalytics({
          channelCode,
          commodityCode: selectedGroup.commodityCode,
          seriesKey,
          grade: selectedVariant?.grade,
          cultivationMethod: selectedVariant?.cultivationMethod,
          from: from || undefined,
          to: to || undefined,
          preferValue,
          limit: 5000,
        });
        if (gen !== trendLoadGen.current) return;
        setAnalytics(a);
        if (analyticsAutoView) {
          setAnalyticsView(a.recommendedView === "by_year" ? "by_year" : a.recommendedView);
        }
        // Default daily chart from analytics
        setTrendSeries([
          {
            id: a.seriesKey,
            label: selectedVariant?.shortLabel || a.commodityName || "Price",
            color: seriesColor(0),
            points: a.daily.map((p) => ({ x: p.observedOn, y: p.value })),
          },
        ]);
        if (!a.daily.length) setTrendWarning("No analytics points for this series/window.");
        else if (a.truncated) setTrendWarning("Series truncated at API limit — narrow the date window for full history.");
      } catch (e) {
        if (gen !== trendLoadGen.current) return;
        setTrendSeries([]);
        setAnalytics(null);
        setTrendWarning(e instanceof Error ? e.message : "Analytics load failed.");
      } finally {
        if (gen === trendLoadGen.current) setTrendLoading(false);
      }
    })();
  }, [
    lane,
    channelCode,
    selectedGroup?.commodityCode,
    selectedSeriesKey,
    selectedVariant?.grade,
    selectedVariant?.cultivationMethod,
    from,
    to,
    layout,
    analyticsAutoView,
  ]);

  const selectedChannel = channels.find((c) => c.code === channelCode);
  const currency =
    analytics?.currency ||
    selectedChannel?.currencyDefault ||
    selectedGroup?.currency ||
    "";

  /** Chart series derived from analytics view mode. */
  const analysisChartSeries: ChartSeries[] = useMemo(() => {
    if (!analytics) return trendSeries;
    if (analyticsView === "by_year" && analytics.byYear.length) {
      return analytics.byYear.map((ys, i) => ({
        id: `y-${ys.year}`,
        label: String(ys.year),
        color: seriesColor(i),
        points: ys.points.map((p) => ({ x: p.x, y: p.y })),
      }));
    }
    if (analyticsView === "monthly") {
      return [
        {
          id: "monthly-mean",
          label: "Monthly mean",
          color: seriesColor(0),
          points: analytics.monthly
            .filter((m) => m.mean != null && m.n > 0)
            .map((m) => ({ x: m.label, y: m.mean as number })),
        },
      ];
    }
    if (analyticsView === "annual") {
      return [
        {
          id: "annual-mean",
          label: "Annual mean",
          color: seriesColor(1),
          points: analytics.annual
            .filter((y) => y.mean != null)
            .map((y) => ({ x: String(y.year), y: y.mean as number })),
        },
      ];
    }
    // daily (default)
    return [
      {
        id: analytics.seriesKey,
        label: selectedVariant?.shortLabel || analytics.commodityName || "Price",
        color: seriesColor(0),
        points: analytics.daily.map((p) => ({ x: p.observedOn, y: p.value })),
      },
    ];
  }, [analytics, analyticsView, trendSeries, selectedVariant?.shortLabel]);

  const histogramBars = useMemo(() => {
    if (!analytics?.histogram?.length) return [];
    return analytics.histogram.map((b) => ({
      label: b.label,
      value: b.count,
      color: "#00838F",
    }));
  }, [analytics]);

  const monthlyBars = useMemo(() => {
    if (!analytics?.monthly?.length) return [];
    return analytics.monthly
      .filter((m) => m.n > 0 && m.mean != null)
      .map((m) => ({ label: m.label, value: m.mean as number }));
  }, [analytics]);

  const annualBars = useMemo(() => {
    if (!analytics?.annual?.length) return [];
    return analytics.annual
      .filter((y) => y.mean != null)
      .map((y) => ({ label: String(y.year), value: y.mean as number }));
  }, [analytics]);

  const hasGradeCols = layout === "mahaseel" || prices.some((p) => p.grade || p.cultivationMethod);
  const hasAmmanCols =
    layout === "amman" || prices.some((p) => p.priceHigh != null || p.quantityTons != null);
  const hasPeriod = prices.some((p) => p.periodFrom || p.periodTo);
  const hasAr = prices.some((p) => p.commodityNameAr);

  const countries = useMemo(() => {
    const set = new Set(channels.map((c) => c.countryCode));
    return [...set].sort();
  }, [channels]);

  const filteredChannels = useMemo(() => {
    if (!countryFilter) return channels;
    return channels.filter((c) => c.countryCode === countryFilter);
  }, [channels, countryFilter]);

  const retentionByCode = useMemo(() => {
    const m = new Map<string, RetentionChannel>();
    for (const ch of retention?.channels || []) {
      if (ch.channelCode) m.set(String(ch.channelCode), ch);
    }
    return m;
  }, [retention]);

  const channelsByCountry = useMemo(() => {
    const m = new Map<string, Channel[]>();
    for (const c of channels) {
      const list = m.get(c.countryCode) || [];
      list.push(c);
      m.set(c.countryCode, list);
    }
    return m;
  }, [channels]);

  function selectCommodity(code: string) {
    setSelectedCommodityCode(code);
    setSelectedSeriesKey("");
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      next.add(code);
      return next;
    });
  }

  function selectVariant(groupCode: string, seriesKey: string) {
    setSelectedCommodityCode(groupCode);
    setSelectedSeriesKey(seriesKey);
    setExpandedCodes((prev) => new Set(prev).add(groupCode));
  }

  function toggleExpand(code: string) {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function openChannel(code: string) {
    setChannelCode(code);
    setSelectedCommodityCode("");
    setSelectedSeriesKey("");
    setCommodityQuery("");
    setLane("prices");
  }

  async function rebuildPacks(scope: "channel" | "all") {
    setAnalystBusy(true);
    setInfo("");
    try {
      const res = await api.rebuildMarketAnalystPacks(
        scope === "channel" && channelCode ? { channelCode } : {},
      );
      setInfo(`Built ${res.built} pack(s). Review on Knowledge → Markets lane (MARKET_CONTEXT).`);
      const kp = await api.knowledgePacks({ theme: "MARKET_CONTEXT" });
      setAnalystPacks((kp.packs || []) as Array<Record<string, unknown>>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rebuild failed.");
    } finally {
      setAnalystBusy(false);
    }
  }

  if (loading) return <BrandedState label="Loading markets hub…" loading />;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Markets hub</Typography>
        <Typography variant="body2" color="text.secondary">
          Official channel prices by <strong>country</strong> and <strong>channel</strong>. Human review policies apply.
          Analyst packs feed Knowledge — never auto-advise farmers or write product engines.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity="success" onClose={() => setInfo("")}>
          {info}
        </Alert>
      )}

      <Tabs
        value={lane}
        onChange={(_, v: MarketsLane) => setLane(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="overview" label={`Overview (${channels.length})`} />
        <Tab value="prices" label="Prices" />
        <Tab value="retention" label="Retention 365d" />
        <Tab value="packs" label={`Analyst packs (${analystPacks.length})`} />
      </Tabs>

      {/* ═══════════════ OVERVIEW ═══════════════ */}
      {lane === "overview" && (
        <Stack spacing={2}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
            }}
          >
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Channels
                </Typography>
                <Typography variant="h4">{channels.length}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {countries.map((c) => COUNTRY_LABEL[c] || c).join(" · ") || "—"}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Retention target
                </Typography>
                <Typography variant="h4">{retention?.targetDays ?? 365}d</Typography>
                <Typography variant="caption" color="text.secondary">
                  Meets: {retention?.summary.meetsTarget ?? 0} · Building: {retention?.summary.building ?? 0} ·
                  Empty: {retention?.summary.empty ?? 0}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Review (selected ch.)
                </Typography>
                <Typography variant="h4">{summary?.pendingReview ?? "—"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Pending · open Prices for full mix
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Analyst packs
                </Typography>
                <Typography variant="h4">{analystPacks.length}</Typography>
                <Typography variant="caption" color="text.secondary">
                  MARKET_CONTEXT · review in Knowledge
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Alert severity="info">
            Click a channel card to open the <strong>Prices</strong> workbench. Scheduled harvest: daily 05:30
            (Task Scheduler). Layout adapts: MoCI generic · Mahaseel grade/method · Amman high/mode/low.
          </Alert>

          {countries.map((cc) => {
            const list = channelsByCountry.get(cc) || [];
            return (
              <Box key={cc}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  {COUNTRY_LABEL[cc] || cc}{" "}
                  <Chip size="small" label={cc} sx={{ ml: 0.5 }} />
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {list.length} channel{list.length === 1 ? "" : "s"}
                  </Typography>
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
                  }}
                >
                  {list.map((ch) => {
                    const ret = retentionByCode.get(ch.code);
                    return (
                      <Card key={ch.code} variant="outlined" sx={{ height: "100%" }}>
                        <CardActionArea onClick={() => openChannel(ch.code)} sx={{ height: "100%" }}>
                          <CardContent>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {ch.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                              {ch.code}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                              <Chip size="small" label={ch.reviewMode || "HUMAN_REQUIRED"} />
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Harvest ${ch.harvestIntervalDays ?? "?"}d`}
                              />
                              <Chip
                                size="small"
                                color={retentionColor(ret?.retentionStatus)}
                                label={String(ret?.retentionStatus || "—")}
                              />
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                              {layoutHint(ch.code)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                              Rows: {ret?.observationCount ?? "—"} · Span: {ret?.spanDays ?? "—"}d · Last:{" "}
                              {String(ret?.lastObservedOn || "—").slice(0, 10) || "—"}
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    );
                  })}
                </Box>
              </Box>
            );
          })}

          {!channels.length && (
            <Alert severity="warning">
              No channels. Seed: <code>npm run markets:seed-channels</code>
            </Alert>
          )}
        </Stack>
      )}

      {/* ═══════════════ PRICES WORKBENCH ═══════════════ */}
      {lane === "prices" && (
        <Stack spacing={2}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "minmax(220px, 280px) 1fr" },
              alignItems: "start",
            }}
          >
            {/* Channel rail */}
            <Card variant="outlined">
              <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Channels
                  </Typography>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Country</InputLabel>
                    <Select
                      label="Country"
                      value={countryFilter}
                      onChange={(e) => setCountryFilter(e.target.value)}
                    >
                      <MenuItem value="">All countries</MenuItem>
                      {countries.map((c) => (
                        <MenuItem key={c} value={c}>
                          {COUNTRY_LABEL[c] || c} ({c})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <List dense disablePadding sx={{ maxHeight: 560, overflow: "auto" }}>
                  {filteredChannels.map((c) => {
                    const ret = retentionByCode.get(c.code);
                    return (
                      <ListItemButton
                        key={c.code}
                        selected={c.code === channelCode}
                        onClick={() => {
                          setChannelCode(c.code);
                          setSelectedCommodityCode("");
                          setSelectedSeriesKey("");
                          setCommodityQuery("");
                        }}
                        alignItems="flex-start"
                        sx={{ borderBottom: 1, borderColor: "divider" }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {c.countryCode} · {c.name}
                            </Typography>
                          }
                          secondary={`${c.code} · ${ret?.retentionStatus || "—"} · ${ret?.observationCount ?? 0} rows`}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </CardContent>
            </Card>

            <Stack spacing={2}>
              {selectedChannel ? (
                <>
                  {/* Toolbar */}
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1.5 }}>
                        <Typography variant="h6" sx={{ flex: 1, minWidth: 160 }}>
                          {selectedChannel.name}
                        </Typography>
                        <Chip size="small" color="primary" label={selectedChannel.countryCode} />
                        <Chip size="small" label={selectedChannel.reviewMode || "HUMAN_REQUIRED"} />
                        {layout === "mahaseel" && (
                          <Chip size="small" color="info" variant="outlined" label="Grouped · grade/method" />
                        )}
                      </Box>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                        <TextField
                          size="small"
                          label="From"
                          type="date"
                          value={from}
                          onChange={(e) => setFrom(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                          size="small"
                          label="To"
                          type="date"
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                          size="small"
                          label="Search commodity"
                          value={commodityQuery}
                          onChange={(e) => setCommodityQuery(e.target.value)}
                          placeholder="Tomato, cucumber…"
                          sx={{ minWidth: 180 }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => void loadPrices()}
                          disabled={pricesLoading}
                        >
                          Refresh
                        </Button>
                      </Box>
                      {summary && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          Review: {summary.pendingReview ?? 0} pending · {summary.approvedByChannelPolicy ?? 0}{" "}
                          policy · {summary.approvedByHuman ?? 0} human · {summary.rejected ?? 0} rejected ·{" "}
                          {groups.length} commodities · {prices.length} rows loaded
                          {pricesLoading ? " · loading…" : ""}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>

                  {/* Master–detail: commodity groups | trend + history */}
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", lg: "minmax(260px, 340px) 1fr" },
                      alignItems: "start",
                    }}
                  >
                    {/* Commodity master list (grouped) */}
                    <Card variant="outlined">
                      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                        <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Commodities ({filteredGroups.length})
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Expand for grade/method. Click to sync trend.
                          </Typography>
                        </Box>
                        <List dense disablePadding sx={{ maxHeight: 420, overflow: "auto" }}>
                          {filteredGroups.length === 0 ? (
                            <Box sx={{ p: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                No commodities in this window. Widen dates or harvest.
                              </Typography>
                            </Box>
                          ) : (
                            filteredGroups.map((g) => {
                              const open = expandedCodes.has(g.commodityCode);
                              const selected = g.commodityCode === selectedCommodityCode;
                              return (
                                <Box key={g.commodityCode} sx={{ borderBottom: 1, borderColor: "divider" }}>
                                  <ListItemButton
                                    selected={selected && !selectedSeriesKey}
                                    onClick={() => selectCommodity(g.commodityCode)}
                                    sx={{ py: 1 }}
                                  >
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleExpand(g.commodityCode);
                                            }}
                                            sx={{ p: 0.25, mr: 0.25 }}
                                            aria-label={open ? "Collapse" : "Expand"}
                                          >
                                            <Typography variant="caption" sx={{ width: 12 }}>
                                              {open ? "▾" : "▸"}
                                            </Typography>
                                          </IconButton>
                                          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                                            {g.name}
                                          </Typography>
                                          <Chip
                                            size="small"
                                            variant="outlined"
                                            label={`${g.variants.length} var`}
                                          />
                                        </Box>
                                      }
                                      secondary={
                                        <Typography variant="caption" color="text.secondary" component="span">
                                          {g.latestPrice != null
                                            ? `${g.latestPrice} ${g.currency}`
                                            : "—"}{" "}
                                          · {g.rowCount} obs
                                          {g.nameAr ? ` · ${g.nameAr}` : ""}
                                        </Typography>
                                      }
                                    />
                                  </ListItemButton>
                                  <Collapse in={open} timeout="auto" unmountOnExit>
                                    <List dense disablePadding sx={{ bgcolor: "action.hover" }}>
                                      {g.variants.map((v, vi) => (
                                        <ListItemButton
                                          key={v.key}
                                          selected={selectedSeriesKey === v.key}
                                          onClick={() => selectVariant(g.commodityCode, v.key)}
                                          sx={{ pl: 4, py: 0.75 }}
                                        >
                                          <Box
                                            sx={{
                                              width: 10,
                                              height: 10,
                                              borderRadius: 0.5,
                                              bgcolor: seriesColor(vi),
                                              mr: 1,
                                              flexShrink: 0,
                                            }}
                                          />
                                          <ListItemText
                                            primary={
                                              <Typography variant="body2">{v.shortLabel}</Typography>
                                            }
                                            secondary={`${priceOf(v.latest) ?? "—"} ${v.latest.currency} · ${isoDay(v.latest.observedOn)}`}
                                          />
                                        </ListItemButton>
                                      ))}
                                      {g.variants.length > 1 && (
                                        <ListItemButton
                                          onClick={() => selectCommodity(g.commodityCode)}
                                          sx={{ pl: 4, py: 0.5 }}
                                        >
                                          <ListItemText
                                            primary={
                                              <Typography variant="caption" color="primary">
                                                Show all variants on chart
                                              </Typography>
                                            }
                                          />
                                        </ListItemButton>
                                      )}
                                    </List>
                                  </Collapse>
                                </Box>
                              );
                            })
                          )}
                        </List>
                      </CardContent>
                    </Card>

                    {/* Trend + analytics (synced to selection) */}
                    <Card variant="outlined">
                      <CardContent>
                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 1,
                            alignItems: "center",
                            mb: 1,
                          }}
                        >
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
                            Market analysis
                            {selectedGroup ? ` · ${selectedGroup.name}` : ""}
                            {selectedVariant
                              ? ` · ${selectedVariant.shortLabel}`
                              : selectedGroup && selectedGroup.variants.length > 1 && !selectedSeriesKey
                                ? " · all variants"
                                : ""}
                          </Typography>
                          {trendLoading && <Chip size="small" label="Loading…" />}
                          {selectedSeriesKey && (
                            <Button size="small" onClick={() => setSelectedSeriesKey("")}>
                              Clear variant filter
                            </Button>
                          )}
                        </Box>

                        {analytics && (
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
                            {(
                              [
                                ["daily", "Daily"],
                                ["by_year", "By year"],
                                ["monthly", "Monthly"],
                                ["annual", "Annual"],
                                ["histogram", "Histogram"],
                              ] as const
                            ).map(([id, label]) => (
                              <Chip
                                key={id}
                                size="small"
                                label={label}
                                color={analyticsView === id ? "primary" : "default"}
                                variant={analyticsView === id ? "filled" : "outlined"}
                                onClick={() => {
                                  setAnalyticsAutoView(false);
                                  setAnalyticsView(id);
                                }}
                                disabled={
                                  (id === "by_year" && analytics.byYear.length < 2) ||
                                  (id === "annual" && analytics.annual.length < 1)
                                }
                              />
                            ))}
                            {analytics.multiYear && (
                              <Chip size="small" color="info" variant="outlined" label="Multi-year span" />
                            )}
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`Value: ${analytics.valueField}`}
                            />
                          </Box>
                        )}

                        {/* Stats strip */}
                        {analytics?.stats && analytics.stats.n > 0 && (
                          <Box
                            sx={{
                              display: "grid",
                              gap: 1,
                              gridTemplateColumns: {
                                xs: "1fr 1fr",
                                sm: "repeat(4, 1fr)",
                                md: "repeat(6, 1fr)",
                              },
                              mb: 1.5,
                            }}
                          >
                            {[
                              { l: "n", v: analytics.stats.n },
                              { l: "Mean", v: analytics.stats.mean },
                              { l: "Median", v: analytics.stats.median },
                              { l: "Min", v: analytics.stats.min },
                              { l: "Max", v: analytics.stats.max },
                              { l: "σ", v: analytics.stats.stdev },
                            ].map((c) => (
                              <Box
                                key={c.l}
                                sx={{ p: 1, borderRadius: 1, bgcolor: "action.hover" }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  {c.l}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {c.v == null ? "—" : typeof c.v === "number" ? c.v.toFixed(3) : c.v}
                                  {typeof c.v === "number" && c.l !== "n" && currency ? ` ${currency}` : ""}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* Deviation callout */}
                        {analytics?.deviation?.latest && analytics.deviation.flag !== "insufficient_data" && (
                          <Alert
                            severity={
                              analytics.deviation.flag === "elevated"
                                ? "warning"
                                : analytics.deviation.flag === "depressed"
                                  ? "info"
                                  : "success"
                            }
                            sx={{ mb: 1.5 }}
                          >
                            Latest{" "}
                            <strong>
                              {analytics.deviation.latest.value.toFixed(3)} {currency}
                            </strong>{" "}
                            on {analytics.deviation.latest.observedOn}
                            {analytics.deviation.vsTrailing30d?.pct != null && (
                              <>
                                {" "}
                                · vs 30d mean{" "}
                                <strong>
                                  {analytics.deviation.vsTrailing30d.pct > 0 ? "+" : ""}
                                  {analytics.deviation.vsTrailing30d.pct.toFixed(1)}%
                                </strong>
                              </>
                            )}
                            {analytics.deviation.vsSameMonthPriorYear?.pct != null && (
                              <>
                                {" "}
                                · vs same month {analytics.deviation.vsSameMonthPriorYear.priorYear}{" "}
                                <strong>
                                  {analytics.deviation.vsSameMonthPriorYear.pct > 0 ? "+" : ""}
                                  {analytics.deviation.vsSameMonthPriorYear.pct.toFixed(1)}%
                                </strong>
                              </>
                            )}
                            {analytics.deviation.zScoreTrailing90d != null && (
                              <> · z(90d)={analytics.deviation.zScoreTrailing90d.toFixed(2)}</>
                            )}
                            {" · "}
                            flag: <strong>{analytics.deviation.flag}</strong>
                          </Alert>
                        )}

                        {analyticsView === "histogram" && analytics ? (
                          <SimpleBarChart
                            items={histogramBars}
                            yLabel="Count"
                            emptyMessage="Not enough points for a histogram."
                          />
                        ) : analyticsView === "monthly" && analytics && monthlyBars.length ? (
                          <SimpleBarChart
                            items={monthlyBars}
                            yLabel={currency ? `Mean (${currency})` : "Mean"}
                          />
                        ) : analyticsView === "annual" && analytics && annualBars.length ? (
                          <SimpleBarChart
                            items={annualBars}
                            yLabel={currency ? `Mean (${currency})` : "Mean"}
                            color="#2E7D32"
                          />
                        ) : (
                          <SimpleLineChart
                            series={analysisChartSeries}
                            yLabel={
                              currency
                                ? `Price (${currency}${layout === "mahaseel" || layout === "amman" ? "/kg" : ""})`
                                : "Price"
                            }
                            height={analyticsView === "by_year" ? 280 : 240}
                          />
                        )}

                        {trendWarning && (
                          <Alert severity="warning" sx={{ mt: 1 }} onClose={() => setTrendWarning("")}>
                            {trendWarning}
                          </Alert>
                        )}

                        {/* Annual table when multi-year */}
                        {analytics && analytics.annual.length > 0 && analyticsView !== "histogram" && (
                          <Box sx={{ mt: 1.5, overflowX: "auto" }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                              Annual snapshot
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Year</TableCell>
                                  <TableCell align="right">n</TableCell>
                                  <TableCell align="right">Mean</TableCell>
                                  <TableCell align="right">Median</TableCell>
                                  <TableCell align="right">Min</TableCell>
                                  <TableCell align="right">Max</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {analytics.annual.map((y) => (
                                  <TableRow key={y.year}>
                                    <TableCell>{y.year}</TableCell>
                                    <TableCell align="right">{y.n}</TableCell>
                                    <TableCell align="right">{y.mean?.toFixed(3) ?? "—"}</TableCell>
                                    <TableCell align="right">{y.median?.toFixed(3) ?? "—"}</TableCell>
                                    <TableCell align="right">{y.min?.toFixed(3) ?? "—"}</TableCell>
                                    <TableCell align="right">{y.max?.toFixed(3) ?? "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        )}

                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          {analytics
                            ? `${analytics.firstDay || "?"} → ${analytics.lastDay || "?"} · ${analytics.spanDays}d · ${analytics.stats.n} points · view ${analyticsView}${analytics.multiYear ? " · multi-year overlay uses MM-DD axis" : ""}`
                            : selectedGroup
                              ? selectedGroup.variants.length > 1 && !selectedSeriesKey
                                ? "Pick a grade/method for full analytics (year curves, histogram, deviation). Or leave open to overlay variants."
                                : "Loading analytics…"
                              : "Select a commodity on the left."}
                          {from || to ? ` · Filter ${from || "…"} → ${to || "…"}` : ""}
                          {trendLoading ? " · loading…" : ""}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>

                  {/* Detail observations table (selected commodity / variant only) */}
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Observations
                        {selectedGroup
                          ? ` · ${selectedGroup.name}${selectedVariant ? ` · ${selectedVariant.shortLabel}` : ""}`
                          : ""}{" "}
                        ({detailRows.length})
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Master list groups by commodity; detail shows history for the selection only. Row click
                        focuses that grade/method on the chart.
                      </Typography>
                      <Box sx={{ overflowX: "auto" }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>{hasPeriod ? "Period / date" : "Date"}</TableCell>
                              <TableCell>Commodity</TableCell>
                              {hasAr && <TableCell>AR</TableCell>}
                              {hasGradeCols && <TableCell>Grade</TableCell>}
                              {hasGradeCols && <TableCell>Method</TableCell>}
                              <TableCell align="right">
                                {layout === "mahaseel"
                                  ? "Price (kg)"
                                  : layout === "amman"
                                    ? "Mode"
                                    : "Price"}
                              </TableCell>
                              {hasAmmanCols && <TableCell align="right">High</TableCell>}
                              {hasAmmanCols && <TableCell align="right">Low</TableCell>}
                              {hasAmmanCols && <TableCell align="right">Tons</TableCell>}
                              <TableCell>Review</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {detailRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={10}>
                                  <Typography color="text.secondary">
                                    No observations for this selection.
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ) : (
                              detailRows.map((p) => {
                                const key = seriesKeyOf(p);
                                const active =
                                  key === selectedSeriesKey ||
                                  (!selectedSeriesKey && p.commodityCode === selectedCommodityCode);
                                const period =
                                  p.periodFrom || p.periodTo
                                    ? `${isoDay(p.periodFrom) || "?"} → ${isoDay(p.periodTo) || isoDay(p.observedOn)}`
                                    : isoDay(p.observedOn);
                                return (
                                  <TableRow
                                    key={p.id}
                                    hover
                                    selected={active && Boolean(selectedSeriesKey)}
                                    onClick={() => selectVariant(p.commodityCode, key)}
                                    sx={{ cursor: "pointer" }}
                                  >
                                    <TableCell>
                                      <Typography variant="body2">{period}</Typography>
                                      {hasPeriod && (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{ display: "block" }}
                                        >
                                          obs {isoDay(p.observedOn)}
                                        </Typography>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2">{displayName(p)}</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {p.commodityCode}
                                      </Typography>
                                    </TableCell>
                                    {hasAr && (
                                      <TableCell>
                                        <Typography variant="body2" dir="rtl">
                                          {p.commodityNameAr || "—"}
                                        </Typography>
                                      </TableCell>
                                    )}
                                    {hasGradeCols && (
                                      <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                          {p.grade || "—"}
                                        </Typography>
                                      </TableCell>
                                    )}
                                    {hasGradeCols && (
                                      <TableCell>
                                        <Typography variant="body2">{p.cultivationMethod || "—"}</Typography>
                                      </TableCell>
                                    )}
                                    <TableCell align="right">
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {priceOf(p) ?? "—"} {p.currency}
                                      </Typography>
                                    </TableCell>
                                    {hasAmmanCols && (
                                      <TableCell align="right">{num(p.priceHigh) ?? "—"}</TableCell>
                                    )}
                                    {hasAmmanCols && (
                                      <TableCell align="right">{num(p.priceLow) ?? "—"}</TableCell>
                                    )}
                                    {hasAmmanCols && (
                                      <TableCell align="right">{num(p.quantityTons) ?? "—"}</TableCell>
                                    )}
                                    <TableCell>
                                      <Chip
                                        size="small"
                                        label={p.reviewState}
                                        color={reviewColor(p.reviewState)}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </Box>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Alert severity="info">Select a channel from the list.</Alert>
              )}
            </Stack>
          </Box>
        </Stack>
      )}

      {/* ═══════════════ RETENTION ═══════════════ */}
      {lane === "retention" && (
        <Stack spacing={2}>
          <Alert severity="info">
            Goal: ≥{retention?.targetDays ?? 365} days of history per market. Scheduled:{" "}
            <code>FlahaINTEL-MarketHarvest</code> daily 05:30. Status MEETS_TARGET when span is enough.
          </Alert>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" },
            }}
          >
            {[
              { label: "Meets target", value: retention?.summary.meetsTarget ?? 0 },
              { label: "Building", value: retention?.summary.building ?? 0 },
              { label: "Empty", value: retention?.summary.empty ?? 0 },
            ].map((c) => (
              <Card key={c.label} variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    {c.label}
                  </Typography>
                  <Typography variant="h4">{c.value}</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1, flexWrap: "wrap", gap: 1 }}>
                <Typography variant="h6">Per channel</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    void api.marketRetention({ targetDays: 365 }).then(setRetention).catch(() => null)
                  }
                >
                  Refresh retention
                </Button>
              </Box>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Channel</TableCell>
                      <TableCell align="right">Rows</TableCell>
                      <TableCell align="right">Span (d)</TableCell>
                      <TableCell>First → last</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(retention?.channels || []).map((ch) => (
                      <TableRow key={String(ch.channelCode)}>
                        <TableCell>
                          <Typography variant="body2">{String(ch.channelCode)}</Typography>
                        </TableCell>
                        <TableCell align="right">{String(ch.observationCount ?? 0)}</TableCell>
                        <TableCell align="right">{String(ch.spanDays ?? 0)}</TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {String(ch.firstObservedOn || "—")} → {String(ch.lastObservedOn || "—")}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={String(ch.retentionStatus || "—")}
                            color={retentionColor(String(ch.retentionStatus || ""))}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="small" onClick={() => openChannel(String(ch.channelCode))}>
                            Prices
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!retention?.channels?.length && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Typography color="text.secondary">No retention data yet.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* ═══════════════ ANALYST PACKS ═══════════════ */}
      {lane === "packs" && (
        <Stack spacing={2}>
          <Alert severity="info">
            Rebuild creates/updates <strong>MARKET_CONTEXT</strong> knowledge packs (DRAFT). Human review lives on{" "}
            <strong>Knowledge → Markets</strong>. Never auto-advises farmers.
          </Alert>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Rebuild
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 280 }}>
                  <InputLabel>Channel (optional scope)</InputLabel>
                  <Select
                    label="Channel (optional scope)"
                    value={channelCode}
                    onChange={(e) => setChannelCode(e.target.value)}
                  >
                    {channels.map((c) => (
                      <MenuItem key={c.code} value={c.code}>
                        {c.countryCode} · {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  size="small"
                  variant="contained"
                  disabled={analystBusy || !channelCode}
                  onClick={() => void rebuildPacks("channel")}
                >
                  {analystBusy ? "Building…" : "Rebuild this channel"}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={analystBusy}
                  onClick={() => void rebuildPacks("all")}
                >
                  Rebuild all channels
                </Button>
              </Box>
              <Typography variant="subtitle2" gutterBottom>
                Packs in Knowledge ({analystPacks.length})
              </Typography>
              {!analystPacks.length ? (
                <Typography color="text.secondary" variant="body2">
                  None yet — rebuild after harvest has data.
                </Typography>
              ) : (
                <List dense>
                  {analystPacks.slice(0, 20).map((p) => (
                    <ListItemButton key={String(p.id || p.code)}>
                      <ListItemText
                        primary={String(p.title || p.code)}
                        secondary={`${String(p.code)} · ${String(p.status || "")}`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}
