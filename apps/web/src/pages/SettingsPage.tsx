/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Settings and System Health
 * Introduction: Internal operational settings and readiness components.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { BrandedState } from "../components/BrandedState";

export function SettingsPage() {
  const { auth } = useAuth();
  const [readiness, setReadiness] = useState<{ overall: string; components: Array<{ component: string; state: string; detail: string }> } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setReadiness(await api.systemReadiness());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Readiness failed.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <BrandedState label="Loading settings…" loading />;

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Settings</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Card>
        <CardContent>
          <Typography variant="h6">Session</Typography>
          <Typography variant="body2">User: {auth?.displayName || auth?.userId}</Typography>
          <Typography variant="body2">Tenant: {auth?.tenantId}</Typography>
          <Typography variant="body2">Role: {auth?.role}</Typography>
          <Typography variant="caption" color="text.secondary">
            Identity modes: internal signed session cookie/token and development headers. Actor IDs are never taken from request bodies.
          </Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>System readiness · {readiness?.overall}</Typography>
          {readiness?.components.map((c) => (
            <Box key={c.component} sx={{ display: "flex", gap: 1, py: 0.5, alignItems: "center" }}>
              <Chip size="small" label={c.state} color={c.state === "READY" ? "success" : c.state === "UNAVAILABLE" ? "error" : "warning"} />
              <Typography variant="body2" sx={{ minWidth: 140 }}>{c.component}</Typography>
              <Typography variant="caption" color="text.secondary">{c.detail}</Typography>
            </Box>
          ))}
        </CardContent>
      </Card>
      <Alert severity="info">
        Supported media: HTML, PDF, DOCX, RTF, TXT. PPTX and OCR are out of scope for Phase 3L.
      </Alert>
    </Stack>
  );
}
