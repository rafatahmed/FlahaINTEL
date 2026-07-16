/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Operational Dashboard
 * Introduction: Real backend dashboard for submissions, jobs, governance, and readiness.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import { BrandedState } from "../components/BrandedState";

export function DashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setData(await api.dashboard());
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Dashboard failed.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <BrandedState label="Loading dashboard…" loading />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <BrandedState label="No dashboard data." />;

  const counts = (data.counts || {}) as { pendingGovernance?: number; promotionEligible?: number; jobStates?: Record<string, number> };
  const submissions = (data.recentSubmissions || []) as Array<Record<string, unknown>>;
  const jobs = (data.recentJobs || []) as Array<Record<string, unknown>>;
  const failures = (data.recentFailures || []) as Array<Record<string, unknown>>;
  const readiness = data.readiness as { overall?: string } | undefined;
  const sources = (data.sourceHealth || []) as Array<Record<string, unknown>>;

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Dashboard</Typography>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
        {[
          { label: "Pending governance", value: counts.pendingGovernance ?? 0 },
          { label: "Promotion eligible", value: counts.promotionEligible ?? 0 },
          { label: "System", value: readiness?.overall ?? "—" },
          { label: "Jobs FAILED", value: counts.jobStates?.FAILED ?? 0 },
        ].map((card) => (
          <Card key={card.label}><CardContent>
            <Typography variant="overline" color="text.secondary">{card.label}</Typography>
            <Typography variant="h5">{String(card.value)}</Typography>
          </CardContent></Card>
        ))}
      </Box>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Recent submissions</Typography>
        {submissions.length === 0 ? <Typography color="text.secondary">No submissions yet.</Typography> : submissions.map((s) => (
          <Box key={String(s.id)} sx={{ display: "flex", gap: 1, py: 0.5, alignItems: "center" }}>
            <Chip size="small" label={String(s.overallStatus)} />
            <Typography variant="body2">{String(s.titlePreview || s.id)}</Typography>
            <Typography variant="caption" color="text.secondary">{String(s.currentStage)}</Typography>
          </Box>
        ))}
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Recent jobs</Typography>
        {jobs.slice(0, 8).map((j) => (
          <Box key={String(j.id)} sx={{ display: "flex", gap: 1, py: 0.5, alignItems: "center" }}>
            <Chip size="small" label={String(j.state)} color={j.state === "SUCCEEDED" ? "success" : j.state === "FAILED" ? "error" : "default"} />
            <Typography variant="body2">{String(j.requestedCapability)}</Typography>
            <Typography variant="caption" color="text.secondary">{String(j.jobType)}</Typography>
          </Box>
        ))}
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Source health</Typography>
        {sources.map((s) => (
          <Typography key={String(s.id)} variant="body2">
            {String(s.name)} · {s.enabled ? "enabled" : "disabled"} · {s.lastError ? `error: ${String(s.lastError).slice(0, 80)}` : "ok"}
          </Typography>
        ))}
      </CardContent></Card>

      {failures.length > 0 && (
        <Alert severity="warning">
          Recent failures: {failures.map((f) => String(f.requestedCapability)).join(", ")}
        </Alert>
      )}
    </Stack>
  );
}
