/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Markets Prices Page
 * Introduction: Channel-adaptive price table (Mahaseel grade/method, Amman high/mode/low) and trends.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { BrandedState } from "../components/BrandedState";
import { SimpleLineChart } from "../components/SimpleLineChart";

type Channel = {
  code: string;
  name: string;
  countryCode: string;
  marketCode?: string;
  currencyDefault?: string;
  reviewMode?: string;
  harvestIntervalDays?: number;
};

type PriceRow = {
  id: string;
  observedOn: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  commodityCode: string;
  commodityName: string;
  commodityNameAr?: string | null;
  commodityNameEn?: string | null;
  grade?: string | null;
  cultivationMethod?: string | null;
  packDescription?: string | null;
  unitPrice?: string | number | null;
  priceMode?: string | number | null;
  priceHigh?: string | number | null;
  priceLow?: string | number | null;
  currency: string;
  quantityTons?: string | number | null;
  reviewState: string;
  reviewDecisionSource?: string;
  originLabel?: string | null;
  channel?: Channel;
};

/** Series identity: commodity + grade + cultivation method (Mahaseel PDF columns). */
type SeriesKey = {
  key: string;
  commodityCode: string;
  label: string;
  grade?: string;
  cultivationMethod?: string;
  packDescription?: string;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isoDay(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function displayName(p: PriceRow): string {
  return p.commodityNameEn || p.commodityName || p.commodityCode;
}

function seriesKeyOf(p: PriceRow): string {
  const g = (p.grade || "").trim();
  const m = (p.cultivationMethod || "").trim();
  const pack = (p.packDescription || "").trim();
  return `${p.commodityCode}|${g}|${m}|${pack}`;
}

function seriesLabel(p: PriceRow): string {
  const name = displayName(p);
  const g = (p.grade || "").trim();
  const m = (p.cultivationMethod || "").trim();
  if (g && m) return `${name} · grade ${g} · ${m}`;
  if (g) return `${name} · grade ${g}`;
  if (m) return `${name} · ${m}`;
  return name;
}

function channelLayout(code: string): "mahaseel" | "amman" | "generic" {
  if (code.includes("mahaseel")) return "mahaseel";
  if (code.includes("amman")) return "amman";
  return "generic";
}

export function MarketsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelCode, setChannelCode] = useState("");
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [seriesKey, setSeriesKey] = useState("");
  const [trendPoints, setTrendPoints] = useState<Array<{ observedOn: string; value: number | null; currency: string }>>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const layout = channelLayout(channelCode);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.marketChannels();
        const list = (res.channels || []) as Channel[];
        setChannels(list);
        const preferred =
          list.find((c) => c.code === "qa-mahaseel-local-vegetables") ||
          list.find((c) => c.code === "jo-amman-central-market") ||
          list.find((c) => c.code === "qa-moci-daily-vegetables") ||
          list[0];
        if (preferred) setChannelCode(preferred.code);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load channels.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!channelCode) return;
    void (async () => {
      try {
        setError("");
        const [priceRes, sumRes] = await Promise.all([
          api.marketPrices({
            channelCode,
            from: from || undefined,
            to: to || undefined,
            limit: 300,
          }),
          api.marketReviewSummary({ channelCode }),
        ]);
        const rows = (priceRes.prices || []) as PriceRow[];
        setPrices(rows);
        setSummary(sumRes.summary || null);
        if (rows[0]) {
          const next = seriesKeyOf(rows[0]);
          setSeriesKey((prev) => (rows.some((r) => seriesKeyOf(r) === prev) ? prev : next));
        } else {
          setSeriesKey("");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load prices.");
      }
    })();
  }, [channelCode, from, to]);

  const seriesList: SeriesKey[] = useMemo(() => {
    const map = new Map<string, SeriesKey>();
    for (const p of prices) {
      const key = seriesKeyOf(p);
      if (!map.has(key)) {
        map.set(key, {
          key,
          commodityCode: p.commodityCode,
          label: seriesLabel(p),
          grade: p.grade || undefined,
          cultivationMethod: p.cultivationMethod || undefined,
          packDescription: p.packDescription || undefined,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [prices]);

  const selectedSeries = seriesList.find((s) => s.key === seriesKey);

  useEffect(() => {
    if (!channelCode || !selectedSeries) {
      setTrendPoints([]);
      return;
    }
    void (async () => {
      try {
        const trend = await api.marketPriceTrend({
          channelCode,
          commodityCode: selectedSeries.commodityCode,
          grade: selectedSeries.grade,
          cultivationMethod: selectedSeries.cultivationMethod,
          packDescription: selectedSeries.packDescription,
          limit: 90,
        });
        setTrendPoints(trend.points || []);
      } catch {
        setTrendPoints([]);
      }
    })();
  }, [channelCode, selectedSeries?.key]);

  const selectedChannel = channels.find((c) => c.code === channelCode);
  const chartData = trendPoints
    .filter((p) => p.value != null)
    .map((p) => ({ x: p.observedOn, y: p.value as number }));
  const currency = trendPoints[0]?.currency || selectedChannel?.currencyDefault || "";

  const hasGradeCols = layout === "mahaseel" || prices.some((p) => p.grade || p.cultivationMethod);
  const hasAmmanCols = layout === "amman" || prices.some((p) => p.priceHigh != null || p.quantityTons != null);
  const hasPeriod = prices.some((p) => p.periodFrom || p.periodTo);
  const hasAr = prices.some((p) => p.commodityNameAr);

  if (loading) return <BrandedState label="Loading markets…" loading />;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Market prices</Typography>
        <Typography variant="body2" color="text.secondary">
          {layout === "mahaseel"
            ? "Mahaseel period bulletin: Vegetable · Grade · Cultivation method · Price (kg) — same columns as the official PDF."
            : layout === "amman"
              ? "Amman central market: bilingual names, high / mode / low (JOD from qrsh), tons, origin."
              : "Official channel rows with review status and commodity trends."}
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 2,
              alignItems: { md: "center" },
              flexWrap: "wrap",
            }}
          >
            <FormControl size="small" sx={{ minWidth: 280 }}>
              <InputLabel>Channel</InputLabel>
              <Select
                label="Channel"
                value={channelCode}
                onChange={(e) => {
                  setSeriesKey("");
                  setChannelCode(e.target.value);
                }}
              >
                {channels.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.countryCode} · {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
            {selectedChannel && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip size="small" label={selectedChannel.reviewMode || "HUMAN_REQUIRED"} />
                <Chip size="small" variant="outlined" label={`Harvest ${selectedChannel.harvestIntervalDays ?? "?"}d`} />
                {layout === "mahaseel" && <Chip size="small" color="primary" variant="outlined" label="PDF: grade + method" />}
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {summary && (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
          {[
            { label: "Pending review", value: summary.pendingReview },
            { label: "Auto-approved", value: summary.approvedByChannelPolicy },
            { label: "Human approved", value: summary.approvedByHuman },
            { label: "Rejected", value: summary.rejected },
          ].map((c) => (
            <Card key={c.label}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">{c.label}</Typography>
                <Typography variant="h5">{c.value ?? 0}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Card>
        <CardContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 2,
              alignItems: { sm: "center" },
              mb: 1,
            }}
          >
            <Typography variant="h6" sx={{ flex: 1 }}>
              Trend
            </Typography>
            <FormControl size="small" sx={{ minWidth: 320, maxWidth: 520 }}>
              <InputLabel>Series</InputLabel>
              <Select
                label="Series"
                value={seriesKey}
                onChange={(e) => setSeriesKey(e.target.value)}
              >
                {seriesList.map((s) => (
                  <MenuItem key={s.key} value={s.key}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <SimpleLineChart
            points={chartData}
            yLabel={currency ? `Price (${currency}${layout === "mahaseel" ? "/kg" : ""})` : "Price"}
          />
          <Typography variant="caption" color="text.secondary">
            {selectedSeries
              ? `Series: ${selectedSeries.label}`
              : "Pick a series (commodity + grade + method when present)."}
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Latest rows ({prices.length})
          </Typography>
          {layout === "mahaseel" && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Columns match Mahaseel PDF: Vegetable, Grade, Cultivation Method, Price (kg). Period is the bulletin from–to.
            </Typography>
          )}
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{hasPeriod ? "Period / date" : "Date"}</TableCell>
                  <TableCell>Vegetable</TableCell>
                  {hasAr && <TableCell>AR</TableCell>}
                  {hasGradeCols && <TableCell>Grade</TableCell>}
                  {hasGradeCols && <TableCell>Cultivation method</TableCell>}
                  <TableCell align="right">
                    {layout === "mahaseel" ? "Price (kg)" : layout === "amman" ? "Mode / unit" : "Price"}
                  </TableCell>
                  {hasAmmanCols && <TableCell align="right">High</TableCell>}
                  {hasAmmanCols && <TableCell align="right">Low</TableCell>}
                  {hasAmmanCols && <TableCell align="right">Tons</TableCell>}
                  <TableCell>Review</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {prices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <Typography color="text.secondary">No prices for this channel/window.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  prices.map((p) => {
                    const key = seriesKeyOf(p);
                    const period =
                      p.periodFrom || p.periodTo
                        ? `${isoDay(p.periodFrom) || "?"} → ${isoDay(p.periodTo) || isoDay(p.observedOn)}`
                        : isoDay(p.observedOn);
                    return (
                      <TableRow
                        key={p.id}
                        hover
                        selected={key === seriesKey}
                        onClick={() => setSeriesKey(key)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Typography variant="body2">{period}</Typography>
                          {hasPeriod && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                              obs {isoDay(p.observedOn)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{displayName(p)}</Typography>
                          <Typography variant="caption" color="text.secondary">{p.commodityCode}</Typography>
                        </TableCell>
                        {hasAr && (
                          <TableCell>
                            <Typography variant="body2" dir="rtl">{p.commodityNameAr || "—"}</Typography>
                          </TableCell>
                        )}
                        {hasGradeCols && (
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.grade || "—"}</Typography>
                          </TableCell>
                        )}
                        {hasGradeCols && (
                          <TableCell>
                            <Typography variant="body2">{p.cultivationMethod || "—"}</Typography>
                          </TableCell>
                        )}
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {num(p.unitPrice) ?? num(p.priceMode) ?? "—"} {p.currency}
                          </Typography>
                        </TableCell>
                        {hasAmmanCols && <TableCell align="right">{num(p.priceHigh) ?? "—"}</TableCell>}
                        {hasAmmanCols && <TableCell align="right">{num(p.priceLow) ?? "—"}</TableCell>}
                        {hasAmmanCols && <TableCell align="right">{num(p.quantityTons) ?? "—"}</TableCell>}
                        <TableCell>
                          <Chip
                            size="small"
                            label={p.reviewState}
                            color={
                              p.reviewState === "APPROVED"
                                ? "success"
                                : p.reviewState === "REJECTED"
                                  ? "error"
                                  : "default"
                            }
                          />
                          {p.reviewDecisionSource && p.reviewDecisionSource !== "NONE" && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                              {p.reviewDecisionSource}
                            </Typography>
                          )}
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
    </Stack>
  );
}
