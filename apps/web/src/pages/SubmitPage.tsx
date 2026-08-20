/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Submit — Evidence Intake Spine
 * Introduction:
 * Central human intake: land once → classify → promote to domain engines
 * (eyes pipeline, markets, soil reports). Not per-model re-upload silos.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-21
 */
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

type IntakeClassCode =
  | "UNCLASSIFIED"
  | "EYES_WEBSITE"
  | "EYES_DOCUMENT"
  | "MARKET_MAHASEEL_PDF"
  | "MARKET_JO_AMMAN_EXCEL"
  | "PRODUCT_SOIL_REPORT"
  | "PRODUCT_CALC_REPORT"
  | "PRODUCT_FAST_REPORT";

type ClassMeta = {
  code: string;
  label: string;
  lane: string;
  promote: string;
  acceptHint: string;
};

type IntakeRow = {
  id: string;
  intakeClass: string;
  status: string;
  title: string;
  originalFilename?: string | null;
  sourceUrl?: string | null;
  promoteResult?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  productSubmissionId?: string | null;
  createdAt?: string;
  meta?: ClassMeta;
  pipeline?: {
    kind?: string;
    finished?: boolean;
    overallStatus?: string;
    currentStage?: string;
    extractionJobState?: string | null;
    governanceCandidateId?: string | null;
    operatorNote?: string;
    submissionId?: string;
  };
};

type HubTab = "new" | "recent";

const FILE_CLASS_OPTIONS: Array<{ code: IntakeClassCode; label: string; accept: string; hint: string }> = [
  {
    code: "EYES_DOCUMENT",
    label: "General document → Eyes pipeline (Jobs → Content → Governance)",
    accept: ".pdf,.docx,.rtf,.txt,application/pdf,text/plain,application/rtf",
    hint: "Pipeline only. Needs extraction workers. Not Knowledge packs / literature desk. For science papers prefer Knowledge New pack + HTTPS reference, or register literature.",
  },
  {
    code: "MARKET_MAHASEEL_PDF",
    label: "Mahaseel price PDF → Markets",
    accept: ".pdf,application/pdf",
    hint: "Creates market price rows.",
  },
  {
    code: "MARKET_JO_AMMAN_EXCEL",
    label: "Jordan Amman Excel → Markets",
    accept: ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv",
    hint: "Creates Amman market price rows.",
  },
  {
    code: "PRODUCT_SOIL_REPORT",
    label: "FlahaSOIL report → Comparison cases",
    accept: ".pdf,.json,application/pdf,application/json",
    hint: "Opens soil comparison cases. Never writes FlahaSOIL engines.",
  },
  {
    code: "PRODUCT_CALC_REPORT",
    label: "FlahaCALC report (irrigation/weather) → Knowledge IRRIGATION pack",
    accept: ".pdf,.json,application/pdf,application/json",
    hint: "DRAFT IRRIGATION pack. Human review + real literature URL before Approve.",
  },
  {
    code: "PRODUCT_FAST_REPORT",
    label: "FlahaFAST report (nutrients) → Knowledge NUTRITION pack",
    accept: ".pdf,.json,application/pdf,application/json",
    hint: "DRAFT NUTRITION pack. Human review + real literature URL before Approve.",
  },
];

function statusColor(s: string): "default" | "success" | "warning" | "error" | "info" {
  if (s === "PROMOTED") return "success";
  if (s === "FAILED" || s === "REJECTED") return "error";
  if (s === "PROMOTING" || s === "CLASSIFIED") return "warning";
  if (s === "LANDED") return "info";
  return "default";
}

