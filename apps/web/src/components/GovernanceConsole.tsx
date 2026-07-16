/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Internal Governance Review Console
 * Introduction: Narrow internal UI for candidate queue, detail, decisions, history, and evidence.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, setGovernanceAuth } from "../api";
import type {
  GovernanceCandidate,
  GovernanceDecision,
  GovernanceEvidence,
  GovernancePreview,
  GovernanceReviewState,
} from "../types";
import { BrandedState } from "./BrandedState";

const STATES: GovernanceReviewState[] = [
  "PENDING_EVALUATION", "READY_FOR_REVIEW", "NEEDS_CORRECTION", "ON_HOLD",
  "APPROVED", "REJECTED", "PROMOTION_ELIGIBLE", "PROMOTED", "WITHDRAWN",
];

const ACTIONS: Array<{
  key: "approve" | "reject" | "request-correction" | "hold" | "release-hold" | "withdraw-approval" | "mark-promotion-eligible" | "withdraw";
  label: string;
  states: GovernanceReviewState[];
}> = [
  { key: "approve", label: "Approve", states: ["READY_FOR_REVIEW", "ON_HOLD"] },
  { key: "reject", label: "Reject", states: ["READY_FOR_REVIEW", "ON_HOLD", "NEEDS_CORRECTION"] },
  { key: "request-correction", label: "Request correction", states: ["READY_FOR_REVIEW", "ON_HOLD", "APPROVED"] },
  { key: "hold", label: "Place on hold", states: ["READY_FOR_REVIEW", "NEEDS_CORRECTION", "APPROVED"] },
  { key: "release-hold", label: "Release hold", states: ["ON_HOLD"] },
  { key: "withdraw-approval", label: "Withdraw approval", states: ["APPROVED", "PROMOTION_ELIGIBLE"] },
  { key: "mark-promotion-eligible", label: "Mark promotion eligible", states: ["APPROVED"] },
  { key: "withdraw", label: "Withdraw", states: ["PENDING_EVALUATION", "READY_FOR_REVIEW", "NEEDS_CORRECTION", "ON_HOLD", "APPROVED", "PROMOTION_ELIGIBLE"] },
];

