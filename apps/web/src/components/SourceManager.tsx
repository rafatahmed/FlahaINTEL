import { Add, Edit, Refresh, Save } from "@mui/icons-material";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { RssSource, SchedulerStatus } from "../types";

export function SourceManager() {
  const [sources, setSources] = useState<RssSource[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSources, nextScheduler] = await Promise.all([api.sources(), api.scheduler()]);
      setSources(nextSources);
      setScheduler(nextScheduler);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(key: string, action: () => Promise<unknown>) {
    setBusy((current) => new Set(current).add(key));
    try {
      await action();
      setError("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request failed.");
    } finally {
      setBusy((current) => { const next = new Set(current); next.delete(key); return next; });
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void act("add", async () => { await api.addSource(name, url); setName(""); setUrl(""); });
  }

  function beginEdit(source: RssSource) {
    setEditingId(source.id);
    setEditName(source.name);
    setEditUrl(source.url);
  }

  function saveEdit(source: RssSource) {
    void act(source.id, async () => {
      await api.updateSource(source.id, { name: editName, url: editUrl });
      setEditingId(null);
    });
  }

  return <Stack spacing={2}>
    <Typography variant="h5">RSS sources</Typography>
    {scheduler && <Alert severity={scheduler.enabled ? "info" : "warning"}>
      Scheduler {scheduler.enabled ? `enabled every ${scheduler.intervalMinutes} minutes` : "disabled by configuration"}
      {scheduler.running ? " — collection running" : ""}
    </Alert>}
    <Card variant="outlined"><CardContent>
      <Stack component="form" onSubmit={submit} spacing={2}>
        <TextField required label="Source name" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField required type="url" label="RSS feed URL" value={url} onChange={(event) => setUrl(event.target.value)} />
        <Button type="submit" variant="contained" startIcon={busy.has("add") ? <CircularProgress size={18} /> : <Add />} disabled={busy.has("add")}>Add source</Button>
      </Stack>
    </CardContent></Card>
    <Stack direction="row" spacing={1}>
      <Button variant="outlined" startIcon={busy.has("all") ? <CircularProgress size={18} /> : <Refresh />} disabled={busy.has("all") || sources.length === 0} onClick={() => void act("all", api.collectAll)}>Collect all enabled sources</Button>
      <Button variant="text" onClick={() => void load()} disabled={loading}>Refresh status</Button>
    </Stack>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
    {loading && sources.length === 0 && <Stack sx={{ alignItems: "center", py: 3 }}><CircularProgress aria-label="Loading RSS sources" /></Stack>}
    {!loading && !error && sources.length === 0 && <Alert severity="info">No RSS sources have been added yet.</Alert>}
    {sources.map((source) => {
      const sourceBusy = busy.has(source.id) || source.isCollecting;
      const editing = editingId === source.id;
      return <Card key={source.id} variant="outlined"><CardContent>
        <Stack spacing={1.5}>
          {editing ? <>
            <TextField required label="Source name" value={editName} onChange={(event) => setEditName(event.target.value)} />
            <TextField required type="url" label="RSS feed URL" value={editUrl} onChange={(event) => setEditUrl(event.target.value)} />
            <Stack direction="row" spacing={1}>
              <Button startIcon={<Save />} disabled={sourceBusy} onClick={() => saveEdit(source)}>Save</Button>
              <Button disabled={sourceBusy} onClick={() => setEditingId(null)}>Cancel</Button>
            </Stack>
          </> : <>
            <Typography variant="h6">{source.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{source.url}</Typography>
            <Button size="small" startIcon={<Edit />} disabled={sourceBusy || editingId !== null} onClick={() => beginEdit(source)}>Edit source</Button>
          </>}
          <FormControlLabel
            control={<Switch checked={source.enabled} disabled={sourceBusy} onChange={(_, enabled) => void act(source.id, () => api.setSourceEnabled(source.id, enabled))} />}
            label="Enabled"
          />
          <Button size="small" startIcon={sourceBusy ? <CircularProgress size={18} /> : <Refresh />} disabled={sourceBusy} onClick={() => void act(source.id, () => api.collectSource(source.id))}>
            {sourceBusy ? "Collecting…" : "Collect now"}
          </Button>
          {!source.lastCollectedAt && <Alert severity="info">Not collected yet</Alert>}
          {source.lastCollectedAt && source.lastError && <Alert severity="error">Last attempt failed: {source.lastError}</Alert>}
          {source.lastCollectedAt && !source.lastError && <Alert severity="success">Last collection succeeded at {new Date(source.lastCollectedAt).toLocaleString()}</Alert>}
        </Stack>
      </CardContent></Card>;
    })}
  </Stack>;
}

