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
 * Last modified: 2026-08-19
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
import { useAuth } from "../auth";
import type {
  GovernanceCandidate,
  GovernanceDecision,
  GovernanceEvidence,
  GovernancePreview,
  GovernanceReviewState,
} from "../types";
import { BrandedState } from "./BrandedState";
import {
  headlineChips,
  locatorLine,
  originLine,
  reviewerLine,
  reuseLabel,
  shortLabel,
} from "../governance/oneShotLabels";

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

function isAdHocDocument(candidate: GovernanceCandidate): boolean {
  return isOneShotEyes(candidate);
}

function storedUuid(key: string): string {
  const value = localStorage.getItem(key) ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : "";
}

export function GovernanceConsole(props: { initialCandidateId?: string | null; hideAuthForm?: boolean } = {}) {
  const { auth } = useAuth();
  const [userId, setUserId] = useState(auth?.userId ?? storedUuid("flaha.governance.userId"));
  const [tenantId, setTenantId] = useState(auth?.tenantId ?? storedUuid("flaha.governance.tenantId"));
  const [stateFilter, setStateFilter] = useState<string>("");
  const [candidates, setCandidates] = useState<GovernanceCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(props.initialCandidateId ?? null);
  const [detail, setDetail] = useState<GovernanceCandidate | null>(null);
  const [evidence, setEvidence] = useState<GovernanceEvidence | null>(null);
  const [preview, setPreview] = useState<GovernancePreview | null>(null);
  const [decisions, setDecisions] = useState<GovernanceDecision[]>([]);
  const [reasonCode, setReasonCode] = useState("REVIEWER_DECISION");
  const [note, setNote] = useState("");
  const [queueLoading, setQueueLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (auth?.userId && auth.tenantId) {
      setUserId(auth.userId);
      setTenantId(auth.tenantId);
    }
  }, [auth]);

  useEffect(() => {
    if (props.initialCandidateId) setSelectedId(props.initialCandidateId);
  }, [props.initialCandidateId]);

  const authed = Boolean((auth?.userId && auth.tenantId) || (userId && tenantId));

  useEffect(() => {
    if (authed) {
      const u = auth?.userId || userId;
      const t = auth?.tenantId || tenantId;
      setGovernanceAuth({ userId: u, tenantId: t });
      localStorage.setItem("flaha.governance.userId", u);
      localStorage.setItem("flaha.governance.tenantId", t);
    } else {
      setGovernanceAuth(null);
    }
  }, [authed, userId, tenantId, auth]);

  const loadQueue = useCallback(async () => {
    if (!authed) return;
    setQueueLoading(true);
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
      setQueueLoading(false);
    }
  }, [authed, stateFilter]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setPreview(null);
    try {
      const candidate = await api.governanceCandidate(id);
      setDetail(candidate);
      setError("");
      const [ev, hist] = await Promise.all([
        api.governanceEvidence(id).catch(() => null),
        api.governanceDecisions(id).catch(() => ({ items: [] as GovernanceDecision[] })),
      ]);
      if (ev) setEvidence(ev);
      setDecisions(hist.items);
      const prev = await api.governancePreview(id).catch(() => null);
      setPreview(prev);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load candidate.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const availableActions = useMemo(() => {
    if (!detail) return [];
    return ACTIONS.filter((action) => {
      if (!action.states.includes(detail.reviewState)) return false;
      // Ad-hoc Submit/PDF has no RSS source — promotion eligibility cannot pass SOURCE_POLICY_MISSING.
      if (action.key === "mark-promotion-eligible" && isAdHocDocument(detail)) return false;
      return true;
    });
  }, [detail]);

  async function submitAction(action: typeof ACTIONS[number]["key"]) {
    if (!detail) return;
    setDetailLoading(true);
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
      setDetailLoading(false);
    }
  }

  if (!authed) {
    if (props.hideAuthForm) {
      return <Alert severity="warning">Sign in to the FlahaINTEL shell to use governance review.</Alert>;
    }
    return (
      <Box sx={{ maxWidth: 640 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Governance review (internal)</Typography>
          <Typography variant="body2" color="text.secondary">
            Authenticate with your tenant membership. Actor identity is never taken from decision payloads.
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
          <Typography variant="body2" color="text.secondary">
            Internal candidate queue — not public publication. Submit website/document finishes at human Approve
            (vaulted). RSS promotion is a separate Sources protocol, not this path.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>State</InputLabel>
            <Select label="State" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {STATES.map((state) => <MenuItem key={state} value={state}>{state}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={() => void loadQueue()} disabled={queueLoading}>Refresh</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}

      <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 2, alignItems: "stretch" }}>
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Candidate queue</Typography>
            {queueLoading && candidates.length === 0 ? <BrandedState label="Loading candidates…" /> : null}
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
                    {headlineChips(candidate).map((label) => (
                      <Chip
                        key={label}
                        size="small"
                        label={label}
                        color={label === candidate.reviewState ? "primary" : "default"}
                        variant={label === candidate.reviewState ? "outlined" : "filled"}
                      />
                    ))}
                  </Box>
                  <Typography sx={{ mt: 1, fontWeight: 600 }}>{shortLabel(candidate)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {originLine(candidate)} · {candidate.contentType} · {candidate.language} · age {ageLabel(candidate.createdAt)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    warnings: {asStringList(candidate.warningSummary).length} · {reviewerLine(candidate)}
                  </Typography>
                </Box>
              ))}
              {!queueLoading && candidates.length === 0 && <Typography color="text.secondary">No candidates in queue.</Typography>}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1.4, minWidth: 0 }}>
          <CardContent>
            {detailLoading && !detail ? <BrandedState label="Opening review…" loading /> : null}
            {!detail && !detailLoading ? <Typography color="text.secondary">Select a candidate to inspect evidence and decide.</Typography> : null}
            {detail ? (
              <Stack spacing={2}>
                <Typography variant="h6">{shortLabel(detail)}</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  <Chip label={detail.reviewState} color="primary" />
                  <Chip label={reuseLabel(detail)} />
                  <Chip label={`v${detail.version}`} />
                  {!isAdHocDocument(detail) && <Chip label={detail.priority} />}
                  {!isAdHocDocument(detail) && <Chip label={detail.evidenceCompleteness} />}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {isAdHocDocument(detail)
                    ? "Submit website/document: human Approve is the product end-state. The item is vaulted in Content. RSS promotion eligibility is a different protocol (registered Sources)."
                    : "Review state is the human decision. Promotion eligibility is a later reuse gate for registered RSS sources with a source policy."}
                </Typography>

                {detail.reviewState === "APPROVED" && isAdHocDocument(detail) && (
                  <Alert severity="success">
                    Finished. This one-shot Eyes item is <strong>APPROVED</strong> and <strong>VAULTED</strong>. You
                    do not need an RSS source, reviewer assignment, or Mark promotion eligible. Open it anytime from
                    Content. Science extracts can later be cited from Knowledge → Literature without converting this
                    into a feed.
                  </Alert>
                )}

                {detail.reviewState === "APPROVED" && !isAdHocDocument(detail) && (
                  <Alert severity="info">
                    Approved. Promotion eligible requires an <strong>active source governance policy</strong> on this
                    RSS source (<code>npm run bootstrap:source-policies</code> for accepted feeds, or create policy in
                    API). Then use <strong>Mark promotion eligible</strong>.
                  </Alert>
                )}

                <Box>
                  <Typography variant="subtitle2">Normalized preview</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto", bgcolor: "action.hover", p: 1.5, borderRadius: 1 }}>
                    {preview?.plainTextPreview || "Preview unavailable"}
                    {preview?.truncated ? "\n…(truncated)" : ""}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2">Source and lineage</Typography>
                  <Typography variant="body2">Source: {originLine(detail, preview)}</Typography>
                  <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                    Locator: {locatorLine(detail, preview)}
                  </Typography>
                  <Typography variant="body2">
                    Published: {preview?.publicationDate || "not in extracted metadata"}
                    {preview?.authors?.length ? ` · authors: ${preview.authors.join(", ")}` : ""}
                    {preview?.publisher ? ` · publisher: ${preview.publisher}` : ""}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                    acquisition={evidence?.lineage.acquisitionJobId ?? "—"} · extraction={evidence?.lineage.extractionJobId ?? "—"} · normalization={evidence?.lineage.normalizationJobId}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                    hash={(detail.normalizedContentHash || "").slice(0, 16)}… · artifact state={evidence?.artifact?.state ?? "?"}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2">Evidence panel</Typography>
                  <Typography variant="body2">Completeness: {evidence?.evidenceCompleteness}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                    {evidence?.evidenceCompleteness === "PARTIAL"
                      ? "PARTIAL is expected for one-shot website submits: no RSS source id. Acquire → extract → normalize still completed. Review here; do not expect RSS promotion policy."
                      : null}
                  </Typography>
                  <Typography variant="body2">Warnings: {asStringList(evidence?.warnings).join("; ") || "none"}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                    “Invalid link skipped” means an empty or unsafe href on the page was dropped (for example Yara’s leave-site dialog). It is not a failed extract.
                  </Typography>
                  <Typography variant="body2">Quality: {asStringList(evidence?.qualityIndicators).join(", ") || "none"}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                    MISSING_DATE / MISSING_AUTHOR mean no article date or byline was selected from metadata. Visible page text is not inferred. Corporate releases often have no author field.
                  </Typography>
                  <Typography variant="body2">
                    Policy: {evidence?.sourcePolicy
                      ? `${evidence.sourcePolicy.sourceStatus} / ${evidence.sourcePolicy.trustTier} v${evidence.sourcePolicy.version}`
                      : isAdHocDocument(detail)
                        ? "not applicable — one-shot website/document, not a registered RSS source"
                        : "RSS source has no governance policy"}
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
                        <Button key={action.key} variant="contained" size="small" disabled={detailLoading} onClick={() => void submitAction(action.key)}>
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
            ) : null}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
