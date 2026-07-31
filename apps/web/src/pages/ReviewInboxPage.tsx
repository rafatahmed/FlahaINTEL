/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Review Inbox (Brain)
 * Introduction:
 * Unified human-review surface: pipeline candidates, knowledge packs, market
 * prices pending, soil cases, and intake failures — one intelligence brain.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { GovernanceCandidate } from "../types";
import { BrandedState } from "../components/BrandedState";
import type { NavKey } from "../layout/AppShell";

type InboxTab = "candidates" | "packs" | "prices" | "soil" | "intakes";

export function ReviewInboxPage(props: {
  onNavigate?: (key: NavKey, focus?: string) => void;
}) {
  const [tab, setTab] = useState<InboxTab>("candidates");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<GovernanceCandidate[]>([]);
  const [packs, setPacks] = useState<Array<Record<string, unknown>>>([]);
  const [priceSummary, setPriceSummary] = useState<Record<string, number> | null>(null);
  const [pendingPrices, setPendingPrices] = useState<Array<Record<string, unknown>>>([]);
  const [soilCases, setSoilCases] = useState<Array<Record<string, unknown>>>([]);
  const [intakes, setIntakes] = useState<Array<Record<string, unknown>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [c, p, pr, sc, inn] = await Promise.all([
        api.contentList({ limit: 40, reviewState: "READY_FOR_REVIEW" }).catch(() => ({ items: [] as GovernanceCandidate[] })),
        api.knowledgePacks({ reviewState: "READY_FOR_REVIEW" }).catch(() => ({ packs: [] })),
        api.marketReviewSummary({}).catch(() => ({ summary: {} as Record<string, number> })),
        api.flahaSoilComparisons({ status: "READY_FOR_REVIEW" }).catch(() => ({ cases: [] })),
        api.intakeList({ limit: 30 }).catch(() => ({ intakes: [] })),
      ]);
      setCandidates(c.items || []);
      setPacks((p.packs || []) as Array<Record<string, unknown>>);
      setPriceSummary(pr.summary || null);
      setSoilCases((sc.cases || []) as Array<Record<string, unknown>>);
      const allIntakes = (inn.intakes || []) as Array<Record<string, unknown>>;
      setIntakes(
        allIntakes.filter((i) => {
          const s = String(i.status || "");
          return s === "FAILED" || s === "LANDED" || s === "CLASSIFIED";
        }),
      );
      // Sample pending prices (first page)
      try {
        const prices = await api.marketPrices({ reviewState: "PENDING_REVIEW", limit: 25 });
        setPendingPrices((prices.prices || []) as Array<Record<string, unknown>>);
      } catch {
        setPendingPrices([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load review inbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <BrandedState label="Loading review inbox…" loading />;

  const counts = {
    candidates: candidates.length,
    packs: packs.length,
    prices: priceSummary?.pendingReview ?? pendingPrices.length,
    soil: soilCases.length,
    intakes: intakes.length,
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Review inbox</Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Brain</strong> of FlahaINTEL — one place for human decisions. Pipeline candidates, knowledge packs,
          pending market prices, FlahaSOIL cases, and Submit intakes that need attention. Does not auto-write FlahaSOIL,
          FlahaCALC (irrigation/weather), or FlahaFAST (nutrients).
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" },
        }}
      >
        {(
          [
            ["candidates", "Pipeline candidates", counts.candidates],
            ["packs", "Knowledge packs", counts.packs],
            ["prices", "Market prices pending", counts.prices],
            ["soil", "Soil cases", counts.soil],
            ["intakes", "Intakes need action", counts.intakes],
          ] as const
        ).map(([key, label, n]) => (
          <Card
            key={key}
            variant="outlined"
            sx={{
              cursor: "pointer",
              borderColor: tab === key ? "primary.main" : "divider",
              borderWidth: tab === key ? 2 : 1,
            }}
            onClick={() => setTab(key)}
          >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {n}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button size="small" variant="outlined" onClick={() => void load()}>
          Refresh
        </Button>
        <Button size="small" onClick={() => props.onNavigate?.("governance")}>
          Full Governance →
        </Button>
        <Button size="small" onClick={() => props.onNavigate?.("knowledge")}>
          Knowledge hub →
        </Button>
        <Button size="small" onClick={() => props.onNavigate?.("markets")}>
          Markets hub →
        </Button>
        <Button size="small" onClick={() => props.onNavigate?.("submit")}>
          Submit →
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v: InboxTab) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab value="candidates" label={`Candidates (${counts.candidates})`} />
        <Tab value="packs" label={`Packs (${counts.packs})`} />
        <Tab value="prices" label={`Prices (${counts.prices})`} />
        <Tab value="soil" label={`Soil cases (${counts.soil})`} />
        <Tab value="intakes" label={`Intakes (${counts.intakes})`} />
      </Tabs>

      {tab === "candidates" && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Pipeline content ready for governance review
            </Typography>
            {!candidates.length ? (
              <Typography color="text.secondary" variant="body2">
                No candidates in READY_FOR_REVIEW. Content still appears under Content; open Governance for full
                workflow.
              </Typography>
            ) : (
              candidates.map((c) => (
                <Box
                  key={c.id}
                  sx={{
                    py: 1,
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <Chip size="small" label={c.reviewState} color="warning" />
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                    {c.documentTitle || c.titlePreview || c.id}
                  </Typography>
                  <Button size="small" onClick={() => props.onNavigate?.("governance", c.id)}>
                    Open Governance
                  </Button>
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === "packs" && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Knowledge packs READY_FOR_REVIEW (SOIL · CALC · FAST · Markets themes)
            </Typography>
            {!packs.length ? (
              <Typography color="text.secondary" variant="body2">
                No packs awaiting review. Review and approve on Knowledge hub by product lane.
              </Typography>
            ) : (
              packs.map((p) => (
                <Box
                  key={String(p.id)}
                  sx={{
                    py: 1,
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <Chip size="small" label={String(p.theme)} />
                  <Chip size="small" color="warning" label={String(p.reviewState || "DRAFT")} />
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                    {String(p.title)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {String(p.code)}
                  </Typography>
                  <Button size="small" onClick={() => props.onNavigate?.("knowledge")}>
                    Open Knowledge
                  </Button>
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === "prices" && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Market price review mix
            </Typography>
            {priceSummary && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                <Chip label={`Pending ${priceSummary.pendingReview ?? 0}`} color="warning" />
                <Chip label={`Policy auto ${priceSummary.approvedByChannelPolicy ?? 0}`} variant="outlined" />
                <Chip label={`Human ${priceSummary.approvedByHuman ?? 0}`} color="success" variant="outlined" />
                <Chip label={`Rejected ${priceSummary.rejected ?? 0}`} color="error" variant="outlined" />
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Full channel review and trends live on Markets hub. Sample pending rows below.
            </Typography>
            {!pendingPrices.length ? (
              <Typography color="text.secondary" variant="body2">
                No PENDING_REVIEW rows in first page (or all auto-approved by channel policy).
              </Typography>
            ) : (
              pendingPrices.slice(0, 20).map((row) => (
                <Box key={String(row.id)} sx={{ py: 0.75, borderBottom: 1, borderColor: "divider" }}>
                  <Typography variant="body2">
                    {String(row.commodityNameEn || row.commodityName || row.commodityCode)} ·{" "}
                    {String(row.observedOn).slice(0, 10)} · {String(row.unitPrice ?? row.priceMode ?? "—")}{" "}
                    {String(row.currency || "")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {String((row.channel as { code?: string } | undefined)?.code || "")} · {String(row.reviewState)}
                  </Typography>
                </Box>
              ))
            )}
            <Button size="small" sx={{ mt: 1 }} onClick={() => props.onNavigate?.("markets")}>
              Open Markets hub
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "soil" && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              FlahaSOIL comparison cases READY_FOR_REVIEW (not CALC / FAST)
            </Typography>
            {!soilCases.length ? (
              <Typography color="text.secondary" variant="body2">
                No soil cases awaiting review.
              </Typography>
            ) : (
              soilCases.map((c) => (
                <Box key={String(c.id)} sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {String(c.title)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    <code>{String(c.parameter)}</code> · {String(c.status)}
                  </Typography>
                </Box>
              ))
            )}
            <Button size="small" sx={{ mt: 1 }} onClick={() => props.onNavigate?.("knowledge")}>
              Open Knowledge → FlahaSOIL
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "intakes" && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Submit intakes: LANDED / CLASSIFIED / FAILED
            </Typography>
            {!intakes.length ? (
              <Typography color="text.secondary" variant="body2">
                No open intakes. New human lands appear on Submit → Recent.
              </Typography>
            ) : (
              intakes.map((i) => (
                <Box
                  key={String(i.id)}
                  sx={{
                    py: 1,
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    gap: 1,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <Chip
                    size="small"
                    label={String(i.status)}
                    color={i.status === "FAILED" ? "error" : "info"}
                  />
                  <Chip size="small" variant="outlined" label={String(i.intakeClass)} />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {String(i.title)}
                  </Typography>
                  {i.errorMessage ? (
                    <Typography variant="caption" color="error">
                      {String(i.errorCode)}: {String(i.errorMessage).slice(0, 80)}
                    </Typography>
                  ) : null}
                </Box>
              ))
            )}
            <Button size="small" sx={{ mt: 1 }} onClick={() => props.onNavigate?.("submit")}>
              Open Submit
            </Button>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