/** Human-readable promote outcome (intake PROMOTED ≠ pipeline finished). */
function describePromote(row: IntakeRow): { severity: "success" | "warning" | "info" | "error"; text: string } {
  const pr = (row.promoteResult || {}) as Record<string, unknown>;
  const pipe = row.pipeline;
  const kind = String(pr.kind || row.intakeClass || "");
  if (kind === "EYES_DOCUMENT" || kind === "EYES_WEBSITE" || pipe?.kind === "eyes_submission") {
    const overall = String(pipe?.overallStatus || pr.overallStatus || "");
    const stage = String(pipe?.currentStage || pr.currentStage || "");
    const subId = String(pipe?.submissionId || pr.submissionId || "").slice(0, 8) || "—";
    if (pipe?.finished && pipe.governanceCandidateId) {
      return {
        severity: "success",
        text: `Eyes pipeline finished. Candidate ${String(pipe.governanceCandidateId).slice(0, 8)}… — open Content / Governance. Not a Knowledge pack.`,
      };
    }
    if (overall === "FAILED" || overall === "CANCELLED") {
      return {
        severity: "error",
        text: `Eyes pipeline ${overall} at ${stage}. Check Jobs. ${pipe?.operatorNote || ""}`,
      };
    }
    if (overall === "RUNNING" || overall === "ACCEPTED" || !pipe?.finished) {
      const step =
        stage === "ACQUISITION"
          ? "fetch the website"
          : stage === "EXTRACTION"
            ? "extract text"
            : stage === "NORMALIZATION"
              ? "prepare for review"
              : stage === "GOVERNANCE"
                ? "open in Governance"
                : (stage || "process");
      return {
        severity: "info",
        text: `Accepted (submission ${subId}…). Now: ${step}. The host does one item at a time; this starts when the previous item finishes. Open Jobs to watch. Then Content → Governance.`,
      };
    }
    return {
      severity: "info",
      text: `Accepted (submission ${subId}…). Waiting to start the next step — one item at a time.`,
    };
  }
  if (kind === "PRODUCT_SOIL_REPORT") {
    const n = pr.casesCreated != null ? Number(pr.casesCreated) : null;
    return {
      severity: n && n > 0 ? "success" : "warning",
      text: `FlahaSOIL: ${n ?? "?"} comparison case(s). Open Knowledge → FlahaSOIL → cases. Not a knowledge pack.`,
    };
  }
  if (kind === "PRODUCT_CALC_REPORT" || kind === "PRODUCT_FAST_REPORT") {
    return {
      severity: "success",
      text: `${String(pr.product || kind)} → DRAFT pack ${String(pr.packCode || pr.packId || "")}. Open Knowledge → ${kind.includes("CALC") ? "FlahaCALC" : "FlahaFAST"}. Attach HTTPS literature before Approve.`,
    };
  }
  if (kind.includes("MARKET") || kind === "MARKET_MAHASEEL_PDF" || kind === "MARKET_JO_AMMAN_EXCEL") {
    return { severity: "success", text: "Markets promote — check Markets for price rows." };
  }
  return {
    severity: "info",
    text: pr.kind ? `Promote: ${JSON.stringify(pr).slice(0, 220)}` : "No promote detail.",
  };
}

