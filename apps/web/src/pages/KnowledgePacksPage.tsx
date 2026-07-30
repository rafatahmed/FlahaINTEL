/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Packs Page
 * Introduction: Browse soil/irrigation knowledge pack samples (Gate 4S).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import { BrandedState } from "../components/BrandedState";

type PackItem = {
  id: string;
  sequence: number;
  title: string;
  extractKind: string;
  bodyText?: string | null;
  structured?: Record<string, unknown>;
  sourceUrl?: string | null;
};

type Pack = {
  id: string;
  code: string;
  theme: string;
  title: string;
  summary?: string | null;
  cropTags?: string[];
  regionTags?: string[];
  climateTags?: string[];
  reviewState?: string;
  items?: PackItem[];
};

export function KnowledgePacksPage() {
  const [theme, setTheme] = useState<string>("");
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const res = await api.knowledgePacks(theme || undefined);
        const list = (res.packs || []) as Pack[];
        setPacks(list);
        setSelectedId((prev) => (list.some((p) => p.id === prev) ? prev : list[0]?.id || ""));
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load knowledge packs.");
      } finally {
        setLoading(false);
      }
    })();
  }, [theme]);

  const selected = packs.find((p) => p.id === selectedId);

  if (loading) return <BrandedState label="Loading knowledge packs…" loading />;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Knowledge packs</Typography>
        <Typography variant="body2" color="text.secondary">
          Soil and irrigation science packs (4S). Region/climate are tags only — packs never auto-change FlahaSOIL algorithms.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Theme</InputLabel>
          <Select label="Theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="SOIL">Soil</MenuItem>
            <MenuItem value="IRRIGATION">Irrigation</MenuItem>
            <MenuItem value="NUTRITION">Nutrition</MenuItem>
            <MenuItem value="OTHER">Other</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 320, flex: 1 }}>
          <InputLabel>Pack</InputLabel>
          <Select
            label="Pack"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={!packs.length}
          >
            {packs.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.theme} · {p.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {!selected ? (
        <Alert severity="info">
          No packs yet. Seed samples with <code>npm run knowledge:seed-samples</code> in apps/api.
        </Alert>
      ) : (
        <>
          <Card>
            <CardContent>
              <Typography variant="h6">{selected.title}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                {selected.code} · {selected.reviewState || "DRAFT"}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                {selected.summary || "—"}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                <Chip size="small" color="primary" label={selected.theme} />
                {(selected.regionTags || []).map((t) => (
                  <Chip key={`r-${t}`} size="small" variant="outlined" label={`region:${t}`} />
                ))}
                {(selected.cropTags || []).map((t) => (
                  <Chip key={`c-${t}`} size="small" variant="outlined" label={`crop:${t}`} />
                ))}
                {(selected.climateTags || []).map((t) => (
                  <Chip key={`cl-${t}`} size="small" variant="outlined" label={`climate:${t}`} />
                ))}
              </Box>
            </CardContent>
          </Card>

          <Stack spacing={1.5}>
            {(selected.items || []).map((item) => (
              <Card key={item.id}>
                <CardContent>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
                    <Chip size="small" label={item.extractKind} />
                    <Typography variant="subtitle1">{item.title}</Typography>
                  </Box>
                  {item.bodyText && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {item.bodyText}
                    </Typography>
                  )}
                  {item.structured && Object.keys(item.structured).length > 0 && (
                    <Box
                      component="pre"
                      sx={{
                        m: 0,
                        p: 1.5,
                        bgcolor: "action.hover",
                        borderRadius: 1,
                        fontSize: 12,
                        overflow: "auto",
                      }}
                    >
                      {JSON.stringify(item.structured, null, 2)}
                    </Box>
                  )}
                  {item.sourceUrl && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Source: {item.sourceUrl}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}
