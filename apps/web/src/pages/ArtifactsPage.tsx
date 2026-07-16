/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Artifact Browser
 * Introduction: Safe artifact metadata and escaped text previews without path exposure.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { Alert, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import { BrandedState } from "../components/BrandedState";

export function ArtifactsPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [preview, setPreview] = useState("");
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const page = await api.artifacts({ limit: 40 });
        setItems(page.items as Array<Record<string, unknown>>);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load artifacts.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openArtifact(id: string) {
    try {
      setMeta(await api.artifact(id));
      const p = await api.artifactPreview(id);
      setPreview(p.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
    }
  }

  if (loading) return <BrandedState label="Loading artifacts…" loading />;

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Artifacts</Typography>
      <Typography variant="body2" color="text.secondary">
        Previews are escaped text only. Downloads are disabled. Paths and secrets are redacted.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            {items.map((a) => (
              <Stack
                key={String(a.id)}
                sx={{ py: 1, borderBottom: 1, borderColor: "divider", cursor: "pointer" }}
                onClick={() => void openArtifact(String(a.artifactId))}
              >
                <Typography variant="body2">{String(a.relationship)} · {String(a.mediaType)}</Typography>
                <Typography variant="caption">{String(a.sha256).slice(0, 16)}… · {String(a.byteSize)} bytes</Typography>
              </Stack>
            ))}
            {items.length === 0 && <Typography color="text.secondary">No artifact links.</Typography>}
          </CardContent>
        </Card>
        <Card sx={{ flex: 1.2 }}>
          <CardContent>
            {!meta ? <Typography color="text.secondary">Select an artifact.</Typography> : (
              <Stack spacing={1}>
                <Typography variant="h6">Artifact detail</Typography>
                <Typography variant="body2">State: {String((meta.metadata as Record<string, unknown> | undefined)?.state)}</Typography>
                <Typography variant="body2">Prefix: {String((meta.metadata as Record<string, unknown> | undefined)?.finalKeyPrefix || "—")}</Typography>
                <Typography variant="body2">Download eligible: {String(meta.downloadEligible)}</Typography>
                <Typography variant="subtitle2">Escaped preview</Typography>
                <Typography
                  component="pre"
                  variant="body2"
                  sx={{ whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto", bgcolor: "action.hover", p: 1.5, m: 0 }}
                >
                  {preview || "—"}
                </Typography>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );
}
