import { Add, Edit, OpenInNew, Refresh, Save } from "@mui/icons-material";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Link,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { BrandedState } from "./BrandedState";
import type { CollectionRun, RssSource, SchedulerStatus } from "../types";

type CollectResult = {
  status?: string;
  itemsFound?: number;
  itemsAdded?: number;
  itemsSkipped?: number;
  error?: string;
};

export function SourceManager(props: { onOpenArticles?: () => void } = {}) {
  const [sources, setSources] = useState<RssSource[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [lastCollectNote, setLastCollectNote] = useState("");
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

  function formatCollectNote(result: unknown): string {
    if (!result || typeof result !== "object") return "";
    const r = result as CollectResult & { results?: CollectResult[] };
    if (Array.isArray(r.results)) {
      const found = r.results.reduce((n, item) => n + (item.itemsFound ?? 0), 0);
      const added = r.results.reduce((n, item) => n + (item.itemsAdded ?? 0), 0);
      const skipped = r.results.reduce((n, item) => n + (item.itemsSkipped ?? 0), 0);
      return `Collect all finished: ${found} found, ${added} new, ${skipped} skipped (duplicates or malformed). Open Articles to inspect.`;
    }
    if (r.status === "SUCCESS" || r.itemsFound != null) {
      return `Collection finished: ${r.itemsFound ?? 0} found, ${r.itemsAdded ?? 0} new, ${r.itemsSkipped ?? 0} skipped. Open Articles to inspect.`;
    }
    if (r.status === "FAILURE" && r.error) {
      return `Collection failed: ${r.error}`;
    }
    return "";
  }

  async function act(key: string, action: () => Promise<unknown>) {
    setBusy((current) => new Set(current).add(key));
    try {
      const result = await action();
      setError("");
      const note = formatCollectNote(result);
      if (note) setLastCollectNote(note);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request failed.");
    } finally {
      setBusy((current) => { const next = new Set(current); next.delete(key); return next; });
    }
  }

  function latestRun(source: RssSource): CollectionRun | undefined {
    return source.collectionRuns?.[0];
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
    <Alert severity="info">
      Collection stores articles in FlahaINTEL. Inspect them under <strong>Articles</strong>
      {props.onOpenArticles ? " (sidebar Eyes group)" : ""}. The <strong>Content</strong> page is only for
      pipeline/governance candidates, not RSS items.
    </Alert>
    <Card variant="outlined"><CardContent>
      <Stack component="form" onSubmit={submit} spacing={2}>
        <TextField required label="Source name" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField required type="url" label="RSS feed URL" value={url} onChange={(event) => setUrl(event.target.value)} />
        <Button type="submit" variant="contained" startIcon={busy.has("add") ? <CircularProgress size={18} /> : <Add />} disabled={busy.has("add")}>Add source</Button>
      </Stack>
    </CardContent></Card>
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
      <Button variant="outlined" startIcon={busy.has("all") ? <CircularProgress size={18} /> : <Refresh />} disabled={busy.has("all") || sources.length === 0} onClick={() => void act("all", api.collectAll)}>Collect all enabled sources</Button>
      <Button variant="text" onClick={() => void load()} disabled={loading}>Refresh status</Button>
      {props.onOpenArticles && (
        <Button variant="contained" color="secondary" startIcon={<OpenInNew />} onClick={props.onOpenArticles}>
          Open Articles
        </Button>
      )}
    </Stack>
    {lastCollectNote && (
      <Alert
        severity={lastCollectNote.startsWith("Collection failed") ? "error" : "success"}
        action={props.onOpenArticles ? <Button color="inherit" onClick={props.onOpenArticles}>Articles</Button> : undefined}
        onClose={() => setLastCollectNote("")}
      >
        {lastCollectNote}
      </Alert>
    )}
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
    {loading && sources.length === 0 && <BrandedState loading label="Loading RSS sources" />}
    {!loading && !error && sources.length === 0 && <BrandedState label="No RSS sources have been added yet." />}
    {sources.map((source) => {
      const sourceBusy = busy.has(source.id) || source.isCollecting;
      const editing = editingId === source.id;
      const run = latestRun(source);
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
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
              {source.publisher && <Chip size="small" label={`Publisher: ${source.publisher}`} />}
              {source.category && <Chip size="small" label={`Category: ${source.category}`} />}
              {source.region && <Chip size="small" label={`Region: ${source.region}`} />}
              {source.language && <Chip size="small" label={`Language: ${source.language}`} />}
              {source.authorityType && <Chip size="small" label={source.authorityType.replaceAll("_", " ")} />}
              {source.verificationStatus && <Chip size="small" color={source.verificationStatus === "ACCEPTED" ? "success" : "warning"} label={source.verificationStatus} />}
              <Chip size="small" label={source.ownershipVerified ? "Ownership verified" : "Ownership unverified"} />
            </Stack>
            {(source.homepageUrl || source.evidenceUrl) && <Stack direction="row" spacing={2}>
              {source.homepageUrl && <Link href={source.homepageUrl} target="_blank" rel="noopener noreferrer">Publisher homepage</Link>}
              {source.evidenceUrl && <Link href={source.evidenceUrl} target="_blank" rel="noopener noreferrer">Ownership evidence</Link>}
            </Stack>}
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
          {source.lastCollectedAt && !source.lastError && (
            <Alert severity="success">
              Last collection succeeded at {new Date(source.lastCollectedAt).toLocaleString()}
              {run
                ? ` — found ${run.itemsFound}, added ${run.itemsAdded}${run.itemsFound > run.itemsAdded ? ` (${run.itemsFound - run.itemsAdded} skipped)` : ""}.`
                : "."}
              {" "}Browse under Articles.
            </Alert>
          )}
          {run && (
            <Typography variant="caption" color="text.secondary">
              Latest run {run.status} · {new Date(run.startedAt).toLocaleString()} · found {run.itemsFound} · added {run.itemsAdded}
            </Typography>
          )}
        </Stack>
      </CardContent></Card>;
    })}
  </Stack>;
}

