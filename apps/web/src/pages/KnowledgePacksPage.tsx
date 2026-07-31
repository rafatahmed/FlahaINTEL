/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Packs Page
 * Introduction: Browse 4S packs, comparison notes, and human-only review actions.
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
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { BrandedState } from "../components/BrandedState";

type PackItem = {
  id: string;
  sequence: number;
  title: string;
  extractKind: string;
  bodyText?: string | null;
  structured?: Record<string, unknown>;
  sourceUrl?: string | null;
};

type Pack = {
  id: string;
  code: string;
  theme: string;
  title: string;
  summary?: string | null;
  cropTags?: string[];
  regionTags?: string[];
  climateTags?: string[];
  reviewState?: string;
  version?: number;
  items?: PackItem[];
};

const NEXT_ACTIONS: Record<string, Array<{ state: string; label: string }>> = {
  DRAFT: [{ state: "READY_FOR_REVIEW", label: "Submit for review" }, { state: "ARCHIVED", label: "Archive" }],
  READY_FOR_REVIEW: [
    { state: "APPROVED", label: "Approve (human)" },
    { state: "REJECTED", label: "Reject" },
    { state: "DRAFT", label: "Back to draft" },
  ],
  APPROVED: [{ state: "READY_FOR_REVIEW", label: "Re-open review" }, { state: "ARCHIVED", label: "Archive" }],
  REJECTED: [{ state: "DRAFT", label: "Revise (draft)" }, { state: "READY_FOR_REVIEW", label: "Re-submit" }],
  ARCHIVED: [{ state: "DRAFT", label: "Restore draft" }],
};

