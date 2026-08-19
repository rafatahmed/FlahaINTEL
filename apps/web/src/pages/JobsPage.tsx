/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Jobs Monitor
 * Introduction: Unified job list and detail with polling for pipeline stages.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-01
 */
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { BrandedState } from "../components/BrandedState";

export function JobsPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const page = await api.jobs({ limit: 40 });
      setItems(page.items as Array<Record<string, unknown>>);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function openJob(id: string) {
    try {
      setSelected(await api.job(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load job.");
    }
  }

  if (loading) return <BrandedState label="Loading jobs…" loading />;

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5">Jobs</Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Muscles</strong> — durable pipeline stages (acquire / extract / normalize) for{" "}
            <strong>EYES_DOCUMENT / website</strong> submissions. Market harvest and soil/CALC/FAST promote do{" "}
            <em>not</em> always create jobs here — check Submit recent + Markets / Knowledge for those.
          </Typography>
        </Box>
        <Button onClick={() => void load()}>Refresh</Button>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {items.some((j) => String(j.state) === "READY") && (
        <Alert severity="warning">
          One or more jobs are <strong>READY</strong> but not running. Start workers, e.g.{" "}
          <code>npm run worker:extraction --workspace=@flaha-intel/api</code> and{" "}
          <code>npm run worker:normalization --workspace=@flaha-intel/api</code>. Without workers, Content/Governance
          stay empty even if Submit shows PROMOTED.
        </Alert>
      )}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 2 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            {items.length === 0 && (
              <Typography color="text.secondary">
                No pipeline jobs listed. If you just submitted a general document, refresh — or confirm the API is up
                and you are logged in. READY jobs need workers (see warning above).
              </Typography>
            )}
            {items.map((job) => (
              <Box
                key={String(job.id)}
                sx={{ display: "flex", gap: 1, py: 1, cursor: "pointer", borderBottom: 1, borderColor: "divider" }}
                onClick={() => void openJob(String(job.id))}
              >
                <Chip size="small" label={String(job.state)} />
                <Typography variant="body2" sx={{ flex: 1 }}>{String(job.requestedCapability)}</Typography>
                <Typography variant="caption">{String(job.jobType)}</Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
        <Card sx={{ flex: 1.2 }}>
          <CardContent>
            {!selected ? <Typography color="text.secondary">Select a job.</Typography> : (
              <Stack spacing={1}>
                <Typography variant="h6">{String(selected.requestedCapability)}</Typography>
                <Chip label={String(selected.state)} />
                <Typography variant="body2">Provider: {String(selected.selectedProviderId || "—")}</Typography>
                <Typography variant="body2">Attempts: {String(selected.attemptCount)} / {String(selected.maxAttempts)}</Typography>
                <Typography variant="body2">Media: {String(selected.mediaType)}</Typography>
                <Typography variant="subtitle2">Artifacts</Typography>
                {(selected.artifacts as Array<Record<string, unknown>> | undefined)?.map((a) => (
                  <Typography key={String(a.id)} variant="caption" sx={{ display: "block" }}>
                    {String(a.relationship)} · {String(a.mediaType)} · {String(a.sha256).slice(0, 12)}…
                  </Typography>
                )) || <Typography variant="body2" color="text.secondary">None</Typography>}
                <Typography variant="subtitle2">Transitions</Typography>
                {(selected.transitions as Array<Record<string, unknown>> | undefined)?.map((t) => (
                  <Typography key={String(t.id)} variant="caption" sx={{ display: "block" }}>
                    {String(t.fromState)} → {String(t.toState)} · {String(t.reasonCode)}
                  </Typography>
                ))}
                {["READY", "PENDING", "LEASED", "RUNNING", "RETRY_WAIT"].includes(String(selected.state)) && (
                  <Button
                    color="warning"
                    variant="outlined"
                    onClick={() => void api.cancelJob(String(selected.id), "UI_CANCEL").then(load)}
                  >
                    Cancel job
                  </Button>
                )}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
