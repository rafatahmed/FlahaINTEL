/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Content Browser
 * Introduction: Lists normalized content / governance candidates with bounded preview.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { Alert, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { GovernanceCandidate } from "../types";
import { BrandedState } from "../components/BrandedState";

export function ContentPage(props: { onOpenGovernance?: (id: string) => void }) {
  const [items, setItems] = useState<GovernanceCandidate[]>([]);
  const [selected, setSelected] = useState<GovernanceCandidate | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const page = await api.contentList({ limit: 40 });
        setItems(page.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load content.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openItem(id: string) {
    try {
      const item = await api.contentItem(id);
      setSelected(item);
      const p = await api.governancePreview(id).catch(() => null);
      setPreview(p?.plainTextPreview || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open content.");
    }
  }

  if (loading) return <BrandedState label="Loading content…" loading />;

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Content</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            {items.length === 0 && <Typography color="text.secondary">No normalized content candidates.</Typography>}
            {items.map((item) => (
              <Stack
                key={item.id}
                spacing={0.5}
                sx={{ py: 1, borderBottom: 1, borderColor: "divider", cursor: "pointer" }}
                onClick={() => void openItem(item.id)}
              >
                <Typography sx={{ fontWeight: 600 }}>{item.documentTitle || item.titlePreview || item.id}</Typography>
                <Stack direction="row" spacing={1}>
                  <Chip size="small" label={item.reviewState} />
                  <Chip size="small" label={item.promotionState} variant="outlined" />
                  <Chip size="small" label={item.language} />
                </Stack>
              </Stack>
            ))}
          </CardContent>
        </Card>
        <Card sx={{ flex: 1.2 }}>
          <CardContent>
            {!selected ? <Typography color="text.secondary">Select content.</Typography> : (
              <Stack spacing={1}>
                <Typography variant="h6">{selected.documentTitle || selected.titlePreview}</Typography>
                <Typography variant="body2">{selected.contentType} · {selected.normalizationProfile} v{selected.normalizationVersion}</Typography>
                <Typography variant="body2">Hash {selected.normalizedContentHash.slice(0, 16)}…</Typography>
                <Typography variant="body2">Governance: {selected.reviewState} · Eligibility: {selected.promotionState}</Typography>
                <Typography variant="subtitle2">Preview</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto", bgcolor: "action.hover", p: 1.5 }}>
                  {preview || "No preview"}
                </Typography>
                {props.onOpenGovernance && (
                  <Typography
                    variant="body2"
                    color="primary"
                    sx={{ cursor: "pointer" }}
                    onClick={() => props.onOpenGovernance?.(selected.id)}
                  >
                    Open in Governance →
                  </Typography>
                )}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );
}