export function KnowledgePacksPage() {
  const [theme, setTheme] = useState<string>("");
  const [extractKind, setExtractKind] = useState<string>("");
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [bankLevel, setBankLevel] = useState<string>("");
  const [bankCuration, setBankCuration] = useState(true);
  const [bank, setBank] = useState<{
    count: number;
    live: boolean;
    onlyApproved: boolean;
    note?: string;
    entries: Array<Record<string, unknown>>;
  } | null>(null);
  const [cases, setCases] = useState<Array<Record<string, unknown>>>([]);
  const [caseBusy, setCaseBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.knowledgePacks({
        theme: theme || undefined,
        extractKind: extractKind || undefined,
      });
      const list = (res.packs || []) as Pack[];
      setPacks(list);
      setSelectedId((prev) => (list.some((p) => p.id === prev) ? prev : list[0]?.id || ""));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load knowledge packs.");
    } finally {
      setLoading(false);
    }
  }, [theme, extractKind]);

  const loadBank = useCallback(async () => {
    try {
      const b = await api.knowledgeThresholdBank({
        soilTestLevel: bankLevel || undefined,
        onlyApproved: !bankCuration,
      });
      setBank(b);
    } catch {
      setBank(null);
    }
  }, [bankLevel, bankCuration]);

  const loadCases = useCallback(async () => {
    try {
      const res = await api.flahaSoilComparisons();
      setCases(res.cases || []);
    } catch {
      setCases([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadBank();
  }, [loadBank]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const selected = packs.find((p) => p.id === selectedId);
  const comparisonCount = (selected?.items || []).filter((i) => i.extractKind === "COMPARISON_NOTE").length;

  async function review(to: string) {
    if (!selected) return;
    setBusy(true);
    setInfo("");
    try {
      const res = await api.reviewKnowledgePack(selected.id, {
        reviewState: to,
        note: note.trim() || undefined,
      });
      setInfo(`Review → ${to}. Auto-approve: ${String(res.governance?.autoApprove)} · FlahaSOIL auto-update blocked.`);
      setNote("");
      await load();
      await loadBank();
      setSelectedId(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openCaseFromBank(packItemId: string, parameter: string) {
    setCaseBusy(true);
    setInfo("");
    try {
      // Demo values from recon report FLH-2026-001 where known
      const demo: Record<string, number> = {
        ecDsM: 1.0,
        pH: 7.2,
        sar: 0.15,
        organicMatterPercent: 2.5,
      };
      await api.createFlahaSoilComparisonFromThreshold({
        packItemId,
        flahaSoilValue: demo[parameter] ?? null,
        flahaSoilObservation: `Opened from threshold bank for ${parameter}. Optional demo observation from report FLH-2026-001 when available.`,
        flahaSoilReportNumber: "FLH-2026-001",
        flahaSoilTestLevel: "ADVANCED",
        recommendedHumanAction: "review-in-PA",
      });
      setInfo(`Comparison case opened for ${parameter} (DRAFT). Human workflow only — FlahaSOIL not updated.`);
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open comparison case.");
    } finally {
      setCaseBusy(false);
    }
  }

  async function transitionCase(id: string, status: string) {
    setCaseBusy(true);
    try {
      const body: { status: string; note?: string; productTicketRef?: string } = {
        status,
        note: note.trim() || undefined,
      };
      if (status === "PRODUCT_TICKET_OPEN") {
        body.productTicketRef = note.trim() || `SOIL-TICKET-${id.slice(0, 8)}`;
      }
      await api.transitionFlahaSoilComparison(id, body);
      setInfo(`Case → ${status}. doesNotAutoUpdateFlahaSOIL=true`);
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Case transition failed.");
    } finally {
      setCaseBusy(false);
    }
  }

  const CASE_NEXT: Record<string, Array<{ status: string; label: string }>> = {
    DRAFT: [{ status: "READY_FOR_REVIEW", label: "Submit case" }],
    READY_FOR_REVIEW: [
      { status: "APPROVED", label: "Approve case" },
      { status: "REJECTED", label: "Reject" },
    ],
    APPROVED: [
      { status: "PRODUCT_TICKET_OPEN", label: "Open product ticket" },
      { status: "CLOSED", label: "Close" },
    ],
    PRODUCT_TICKET_OPEN: [{ status: "CLOSED", label: "Close" }],
    REJECTED: [{ status: "DRAFT", label: "Back to draft" }],
  };

  if (loading && !packs.length) return <BrandedState label="Loading knowledge packs…" loading />;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Knowledge packs</Typography>
        <Typography variant="body2" color="text.secondary">
          4S-B structured extracts (THRESHOLD, METHOD, COMPARISON_NOTE). Region/climate are tags only.{" "}
          <strong>Human review only — never auto-updates FlahaSOIL.</strong>
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {info && <Alert severity="success" onClose={() => setInfo("")}>{info}</Alert>}

      <Alert severity="info">
        Comparison notes and the threshold bank inform PA / FlahaSOIL discussion. APPROVED means governed knowledge —
        not a write into FlahaSOIL code. Reports use three test levels: PRELIMINARY · MODERATE · ADVANCED.
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Literature threshold bank (4S-C)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {bank?.note || "Loading bank…"} Live: {String(bank?.live ?? false)} · entries: {bank?.count ?? 0}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1.5, alignItems: "center" }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Bank level filter</InputLabel>
              <Select
                label="Bank level filter"
                value={bankLevel}
                onChange={(e) => setBankLevel(e.target.value)}
              >
                <MenuItem value="">All levels</MenuItem>
                <MenuItem value="PRELIMINARY">PRELIMINARY</MenuItem>
                <MenuItem value="MODERATE">MODERATE</MenuItem>
                <MenuItem value="ADVANCED">ADVANCED</MenuItem>
              </Select>
            </FormControl>
            <Button size="small" variant={bankCuration ? "contained" : "outlined"} onClick={() => setBankCuration(true)}>
              Curation (include DRAFT)
            </Button>
            <Button size="small" variant={!bankCuration ? "contained" : "outlined"} onClick={() => setBankCuration(false)}>
              Live (APPROVED only)
            </Button>
          </Box>
          <Box sx={{ overflowX: "auto", maxHeight: 280, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 4 }}>Parameter</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Threshold</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Levels</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Pack state</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Title</th>
                </tr>
              </thead>
              <tbody>
                {(bank?.entries || []).map((e) => (
                  <tr key={String(e.itemId)}>
                    <td style={{ padding: 4 }}>
                      <code>{String(e.parameter || "—")}</code>
                    </td>
                    <td style={{ padding: 4 }}>
                      {String(e.operator || "")}{" "}
                      {e.value != null
                        ? String(e.value)
                        : e.valueMin != null
                          ? `${String(e.valueMin)}–${String(e.valueMax)}`
                          : "—"}{" "}
                      {String(e.unit || "")}
                    </td>
                    <td style={{ padding: 4 }}>
                      {Array.isArray(e.soilTestLevels) ? (e.soilTestLevels as string[]).join(", ") : "—"}
                    </td>
                    <td style={{ padding: 4 }}>{String(e.packReviewState || "—")}</td>
                    <td style={{ padding: 4 }}>
                      {String(e.title || "—")}{" "}
                      <Button
                        size="small"
                        disabled={caseBusy || !e.itemId}
                        onClick={() => void openCaseFromBank(String(e.itemId), String(e.parameter || ""))}
                      >
                        Open case
                      </Button>
                    </td>
                  </tr>
                ))}
                {!bank?.entries?.length && (
                  <tr>
                    <td colSpan={5} style={{ padding: 8, color: "#6B7280" }}>
                      Empty. Seed: npm run knowledge:seed-threshold-bank — then human-approve pack for Live mode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            FlahaSOIL comparison cases (4S-D)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Deviation cases link literature thresholds to report/product observations. Human transitions only — never
            auto-writes FlahaSOIL.
          </Typography>
          {!cases.length ? (
            <Typography variant="body2" color="text.secondary">
              No cases yet. Use <strong>Open case</strong> on a bank row, or seed: npm run knowledge:seed-comparison-cases
            </Typography>
          ) : (
            <Stack spacing={1}>
              {cases.map((c) => (
                <Box
                  key={String(c.id)}
                  sx={{
                    p: 1,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    gap: 1,
                    alignItems: { md: "center" },
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {String(c.title)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      <code>{String(c.parameter)}</code> · lit {String(c.literatureValue ?? c.literatureRange ?? "—")} ·
                      SOIL {String(c.flahaSoilValue ?? "—")} · report {String(c.flahaSoilReportNumber || "—")} ·{" "}
                      {String(c.flahaSoilTestLevel || "—")}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block" }}>
                      {String(c.deviationSummary || "").slice(0, 160)}
                    </Typography>
                  </Box>
                  <Chip size="small" label={String(c.status)} color={c.status === "APPROVED" ? "success" : "default"} />
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {(CASE_NEXT[String(c.status)] || []).map((a) => (
                      <Button
                        key={a.status}
                        size="small"
                        variant="outlined"
                        disabled={caseBusy}
                        onClick={() => void transitionCase(String(c.id), a.status)}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Theme</InputLabel>
          <Select label="Theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="SOIL">Soil</MenuItem>
            <MenuItem value="IRRIGATION">Irrigation</MenuItem>
            <MenuItem value="NUTRITION">Nutrition</MenuItem>
            <MenuItem value="OTHER">Other</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Extract kind</InputLabel>
          <Select label="Extract kind" value={extractKind} onChange={(e) => setExtractKind(e.target.value)}>
            <MenuItem value="">All kinds</MenuItem>
            <MenuItem value="THRESHOLD">THRESHOLD</MenuItem>
            <MenuItem value="METHOD">METHOD</MenuItem>
            <MenuItem value="COMPARISON_NOTE">COMPARISON_NOTE</MenuItem>
            <MenuItem value="EQUATION">EQUATION</MenuItem>
            <MenuItem value="NOTE">NOTE</MenuItem>
            <MenuItem value="REFERENCE">REFERENCE</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 320, flex: 1 }}>
          <InputLabel>Pack</InputLabel>
          <Select
            label="Pack"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={!packs.length}
          >
            {packs.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.theme} · {p.reviewState || "DRAFT"} · {p.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {!selected ? (
        <Alert severity="info">
          No packs yet. Seed with <code>npm run knowledge:seed-samples</code> in apps/api.
        </Alert>
      ) : (
        <>
          <Card>
            <CardContent>
              <Typography variant="h6">{selected.title}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                {selected.code} · v{selected.version ?? 1} · comparison notes: {comparisonCount}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1.5 }}>
                <Chip size="small" color="primary" label={selected.theme} />
                <Chip
                  size="small"
                  label={selected.reviewState || "DRAFT"}
                  color={
                    selected.reviewState === "APPROVED"
                      ? "success"
                      : selected.reviewState === "REJECTED"
                        ? "error"
                        : selected.reviewState === "READY_FOR_REVIEW"
                          ? "warning"
                          : "default"
                  }
                />
                {(selected.regionTags || []).map((t) => (
                  <Chip key={`r-${t}`} size="small" variant="outlined" label={`region:${t}`} />
                ))}
                {(selected.cropTags || []).map((t) => (
                  <Chip key={`c-${t}`} size="small" variant="outlined" label={`crop:${t}`} />
                ))}
              </Box>
              <Typography variant="body2" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>
                {selected.summary || "—"}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Human review
              </Typography>
              <TextField
                size="small"
                fullWidth
                label="Review note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                sx={{ mb: 1 }}
              />
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {(NEXT_ACTIONS[selected.reviewState || "DRAFT"] || []).map((a) => (
                  <Button
                    key={a.state}
                    size="small"
                    variant={a.state === "APPROVED" ? "contained" : "outlined"}
                    color={a.state === "REJECTED" ? "error" : "primary"}
                    disabled={busy}
                    onClick={() => void review(a.state)}
                  >
                    {a.label}
                  </Button>
                ))}
              </Box>
            </CardContent>
          </Card>

          <Stack spacing={1.5}>
            {(selected.items || []).map((item) => {
              const isComparison = item.extractKind === "COMPARISON_NOTE";
              return (
                <Card
                  key={item.id}
                  variant="outlined"
                  sx={{
                    borderColor: isComparison ? "warning.main" : undefined,
                    bgcolor: isComparison ? "rgba(237, 108, 2, 0.04)" : undefined,
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
                      <Chip
                        size="small"
                        label={item.extractKind}
                        color={isComparison ? "warning" : "default"}
                      />
                      {isComparison && <Chip size="small" variant="outlined" label="FlahaSOIL path" />}
                      <Typography variant="subtitle1">{item.title}</Typography>
                    </Box>
                    {item.bodyText && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {item.bodyText}
                      </Typography>
                    )}
                    {item.structured && Object.keys(item.structured).length > 0 && (
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          p: 1.5,
                          bgcolor: "action.hover",
                          borderRadius: 1,
                          fontSize: 12,
                          overflow: "auto",
                        }}
                      >
                        {JSON.stringify(item.structured, null, 2)}
                      </Box>
                    )}
                    {item.structured && (
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                        {typeof item.structured.parameter === "string" && (
                          <Chip size="small" variant="outlined" label={`param:${item.structured.parameter}`} />
                        )}
                        {typeof item.structured.appliesFromLevel === "string" && (
                          <Chip size="small" variant="outlined" label={`from:${item.structured.appliesFromLevel}`} />
                        )}
                        {Array.isArray(item.structured.soilTestLevels) &&
                          (item.structured.soilTestLevels as string[]).map((lv) => (
                            <Chip key={lv} size="small" color="info" variant="outlined" label={lv} />
                          ))}
                      </Box>
                    )}
                    {isComparison && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        autoApplyBlocked / doesNotAutoUpdateFlahaSOIL — product code never changes from this note.
                        Scope notes to FlahaSOIL test levels (PRELIMINARY / MODERATE / ADVANCED).
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </>
      )}
    </Stack>
  );
}