export function SubmitPage(props: {
  onOpenSubmission?: (id: string) => void;
  /** Deep-link after promote (e.g. knowledge soil cases, markets, calc/fast lanes) */
  onDeepLink?: (link: { nav: string; lane?: string; soilTool?: string; channelCode?: string }) => void;
}) {
  const [tab, setTab] = useState<HubTab>("new");
  const [matrix, setMatrix] = useState<{
    principle: string;
    classes: ClassMeta[];
    harvest?: { hosts: Array<{ host: string; pathPrefixes: string[] }> };
  } | null>(null);
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // website form
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [autoChain, setAutoChain] = useState(true);
  const [mode, setMode] = useState<"STATIC" | "BROWSER">("STATIC");

  // file form
  const [fileClass, setFileClass] = useState<IntakeClassCode>("EYES_DOCUMENT");
  const [files, setFiles] = useState<File[]>([]);
  const [autoPromote, setAutoPromote] = useState(true);

  const loadRecent = useCallback(async () => {
    try {
      const res = await api.intakeList({ limit: 40 });
      setIntakes((res.intakes || []) as IntakeRow[]);
    } catch {
      setIntakes([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const m = await api.intakeMatrix();
        setMatrix({ principle: m.principle, classes: m.classes as ClassMeta[], harvest: m.harvest });
      } catch {
        setMatrix(null);
      }
      await loadRecent();
    })();
  }, [loadRecent]);

  async function landWebsite() {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const res = await api.intakeLandWebsite({
        url,
        languageHint: language,
        acquisitionMode: mode,
        chainMode: autoChain ? "AUTO_CHAIN" : "MANUAL_STAGE",
        idempotencyKey: `web-ui-${Date.now()}`,
      });
      const intake = res.intake as IntakeRow;
      setInfo(
        `Accepted this page. Fetch starts now (one item at a time). Open Jobs to watch; Content / Governance fill after extract finishes.`,
      );
      await loadRecent();
      setTab("recent");
      if (intake.productSubmissionId && props.onOpenSubmission) {
        props.onOpenSubmission(String(intake.productSubmissionId));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Website intake failed.");
    } finally {
      setBusy(false);
    }
  }

  async function landFile() {
    if (!files.length) {
      setError("Choose a file.");
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    const notes: string[] = [];
    let lastSubId: string | null = null;
    let lastDeepLink: { nav: string; lane?: string; soilTool?: string; channelCode?: string } | null = null;
    try {
      for (let i = 0; i < files.length; i++) {
        const current = files[i]!;
        setInfo(`Checking ${i + 1} of ${files.length}: ${current.name}…`);
        const form = new FormData();
        form.append("file", current);
        form.append("intakeClass", fileClass);
        form.append("autoPromote", autoPromote ? "true" : "false");
        form.append("idempotencyKey", `file-ui-${Date.now()}-${i}`);
        const res = await api.intakeLandFile(form);
        const intake = res.intake as IntakeRow;
        notes.push(
          `${i + 1}/${files.length} ${current.name}: ${intake.status}` +
            (intake.errorMessage ? ` (${intake.errorCode})` : ""),
        );
        if (intake.productSubmissionId) lastSubId = String(intake.productSubmissionId);
        const pr = intake.promoteResult as { deepLink?: { nav: string; lane?: string; soilTool?: string; channelCode?: string } } | null;
        if (pr?.deepLink) lastDeepLink = pr.deepLink;
      }
      setInfo(
        notes.join(" · ") +
          (files.length > 1
            ? " Each file was checked then accepted in order. The host processes one at a time; the next starts when the current one finishes."
            : " Checked and accepted. The host processes one item at a time — open Jobs to watch."),
      );
      if (lastSubId && props.onOpenSubmission) props.onOpenSubmission(lastSubId);
      if (lastDeepLink && props.onDeepLink) props.onDeepLink(lastDeepLink);
      setFiles([]);
      await loadRecent();
      setTab("recent");
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "File intake failed.") +
          (notes.length ? ` Stopped after ${notes.length} of ${files.length}.` : ""),
      );
      await loadRecent();
    } finally {
      setBusy(false);
    }
  }

  async function advanceEyes(row: IntakeRow) {
    const subId = row.productSubmissionId || row.pipeline?.submissionId;
    if (!subId) return;
    setBusy(true);
    setError("");
    try {
      const sub = await api.advanceSubmission(String(subId));
      setInfo(
        `Moved to stage ${String(sub.currentStage || "?")} · ${String(sub.overallStatus || "?")}. If it still says waiting to start, the host is finishing the current item.`,
      );
      await loadRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Advance failed — extraction job may still be READY (need workers).");
    } finally {
      setBusy(false);
    }
  }

  async function promote(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await api.intakePromote(id);
      const intake = res.intake as IntakeRow;
      setInfo(`Promoted ${intake.id} → ${intake.status}`);
      await loadRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promote failed.");
    } finally {
      setBusy(false);
    }
  }

  async function classifyAndPromote(id: string, intakeClass: string) {
    setBusy(true);
    setError("");
    try {
      const res = await api.intakeClassify(id, { intakeClass, autoPromote: true });
      const intake = res.intake as IntakeRow;
      setInfo(`Classified + promote ${intake.id} → ${intake.status}`);
      await loadRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classify failed.");
    } finally {
      setBusy(false);
    }
  }

  const accept = FILE_CLASS_OPTIONS.find((o) => o.code === fileClass)?.accept || "*";

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Submit — Evidence intake</Typography>
        <Typography variant="body2" color="text.secondary">
          {matrix?.principle ||
            "Land once on the evidence spine; promote into domain engines — do not re-ingest per model."}
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

      <Tabs value={tab} onChange={(_, v: HubTab) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab value="new" label="New intake" />
        <Tab value="recent" label={`Recent (${intakes.length})`} />
      </Tabs>

      {tab === "new" && (
        <Stack spacing={2}>
          <Alert severity="info">
            <strong>Flow:</strong> check the file or URL → accept it → process <em>one at a time</em> (fetch or extract
            → prepare for review → Governance). Several files: the next waits until the current one finishes. Sister
            products stay separate: FlahaSOIL · FlahaCALC · FlahaFAST — <strong>never</strong> auto-written.
          </Alert>

          {/* Type matrix cards */}
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
            }}
          >
            {(matrix?.classes || [])
              .filter((c) => c.code !== "UNCLASSIFIED")
              .map((c) => (
                <Card key={c.code} variant="outlined">
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Chip size="small" label={c.lane} sx={{ mb: 0.5 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {c.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {c.acceptHint}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      → {c.promote}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
          </Box>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                One webpage
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Paste <strong>one page URL</strong>. Flaha fetches that page, extracts text, then you Approve it in
                Governance. This is <strong>not RSS</strong> (RSS feeds are registered under Sources and run on a
                schedule). It is also not an open-web crawl: the host only fetches sites on the Eyes harvest list
                below. If the URL is not on that list, Submit stops immediately — nothing appears in Jobs.
              </Typography>
              {(matrix?.harvest?.hosts?.length ?? 0) > 0 && (
                <Box sx={{ my: 1, p: 1, bgcolor: "action.hover", borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    Eyes harvest list (host + path). Adding a new site is an ops list change, not “allow anything”.
                  </Typography>
                  {matrix!.harvest!.hosts.map((h) => (
                    <Typography key={h.host} variant="caption" sx={{ display: "block", fontFamily: "monospace" }}>
                      {h.host}
                      {h.pathPrefixes?.length ? ` → ${h.pathPrefixes.join(", ")}` : ""}
                    </Typography>
                  ))}
                </Box>
              )}
              <Stack spacing={1.5}>
                <TextField
                  label="Page URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  fullWidth
                  placeholder="https://www.yara.com/corporate-releases/…"
                />
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                  <TextField
                    label="Language hint"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    size="small"
                  />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Acquisition</InputLabel>
                    <Select
                      label="Acquisition"
                      value={mode}
                      onChange={(e) => setMode(e.target.value as "STATIC" | "BROWSER")}
                    >
                      <MenuItem value="STATIC">STATIC</MenuItem>
                      <MenuItem value="BROWSER">BROWSER</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={<Switch checked={autoChain} onChange={(e) => setAutoChain(e.target.checked)} />}
                    label="Then extract and send to Governance"
                  />
                </Box>
                <Button variant="contained" disabled={busy || !url.trim()} onClick={() => void landWebsite()}>
                  Fetch this page
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                File (land → classify → promote)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose the evidence type, then one or more files, then <strong>Land file → promote</strong>. Each file
                is checked, then accepted, then processed in order. Eyes documents finish at human Approve (not RSS).
              </Typography>
              <Stack spacing={1.5}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Evidence type</InputLabel>
                  <Select
                    label="Evidence type"
                    value={fileClass}
                    onChange={(e) => {
                      setFileClass(e.target.value as IntakeClassCode);
                      setFiles([]);
                    }}
                  >
                    {FILE_CLASS_OPTIONS.map((o) => (
                      <MenuItem key={o.code} value={o.code}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary">
                  {FILE_CLASS_OPTIONS.find((o) => o.code === fileClass)?.hint || ""} PPTX rejected. Sister products
                  stay separate (SOIL · CALC · FAST).
                </Typography>
                <Button variant="outlined" component="label">
                  Choose file(s)
                  <input
                    hidden
                    type="file"
                    multiple
                    accept={accept}
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                </Button>
                <Typography variant="body2" sx={{ fontWeight: files.length ? 600 : 400 }}>
                  {files.length
                    ? files.map((f, i) => `${i + 1}. ${f.name} (${f.size} bytes)`).join(" · ")
                    : "No file selected yet"}
                </Typography>
                <FormControlLabel
                  control={<Switch checked={autoPromote} onChange={(e) => setAutoPromote(e.target.checked)} />}
                  label="Auto-promote after land (recommended)"
                />
                <Button variant="contained" disabled={busy || !files.length} onClick={() => void landFile()}>
                  {files.length > 1
                    ? `Check and accept ${files.length} files in order`
                    : `Land file${autoPromote ? " → promote" : ""}`}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                RSS feeds (separate)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                RSS is a registered feed that Flaha collects on a schedule under <strong>Sources</strong>. Pasting a
                webpage URL here does not create an RSS source and does not use RSS rules.
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      )}

      {tab === "recent" && (
        <Stack spacing={1.5}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" variant="outlined" onClick={() => void loadRecent()} disabled={busy}>
              Refresh
            </Button>
          </Box>
          {!intakes.length ? (
            <Alert severity="info">No intakes yet. Land a website or file from the New tab.</Alert>
          ) : (
            intakes.map((row) => (
              <Card key={row.id} variant="outlined">
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 0.5 }}>
                    <Chip size="small" color={statusColor(row.status)} label={row.status} />
                    <Chip size="small" variant="outlined" label={row.intakeClass} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                      {row.title}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {row.id}
                    {row.originalFilename ? ` · ${row.originalFilename}` : ""}
                    {row.sourceUrl ? ` · ${row.sourceUrl}` : ""}
                    {row.createdAt ? ` · ${String(row.createdAt).slice(0, 19)}` : ""}
                  </Typography>
                  {row.errorMessage && (
                    <Typography variant="caption" color="error" sx={{ display: "block" }}>
                      {row.errorCode}: {row.errorMessage}
                    </Typography>
                  )}
                  {row.promoteResult && (() => {
                    const d = describePromote(row);
                    return (
                      <Alert severity={d.severity} sx={{ mt: 1, py: 0.5 }}>
                        <Typography variant="caption" component="div">
                          {d.text}
                        </Typography>
                      </Alert>
                    );
                  })()}
                  <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                    {(row.status === "LANDED" ||
                      row.status === "CLASSIFIED" ||
                      row.status === "FAILED" ||
                      row.status === "PROMOTING") &&
                      row.intakeClass !== "UNCLASSIFIED" && (
                        <Button size="small" variant="contained" disabled={busy} onClick={() => void promote(row.id)}>
                          {row.status === "PROMOTING" ? "Retry promote" : "Promote"}
                        </Button>
                      )}
                    {row.status === "LANDED" && row.intakeClass === "UNCLASSIFIED" && (
                      <>
                        {FILE_CLASS_OPTIONS.map((o) => (
                          <Button
                            key={o.code}
                            size="small"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => void classifyAndPromote(row.id, o.code)}
                          >
                            As {o.code.replace(/_/g, " ")}
                          </Button>
                        ))}
                      </>
                    )}
                    {row.productSubmissionId && props.onOpenSubmission && (
                      <Button
                        size="small"
                        onClick={() => props.onOpenSubmission?.(String(row.productSubmissionId))}
                      >
                        Open Jobs (pipeline)
                      </Button>
                    )}
                    {row.productSubmissionId &&
                      row.pipeline &&
                      !row.pipeline.finished &&
                      (row.intakeClass === "EYES_DOCUMENT" || row.intakeClass === "EYES_WEBSITE") && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={busy}
                          onClick={() => void advanceEyes(row)}
                        >
                          Advance submission
                        </Button>
                      )}
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}
    </Stack>
  );
}
