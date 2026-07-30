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
 * Last modified: 2026-07-30
 */
import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { BrandedState } from "../components/BrandedState";

type ArtifactLink = {
  id: string;
  artifactId: string;
  relationship?: string;
  mediaType?: string;
  sha256?: string;
  byteSize?: string;
  createdAt?: string;
};

export function ArtifactsPage() {
  const [items, setItems] = useState<ArtifactLink[]>([]);
  const [preview, setPreview] = useState("");
  const [previewNote, setPreviewNote] = useState("");
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const page = await api.artifacts({ limit: 40 });
        setItems((page.items || []) as ArtifactLink[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load artifacts.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openArtifact(artifactId: string) {
    setSelectedId(artifactId);
    setError("");
    setPreview("");
    setPreviewNote("");
    try {
      const detail = await api.artifact(artifactId);
      setMeta(detail as Record<string, unknown>);
      const state = String(
        ((detail as { metadata?: { state?: string } }).metadata?.state) || "",
      ).toUpperCase();

      if (state === "UNAVAILABLE" || state === "ABANDONED" || state === "QUARANTINED") {
        setPreviewNote(
          `Blob state is ${state || "unknown"}. The database still has a job link, but the file is not readable in the current artifact store (common for cleaned test runs or disk cleanup). This is not a security block on your account.`,
        );
        return;
      }

      try {
        const p = await api.artifactPreview(artifactId);
        setPreview(p.preview || "");
        if (!p.preview) {
          setPreviewNote("Preview body was empty (zero-length or non-text content).");
        } else if (p.truncated) {
          setPreviewNote("Preview truncated for safety (escaped text only).");
        }
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Preview failed.";
        setPreviewNote(
          `${msg} — Usually the link exists in PostgreSQL but the file is missing under the API artifact root (apps/api/.artifacts by default). New successful jobs will create fresh, previewable blobs.`,
        );
      }
    } catch (e) {
      setMeta(null);
      setError(e instanceof Error ? e.message : "Failed to open artifact.");
    }
  }

  if (loading) return <BrandedState label="Loading artifacts…" loading />;

  const metadata = (meta?.metadata || {}) as Record<string, unknown>;
  const link = (meta?.link || {}) as Record<string, unknown>;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Artifacts</Typography>
        <Typography variant="body2" color="text.secondary">
          Safe browser for ingestion evidence. Previews are <strong>escaped text only</strong> (HTML never executes).
          Downloads stay <strong>disabled</strong>. Paths and secrets are redacted. That policy is intentional — not a
          bug.
        </Typography>
      </Box>

      <Alert severity="info">
        If you see <strong>Artifact preview is unavailable</strong>, the job link is still listed but the file blob is
        gone from disk (or never sealed). Many rows here come from acceptance tests. Markets/RSS keep working without
        these previews.
      </Alert>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 2 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Linked artifacts ({items.length})
            </Typography>
            {items.map((a) => (
              <Box
                key={a.id}
                sx={{
                  py: 1,
                  borderBottom: 1,
                  borderColor: "divider",
                  cursor: "pointer",
                  bgcolor: selectedId === a.artifactId ? "action.selected" : undefined,
                }}
                onClick={() => void openArtifact(a.artifactId)}
              >
                <Typography variant="body2">
                  {a.relationship || "—"} · {a.mediaType || "—"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(a.sha256 || "").slice(0, 16)}… · {a.byteSize} bytes
                </Typography>
              </Box>
            ))}
            {items.length === 0 && (
              <Typography color="text.secondary">No artifact links yet. Run a submission or pipeline job first.</Typography>
            )}
          </CardContent>
        </Card>

        <Card sx={{ flex: 1.2 }}>
          <CardContent>
            {!meta ? (
              <Typography color="text.secondary">Select an artifact on the left.</Typography>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="h6">Artifact detail</Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Chip
                    size="small"
                    label={String(metadata.state || "UNKNOWN")}
                    color={
                      String(metadata.state).toUpperCase() === "SEALED" ||
                      String(metadata.state).toUpperCase() === "PROMOTED"
                        ? "success"
                        : String(metadata.state).toUpperCase() === "UNAVAILABLE"
                          ? "warning"
                          : "default"
                    }
                  />
                  <Chip size="small" variant="outlined" label={`Download: ${String(meta.downloadEligible)}`} />
                </Box>
                <Typography variant="body2">
                  Relationship: {String(link.relationship || "—")} · {String(link.mediaType || "—")}
                </Typography>
                <Typography variant="body2">
                  Size: {String(link.byteSize || metadata.byteLength || "—")} bytes
                </Typography>
                <Typography variant="body2">
                  Store prefix: {String(metadata.finalKeyPrefix || "—")} (full paths never shown)
                </Typography>
                <Typography variant="subtitle2">Escaped preview</Typography>
                {previewNote && <Alert severity="warning">{previewNote}</Alert>}
                <Typography
                  component="pre"
                  variant="body2"
                  sx={{
                    whiteSpace: "pre-wrap",
                    maxHeight: 320,
                    overflow: "auto",
                    bgcolor: "action.hover",
                    p: 1.5,
                    m: 0,
                    borderRadius: 1,
                  }}
                >
                  {preview || "(no preview body)"}
                </Typography>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