function ageLabel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function GovernanceConsole() {
  const [userId, setUserId] = useState(localStorage.getItem("flaha.governance.userId") ?? "");
  const [tenantId, setTenantId] = useState(localStorage.getItem("flaha.governance.tenantId") ?? "");
  const [stateFilter, setStateFilter] = useState<string>("");
  const [candidates, setCandidates] = useState<GovernanceCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GovernanceCandidate | null>(null);
  const [evidence, setEvidence] = useState<GovernanceEvidence | null>(null);
  const [preview, setPreview] = useState<GovernancePreview | null>(null);
  const [decisions, setDecisions] = useState<GovernanceDecision[]>([]);
  const [reasonCode, setReasonCode] = useState("REVIEWER_DECISION");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const authed = Boolean(userId && tenantId);

  useEffect(() => {
    if (authed) {
      setGovernanceAuth({ userId, tenantId });
      localStorage.setItem("flaha.governance.userId", userId);
      localStorage.setItem("flaha.governance.tenantId", tenantId);
    } else {
      setGovernanceAuth(null);
    }
  }, [authed, userId, tenantId]);

  const loadQueue = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      const page = await api.governanceCandidates({
        reviewState: stateFilter || undefined,
        limit: 50,
      });
      setCandidates(page.items);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load candidates.");
    } finally {
      setLoading(false);
    }
  }, [authed, stateFilter]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [candidate, ev, prev, hist] = await Promise.all([
        api.governanceCandidate(id),
        api.governanceEvidence(id),
        api.governancePreview(id).catch(() => null),
        api.governanceDecisions(id),
      ]);
      setDetail(candidate);
      setEvidence(ev);
      setPreview(prev);
      setDecisions(hist.items);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load candidate.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const availableActions = useMemo(() => {
    if (!detail) return [];
    return ACTIONS.filter(action => action.states.includes(detail.reviewState));
  }, [detail]);

  async function submitAction(action: typeof ACTIONS[number]["key"]) {
    if (!detail) return;
    setLoading(true);
    setMessage("");
    try {
      const result = await api.governanceDecision(detail.id, action, {
        expectedCurrentState: detail.reviewState,
        expectedCandidateVersion: detail.version,
        reasonCode: reasonCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_") || "REVIEWER_DECISION",
        note: note.trim() || undefined,
        idempotencyKey: `web-${detail.id}-${action}-${Date.now()}`,
        correlationId: `web-${Date.now()}`,
        reviewedContentHash: detail.normalizedContentHash,
      });
      setMessage(`${action} applied → ${result.candidate.reviewState}`);
      setNote("");
      await loadQueue();
      await loadDetail(detail.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Decision failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!authed) {
    return (
      <Box sx={{ maxWidth: 640 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Governance review (internal)</Typography>
          <Typography variant="body2" color="text.secondary">
            Authenticate with your tenant membership headers. Actor identity is never taken from decision payloads.
          </Typography>
          <TextField label="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} fullWidth />
          <TextField label="Tenant ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} fullWidth />
          <Alert severity="info">Requires active membership (VIEWER / ANALYST / REVIEWER / GOVERNANCE_ADMIN).</Alert>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h5">Governance review</Typography>
          <Typography variant="body2" color="text.secondary">Internal candidate queue — not public publication.</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>State</InputLabel>
            <Select label="State" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {STATES.map((state) => <MenuItem key={state} value={state}>{state}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={() => void loadQueue()} disabled={loading}>Refresh</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}

      <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 2, alignItems: "stretch" }}>
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Candidate queue</Typography>
            {loading && candidates.length === 0 ? <BrandedState label="Loading candidates…" /> : null}
            <Stack spacing={1}>
              {candidates.map((candidate) => (
                <Box
                  key={candidate.id}
                  onClick={() => setSelectedId(candidate.id)}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: selectedId === candidate.id ? "primary.main" : "divider",
                    cursor: "pointer",
                    bgcolor: selectedId === candidate.id ? "action.selected" : "background.paper",
                  }}
                >
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    <Chip size="small" label={candidate.reviewState} color="primary" variant="outlined" />
                    <Chip size="small" label={candidate.priority} />
                    <Chip size="small" label={candidate.evidenceCompleteness} />
                    <Chip size="small" label={candidate.promotionState} variant="outlined" />
                  </Box>
                  <Typography sx={{ mt: 1, fontWeight: 600 }}>{candidate.documentTitle || candidate.titlePreview || "Untitled"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {candidate.source?.name ?? "No source"} · {candidate.contentType} · {candidate.language} · age {ageLabel(candidate.createdAt)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    warnings: {asStringList(candidate.warningSummary).length} · reviewer: {candidate.assignedReviewerId ?? "unassigned"}
                  </Typography>
                </Box>
              ))}
              {!loading && candidates.length === 0 && <Typography color="text.secondary">No candidates in queue.</Typography>}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1.4, minWidth: 0 }}>
          <CardContent>
            {!detail ? <Typography color="text.secondary">Select a candidate to inspect evidence and decide.</Typography> : (
              <Stack spacing={2}>
                <Typography variant="h6">{detail.documentTitle || detail.titlePreview || detail.id}</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  <Chip label={detail.reviewState} color="primary" />
                  <Chip label={`v${detail.version}`} />
                  <Chip label={detail.priority} />
                  <Chip label={detail.evidenceCompleteness} />
                  <Chip label={detail.promotionState} variant="outlined" />
                </Box>

                <Box>
                  <Typography variant="subtitle2">Normalized preview</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto", bgcolor: "action.hover", p: 1.5, borderRadius: 1 }}>
                    {preview?.plainTextPreview || "Preview unavailable"}
                    {preview?.truncated ? "\n…(truncated)" : ""}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2">Source and lineage</Typography>
                  <Typography variant="body2">Source: {detail.source?.name ?? detail.sourceId ?? "n/a"} · {detail.source?.url ?? ""}</Typography>
                  <Typography variant="body2">Locator: {preview?.publicationDate ? `published ${preview.publicationDate}` : "n/a"}</Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                    acquisition={evidence?.lineage.acquisitionJobId ?? "—"} · extraction={evidence?.lineage.extractionJobId ?? "—"} · normalization={evidence?.lineage.normalizationJobId}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                    hash={detail.normalizedContentHash.slice(0, 16)}… · artifact state={evidence?.artifact?.state ?? "?"}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2">Evidence panel</Typography>
                  <Typography variant="body2">Completeness: {evidence?.evidenceCompleteness}</Typography>
                  <Typography variant="body2">Warnings: {asStringList(evidence?.warnings).join("; ") || "none"}</Typography>
                  <Typography variant="body2">Quality: {asStringList(evidence?.qualityIndicators).join(", ") || "none"}</Typography>
                  <Typography variant="body2">
                    Policy: {evidence?.sourcePolicy
                      ? `${evidence.sourcePolicy.sourceStatus} / ${evidence.sourcePolicy.trustTier} v${evidence.sourcePolicy.version}`
                      : "none configured"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Storage paths and secrets are never exposed.</Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>Decision controls</Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      label="Reason code"
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                      size="small"
                      helperText="Uppercase token, e.g. CONTENT_ACCEPTABLE"
                    />
                    <TextField
                      label="Bounded note (optional)"
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, 2000))}
                      size="small"
                      multiline
                      minRows={2}
                    />
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {availableActions.map((action) => (
                        <Button key={action.key} variant="contained" size="small" disabled={loading} onClick={() => void submitAction(action.key)}>
                          {action.label}
                        </Button>
                      ))}
                      {availableActions.length === 0 && <Typography variant="body2" color="text.secondary">No actions available in state {detail.reviewState}.</Typography>}
                    </Box>
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>Decision history</Typography>
                  <Stack spacing={1}>
                    {decisions.map((decision) => (
                      <Box key={decision.id} sx={{ p: 1, borderLeft: 3, borderColor: "primary.main", bgcolor: "action.hover" }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          #{decision.decisionSequence} {decision.action}: {decision.previousState ?? "∅"} → {decision.newState}
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block" }}>
                          {new Date(decision.createdAt).toLocaleString()} · {decision.actor?.displayName ?? decision.actorId} · {decision.reasonCode}
                        </Typography>
                        {decision.note && <Typography variant="body2">{decision.note}</Typography>}
                      </Box>
                    ))}
                    {decisions.length === 0 && <Typography variant="body2" color="text.secondary">No decisions yet.</Typography>}
                  </Stack>
                </Box>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
