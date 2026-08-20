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
 * Last modified: 2026-08-19
 */
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { GovernanceCandidate } from "../types";
import { BrandedState } from "../components/BrandedState";
import { headlineChips, isOneShotEyes, originLine, reuseLabel, shortLabel } from "../governance/oneShotLabels";

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
    const fromList = items.find((item) => item.id === id);
    if (fromList) {
      setSelected(fromList);
      setPreview("");
    }
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
      <Box>
        <Typography variant="h5">Content</Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Structure</strong> — vault of normalized Eyes items (Submit website/document and RSS articles).
          One-shot Submit is finished at human <strong>Approve</strong> (shown as VAULTED). RSS promotion eligibility
          is only for registered Sources. Not market prices or Knowledge packs.
        </Typography>
      </Box>
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
                <Typography sx={{ fontWeight: 600 }}>{shortLabel(item)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {originLine(item)}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {headlineChips(item).map((label) => (
                    <Chip key={label} size="small" label={label} />
                  ))}
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
                <Typography variant="h6">{shortLabel(selected)}</Typography>
                <Typography variant="body2">{selected.contentType} · {selected.normalizationProfile} v{selected.normalizationVersion}</Typography>
                <Typography variant="body2">Hash {(selected.normalizedContentHash || "").slice(0, 16)}…</Typography>
                <Typography variant="body2">{originLine(selected)}</Typography>
                <Typography variant="body2">
                  {isOneShotEyes(selected)
                    ? `Review: ${selected.reviewState} · Product: ${reuseLabel(selected)} (RSS eligibility does not apply)`
                    : `Governance: ${selected.reviewState} · RSS eligibility: ${selected.promotionState}`}
                </Typography>
                <Typography variant="subtitle2">Preview</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto", bgcolor: "action.hover", p: 1.5 }}>
                  {(preview || "No preview").slice(0, 4000)}
                </Typography>
                {props.onOpenGovernance && (
                  <Button variant="contained" onClick={() => props.onOpenGovernance?.(selected.id)}>
                    Open in Governance
                  </Button>
                )}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );
}
