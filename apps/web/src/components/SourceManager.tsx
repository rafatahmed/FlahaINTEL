import { Add, Refresh } from "@mui/icons-material";
import { Alert, Button, Card, CardContent, CircularProgress, FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { RssSource } from "../types";

export function SourceManager() {
  const [sources, setSources] = useState<RssSource[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => api.sources().then(setSources).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    try { await action(); setError(""); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed"); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void act(async () => { await api.addSource(name, url); setName(""); setUrl(""); });
  }

  return <Stack spacing={2}>
    <Typography variant="h5">RSS sources</Typography>
    <Card variant="outlined"><CardContent>
      <Stack component="form" onSubmit={submit} spacing={2}>
        <TextField required label="Source name" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField required type="url" label="RSS feed URL" value={url} onChange={(event) => setUrl(event.target.value)} />
        <Button type="submit" variant="contained" startIcon={<Add />} disabled={busy}>Add source</Button>
      </Stack>
    </CardContent></Card>
    <Button variant="outlined" startIcon={busy ? <CircularProgress size={18} /> : <Refresh />} disabled={busy || sources.length === 0} onClick={() => void act(api.collectAll)}>Collect all enabled sources</Button>
    {error && <Alert severity="error">{error}</Alert>}
    {sources.map((source) => <Card key={source.id} variant="outlined"><CardContent>
      <Stack spacing={1}>
        <Typography variant="h6">{source.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{source.url}</Typography>
        <FormControlLabel control={<Switch checked={source.enabled} disabled={busy} onChange={(_, enabled) => void act(() => api.setSourceEnabled(source.id, enabled))} />} label="Enabled" />
        <Button size="small" startIcon={<Refresh />} disabled={busy} onClick={() => void act(() => api.collectSource(source.id))}>Collect now</Button>
        {!source.lastCollectedAt && <Alert severity="info">Not collected yet</Alert>}
        {source.lastCollectedAt && source.lastError && <Alert severity="error">Last attempt failed: {source.lastError}</Alert>}
        {source.lastCollectedAt && !source.lastError && <Alert severity="success">Last collection succeeded at {new Date(source.lastCollectedAt).toLocaleString()}</Alert>}
      </Stack>
    </CardContent></Card>)}
  </Stack>;
}

