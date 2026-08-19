/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Operational Dashboard
 * Introduction: Whole-intelligence scorecard — eyes, muscles, backbone, brain, product feeds.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-01
 */
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import { BrandedState } from "../components/BrandedState";
import type { NavKey } from "../layout/AppShell";

export function DashboardPage(props: { onNavigate?: (key: NavKey) => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [intel, setIntel] = useState<{
    pendingGovernance: number;
    packsReady: number;
    pricesPending: number;
    soilCasesReady: number;
    intakesOpen: number;
    marketChannels: number;
  } | null>(null);
  const [pa, setPa] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Core dashboard first — never block shell on secondary scorecards.
        const dash = await api.dashboard();
        if (cancelled) return;
        setData(dash);
        setError("");
        setLoading(false);

        const [packs, prices, soil, intakes, channels, paDash] = await Promise.all([
          api.knowledgePacks({ reviewState: "READY_FOR_REVIEW" }).catch(() => ({ packs: [] })),
          api.marketReviewSummary({}).catch(() => ({ summary: {} as Record<string, number> })),
          api.flahaSoilComparisons({ status: "READY_FOR_REVIEW" }).catch(() => ({ cases: [] })),
          api.intakeList({ limit: 50 }).catch(() => ({ intakes: [] })),
          api.marketChannels().catch(() => ({ channels: [] })),
          api.paDashboard().catch(() => null),
        ]);
        if (cancelled) return;
        setPa(paDash);
        const openIntakes = ((intakes.intakes || []) as Array<Record<string, unknown>>).filter((i) =>
          ["LANDED", "CLASSIFIED", "FAILED"].includes(String(i.status)),
        ).length;
        const counts = (dash.counts || {}) as { pendingGovernance?: number };
        setIntel({
          pendingGovernance: counts.pendingGovernance ?? 0,
          packsReady: (packs.packs || []).length,
          pricesPending: prices.summary?.pendingReview ?? 0,
          soilCasesReady: (soil.cases || []).length,
          intakesOpen: openIntakes,
          marketChannels: (channels.channels || []).length,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Dashboard failed.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <BrandedState label="Loading dashboard…" loading />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <BrandedState label="No dashboard data." />;

  const counts = (data.counts || {}) as {
    pendingGovernance?: number;
    promotionEligible?: number;
    jobStates?: Record<string, number>;
  };
  const submissions = (data.recentSubmissions || []) as Array<Record<string, unknown>>;
  const jobs = (data.recentJobs || []) as Array<Record<string, unknown>>;
  const failures = (data.recentFailures || []) as Array<Record<string, unknown>>;
  const readiness = data.readiness as {
    overall?: string;
    components?: Array<{ component: string; state: string; detail: string }>;
  } | undefined;
  const sources = (data.sourceHealth || []) as Array<Record<string, unknown>>;
  const badComponents = (readiness?.components || []).filter(
    (c) => c.state === "UNAVAILABLE" || c.state === "DEGRADED",
  );
  const notConfigured = (readiness?.components || []).filter((c) => c.state === "NOT_CONFIGURED");

  const go = (key: NavKey) => props.onNavigate?.(key);

  const mapCards: Array<{
    layer: string;
    title: string;
    purpose: string;
    nav: NavKey;
    metric?: string | number;
  }> = [
    {
      layer: "Eyes",
      title: "Sources",
      purpose: "Recurring RSS we watch on a schedule",
      nav: "sources",
      metric: sources.length,
    },
    {
      layer: "Eyes",
      title: "Articles",
      purpose: "Collected RSS items — search, filter, inspect",
      nav: "articles",
    },
    {
      layer: "Eyes",
      title: "Submit",
      purpose: "Human intake: land → classify → promote",
      nav: "submit",
      metric: intel?.intakesOpen ?? "—",
    },
    {
      layer: "Eyes",
      title: "Markets",
      purpose: "Official prices, trends, retention",
      nav: "markets",
      metric: intel?.marketChannels ?? "—",
    },
    {
      layer: "Muscles",
      title: "Jobs",
      purpose: "Pipeline execution (acquire / extract / normalize)",
      nav: "jobs",
      metric: counts.jobStates?.FAILED ?? 0,
    },
    {
      layer: "Backbone",
      title: "Artifacts",
      purpose: "Immutable evidence blobs (proof)",
      nav: "artifacts",
    },
    {
      layer: "Structure",
      title: "Content",
      purpose: "Normalized candidates queue",
      nav: "content",
      metric: intel?.pendingGovernance ?? counts.pendingGovernance ?? 0,
    },
    {
      layer: "Brain",
      title: "Review inbox",
      purpose: "Unified human decisions (all queues)",
      nav: "review",
      metric:
        (intel?.pendingGovernance ?? 0) +
        (intel?.packsReady ?? 0) +
        (intel?.pricesPending ?? 0) +
        (intel?.soilCasesReady ?? 0) +
        (intel?.intakesOpen ?? 0),
    },
    {
      layer: "Feeds",
      title: "Knowledge",
      purpose: "Packs for SOIL · CALC · FAST · Markets",
      nav: "knowledge",
      metric: intel?.packsReady ?? "—",
    },
  ];

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          Whole FlahaINTEL intelligence: Eyes → Muscles → Backbone → Brain → product feeds (FlahaSOIL · FlahaCALC
          irrigation/weather · FlahaFAST nutrients — separate products).
        </Typography>
      </Box>

      {readiness?.overall && readiness.overall !== "READY" && (
        <Alert severity={readiness.overall === "UNAVAILABLE" ? "error" : "warning"}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            System {readiness.overall}
            {badComponents[0] ? ` — ${badComponents.map((c) => c.component).join(", ")}` : ""}
          </Typography>
          {badComponents.map((c) => (
            <Typography key={c.component} variant="body2">
              <strong>{c.component}</strong>: {c.detail}
            </Typography>
          ))}
          {readiness.overall === "UNAVAILABLE" && badComponents.some((c) => c.component === "DiskCapacity") && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Free space on the API disk is below the block threshold. Free disk on C:, then refresh.
            </Typography>
          )}
          {notConfigured.some((c) => c.component === "WorkerLoops") && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Worker loops are not running (pipeline jobs stay READY). Optional for market harvest alone.
            </Typography>
          )}
        </Alert>
      )}

      {/* 4B-B PA scorecard */}
      {pa && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              PA scorecard (4B-B) — pack health · market freshness · handoff readiness
            </Typography>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                mb: 1.5,
              }}
            >
              {(() => {
                const packs = (pa.packs || {}) as Record<string, number>;
                const markets = (pa.markets || {}) as Record<string, number>;
                const handoff = (pa.handoff || {}) as { exportsLast7d?: number };
                return [
                  { label: "Packs APPROVED", value: packs.approved ?? 0 },
                  { label: "Packs ready", value: packs.readyForReview ?? 0 },
                  { label: "Prices pending", value: markets.pendingReview ?? 0 },
                  { label: "Handoffs (7d)", value: handoff.exportsLast7d ?? 0 },
                ].map((c) => (
                  <Box key={c.label}>
                    <Typography variant="caption" color="text.secondary">
                      {c.label}
                    </Typography>
                    <Typography variant="h5">{c.value}</Typography>
                  </Box>
                ));
              })()}
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
              {(((pa.handoff as { byTarget?: Array<Record<string, unknown>> })?.byTarget) || []).map(
                (t) => (
                  <Chip
                    key={String(t.targetProduct)}
                    size="small"
                    color={t.canExport ? "success" : "default"}
                    variant={t.canExport ? "filled" : "outlined"}
                    label={`${String(t.targetProduct)}: ${String(t.approvedPackCount ?? 0)} approved${t.canExport ? " · export ready" : ""}`}
                    onClick={() => go("knowledge")}
                  />
                ),
              )}
            </Box>
            {Boolean((pa.markets as { staleChannelCount?: number })?.staleChannelCount) && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {(pa.markets as { staleChannelCount: number }).staleChannelCount} market channel(s) look
                stale — check Markets harvest.
              </Alert>
            )}
            <Typography variant="caption" color="text.secondary">
              Feed policies enforce one product per handoff (CALC ≠ FAST ≠ SOIL). Auto-apply always blocked.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Typography variant="overline" color="text.secondary">
        Intelligence map — click to open
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
        }}
      >
        {mapCards.map((card) => (
          <Card key={card.title} variant="outlined" sx={{ height: "100%" }}>
            <CardActionArea onClick={() => go(card.nav)} sx={{ height: "100%", alignItems: "stretch" }}>
              <CardContent>
                <Chip size="small" label={card.layer} sx={{ mb: 0.5 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {card.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", minHeight: 36 }}>
                  {card.purpose}
                </Typography>
                {card.metric !== undefined && (
                  <Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
                    {String(card.metric)}
                  </Typography>
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      <Typography variant="overline" color="text.secondary">
        Attention counters
      </Typography>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
        {[
          {
            label: "Candidates (governance)",
            value: intel?.pendingGovernance ?? counts.pendingGovernance ?? 0,
            nav: "review" as NavKey,
          },
          { label: "Packs ready for review", value: intel?.packsReady ?? 0, nav: "review" as NavKey },
          { label: "Prices pending review", value: intel?.pricesPending ?? 0, nav: "review" as NavKey },
          { label: "Soil cases ready", value: intel?.soilCasesReady ?? 0, nav: "review" as NavKey },
          { label: "Intakes open/failed", value: intel?.intakesOpen ?? 0, nav: "submit" as NavKey },
          { label: "Promotion eligible", value: counts.promotionEligible ?? 0, nav: "governance" as NavKey },
          { label: "System", value: readiness?.overall ?? "—", nav: "settings" as NavKey },
          { label: "Jobs FAILED", value: counts.jobStates?.FAILED ?? 0, nav: "jobs" as NavKey },
        ].map((card) => (
          <Card key={card.label} variant="outlined">
            <CardActionArea onClick={() => go(card.nav)}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {card.label}
                </Typography>
                <Typography variant="h5">{String(card.value)}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button variant="contained" size="small" onClick={() => go("review")}>
          Open Review inbox
        </Button>
        <Button variant="outlined" size="small" onClick={() => go("submit")}>
          Submit evidence
        </Button>
        <Button variant="outlined" size="small" onClick={() => go("markets")}>
          Markets
        </Button>
        <Button variant="outlined" size="small" onClick={() => go("knowledge")}>
          Knowledge
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent submissions
          </Typography>
          {submissions.length === 0 ? (
            <Typography color="text.secondary">No submissions yet.</Typography>
          ) : (
            submissions.map((s) => (
              <Box key={String(s.id)} sx={{ display: "flex", gap: 1, py: 0.5, alignItems: "center" }}>
                <Chip size="small" label={String(s.overallStatus)} />
                <Typography variant="body2">{String(s.titlePreview || s.id)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {String(s.currentStage)}
                </Typography>
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent jobs
          </Typography>
          {jobs.slice(0, 8).map((j) => (
            <Box key={String(j.id)} sx={{ display: "flex", gap: 1, py: 0.5, alignItems: "center" }}>
              <Chip
                size="small"
                label={String(j.state)}
                color={j.state === "SUCCEEDED" ? "success" : j.state === "FAILED" ? "error" : "default"}
              />
              <Typography variant="body2">{String(j.requestedCapability)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {String(j.jobType)}
              </Typography>
            </Box>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Source health (RSS eyes)
          </Typography>
          {sources.length === 0 ? (
            <Typography color="text.secondary">No sources loaded.</Typography>
          ) : (
            sources.map((s) => (
              <Typography key={String(s.id)} variant="body2">
                {String(s.name)} · {s.enabled ? "enabled" : "disabled"} ·{" "}
                {s.lastError ? `error: ${String(s.lastError).slice(0, 80)}` : "ok"}
              </Typography>
            ))
          )}
        </CardContent>
      </Card>

      {failures.length > 0 && (
        <Alert severity="warning">
          Recent failures: {failures.map((f) => String(f.requestedCapability)).join(", ")}
        </Alert>
      )}
    </Stack>
  );
}
