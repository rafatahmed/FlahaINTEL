import { Add, Delete, Edit } from "@mui/icons-material";
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel,
  InputLabel, Link, MenuItem, Pagination, Select, Stack, Switch, TextField, Typography,
} from "@mui/material";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api, type EventInput } from "../api";
import type { Article, ClassificationTerm, ClassificationType, IntelligenceEvent } from "../types";
import { CLASSIFICATION_TYPES } from "../types";

const emptyForm: EventInput = { primaryEventTypeTermId: "", title: "", summary: "", startsAt: "", endsAt: "", observedAt: "", locationName: "" };
const inputDate = (value: string | null | undefined) => value ? value.slice(0, 16) : "";
const apiDate = (value: string | null | undefined) => value ? new Date(value).toISOString() : null;

export function EventWorkspace() {
  const [items, setItems] = useState<IntelligenceEvent[]>([]);
  const [terms, setTerms] = useState<ClassificationTerm[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [q, setQ] = useState("");
  const [primaryTypeId, setPrimaryTypeId] = useState("");
  const [termId, setTermId] = useState("");
  const [classificationType, setClassificationType] = useState<ClassificationType | "">("");
  const [geographicTermId, setGeographicTermId] = useState("");
  const [active, setActive] = useState<"true" | "false">("true");
  const [startsAtFrom, setStartsAtFrom] = useState("");
  const [startsAtTo, setStartsAtTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<IntelligenceEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IntelligenceEvent | null>(null);
  const [form, setForm] = useState<EventInput>(emptyForm);
  const [classificationToAdd, setClassificationToAdd] = useState("");
  const [evidenceToAdd, setEvidenceToAdd] = useState("");

  const primaryTypes = terms.filter((term) => term.type === "GENERAL_EVENT_TYPE" && term.active && term.assignable);
  const geographicTerms = terms.filter((term) => term.type === "GEOGRAPHIC_SCOPE" && term.active && term.assignable);
  const assignableTerms = terms.filter((term) => term.active && term.assignable);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.events({
        q, primaryEventTypeTermId: primaryTypeId || undefined, termId: termId || undefined,
        classificationType: classificationType || undefined, geographicTermId: geographicTermId || undefined,
        active: active === "true", startsAtFrom: startsAtFrom ? new Date(`${startsAtFrom}T00:00:00Z`).toISOString() : undefined,
        startsAtTo: startsAtTo ? new Date(`${startsAtTo}T23:59:59Z`).toISOString() : undefined, page, limit: 10,
      });
      setItems(result.items); setTotalPages(result.totalPages); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setLoading(false); }
  }, [active, classificationType, geographicTermId, page, primaryTypeId, q, startsAtFrom, startsAtTo, termId]);

  useEffect(() => {
    Promise.all([api.taxonomy(), api.articles({ page: 1, limit: 100 })]).then(([taxonomy, nextArticles]) => {
      setTerms(taxonomy.items); setArticles(nextArticles.items);
    }).catch((reason: Error) => setError(reason.message));
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 200); return () => clearTimeout(timer); }, [load]);

  async function refreshDetail(id: string) { setSelected(await api.event(id)); }
  function openCreate() { setEditing(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(item: IntelligenceEvent) {
    setEditing(item); setForm({ primaryEventTypeTermId: item.primaryEventTypeTermId, title: item.title, summary: item.summary ?? "", startsAt: inputDate(item.startsAt), endsAt: inputDate(item.endsAt), observedAt: inputDate(item.observedAt), locationName: item.locationName ?? "", active: item.active }); setFormOpen(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const payload: EventInput = { ...form, summary: form.summary || null, locationName: form.locationName || null, startsAt: apiDate(form.startsAt), endsAt: apiDate(form.endsAt), observedAt: apiDate(form.observedAt) };
      const saved = editing ? await api.updateEvent(editing.id, payload) : await api.createEvent(payload);
      setFormOpen(false); await load(); await refreshDetail(saved.id); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function toggleActive(item: IntelligenceEvent) {
    if (item.active && !window.confirm(`Deactivate ${item.title}?`)) return; setBusy(true);
    try { await api.updateEvent(item.id, { active: !item.active }); await load(); await refreshDetail(item.id); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function mutate(action: () => Promise<unknown>) {
    if (!selected) return; setBusy(true);
    try { await action(); await refreshDetail(selected.id); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }

  return <Stack spacing={2}>
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Box><Typography variant="h5">Intelligence events</Typography><Typography color="text.secondary">Contextual events with governed classifications and supporting source material.</Typography></Box><Button variant="contained" startIcon={<Add />} onClick={openCreate}>Create event</Button></Stack>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ flexWrap: "wrap" }}>
      <TextField label="Search events" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} />
      <FormControl sx={{ minWidth: 200 }}><InputLabel>Primary event type</InputLabel><Select label="Primary event type" value={primaryTypeId} onChange={(event) => { setPrimaryTypeId(event.target.value); setPage(1); }}><MenuItem value="">All</MenuItem>{primaryTypes.map((term) => <MenuItem key={term.id} value={term.id}>{term.label}</MenuItem>)}</Select></FormControl>
      <FormControl sx={{ minWidth: 180 }}><InputLabel>Classification type</InputLabel><Select label="Classification type" value={classificationType} onChange={(event) => { setClassificationType(event.target.value as ClassificationType | ""); setTermId(""); setPage(1); }}><MenuItem value="">All</MenuItem>{CLASSIFICATION_TYPES.map((type) => <MenuItem key={type} value={type}>{type.replaceAll("_", " ")}</MenuItem>)}</Select></FormControl>
      <FormControl sx={{ minWidth: 200 }}><InputLabel>Classification term</InputLabel><Select label="Classification term" value={termId} onChange={(event) => { setTermId(event.target.value); setPage(1); }}><MenuItem value="">All</MenuItem>{terms.filter((term) => !classificationType || term.type === classificationType).map((term) => <MenuItem key={term.id} value={term.id}>{term.label}</MenuItem>)}</Select></FormControl>
      <FormControl sx={{ minWidth: 180 }}><InputLabel>Geographic scope</InputLabel><Select label="Geographic scope" value={geographicTermId} onChange={(event) => { setGeographicTermId(event.target.value); setPage(1); }}><MenuItem value="">All</MenuItem>{geographicTerms.map((term) => <MenuItem key={term.id} value={term.id}>{term.label}</MenuItem>)}</Select></FormControl>
      <FormControl sx={{ minWidth: 130 }}><InputLabel shrink>State</InputLabel><Select native label="State" value={active} onChange={(event) => { setActive(event.target.value as typeof active); setPage(1); }}><option value="true">Active</option><option value="false">Inactive</option></Select></FormControl>
      <TextField type="date" label="Starts from" slotProps={{ inputLabel: { shrink: true } }} value={startsAtFrom} onChange={(event) => { setStartsAtFrom(event.target.value); setPage(1); }} />
      <TextField type="date" label="Starts to" slotProps={{ inputLabel: { shrink: true } }} value={startsAtTo} onChange={(event) => { setStartsAtTo(event.target.value); setPage(1); }} />
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}{loading && <CircularProgress aria-label="Loading events" />}{!loading && items.length === 0 && <Alert severity="info">No events match these filters.</Alert>}
    {items.map((item) => <Card key={item.id} variant="outlined"><CardActionArea onClick={() => void refreshDetail(item.id)}><CardContent><Stack spacing={0.5}><Stack direction="row" spacing={1}><Chip size="small" label={item.primaryEventType.label} /><Chip size="small" label={item.active ? "Active" : "Inactive"} /></Stack><Typography variant="h6">{item.title}</Typography><Typography color="text.secondary">{item.locationName || "Location not specified"}{item.startsAt ? ` · ${new Date(item.startsAt).toLocaleString()}` : ""}</Typography></Stack></CardContent></CardActionArea></Card>)}
    {!loading && items.length > 0 && <Pagination page={page} count={totalPages} onChange={(_event, value) => setPage(value)} aria-label="Event pages" sx={{ alignSelf: "center" }} />}

    <Dialog open={formOpen} onClose={() => !busy && setFormOpen(false)} fullWidth maxWidth="sm"><Stack component="form" onSubmit={submit}><DialogTitle>{editing ? "Edit intelligence event" : "Create intelligence event"}</DialogTitle><DialogContent dividers><Stack spacing={2}>
      <FormControl required><InputLabel shrink>Primary event type</InputLabel><Select native label="Primary event type" value={form.primaryEventTypeTermId} onChange={(event) => setForm({ ...form, primaryEventTypeTermId: event.target.value })}><option value="" />{primaryTypes.map((term) => <option key={term.id} value={term.id}>{term.code} — {term.label}</option>)}</Select></FormControl>
      <TextField required label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      <TextField multiline minRows={3} label="Summary" value={form.summary ?? ""} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
      <TextField type="datetime-local" label="Starts at" slotProps={{ inputLabel: { shrink: true } }} value={form.startsAt ?? ""} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
      <TextField type="datetime-local" label="Ends at" slotProps={{ inputLabel: { shrink: true } }} value={form.endsAt ?? ""} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
      <TextField type="datetime-local" label="Observed at" slotProps={{ inputLabel: { shrink: true } }} value={form.observedAt ?? ""} onChange={(event) => setForm({ ...form, observedAt: event.target.value })} />
      <TextField label="Descriptive location" value={form.locationName ?? ""} onChange={(event) => setForm({ ...form, locationName: event.target.value })} />
      {editing && <FormControlLabel control={<Switch checked={form.active ?? true} onChange={(_, checked) => setForm({ ...form, active: checked })} />} label="Active" />}
    </Stack></DialogContent><DialogActions><Button onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogActions></Stack></Dialog>

    <Dialog open={Boolean(selected)} onClose={() => !busy && setSelected(null)} fullWidth maxWidth="md"><DialogTitle>{selected?.title}</DialogTitle><DialogContent dividers><Stack spacing={2}>{selected && <>
      <Stack direction="row" spacing={1}><Chip label={selected.primaryEventType.label} /><Chip label={selected.active ? "Active" : "Inactive"} /></Stack>{selected.summary && <Typography>{selected.summary}</Typography>}<Typography color="text.secondary">Location: {selected.locationName || "Not specified"}</Typography>
      <Stack direction="row" spacing={1}><Button startIcon={<Edit />} onClick={() => openEdit(selected)}>Edit</Button><Button color={selected.active ? "warning" : "success"} disabled={busy} onClick={() => void toggleActive(selected)}>{selected.active ? "Deactivate" : "Reactivate"}</Button></Stack>
      <Typography variant="h6">Additional classifications</Typography>
      {selected.classifications?.length ? selected.classifications.map((assignment) => <Stack key={assignment.termId} direction="row" spacing={1} sx={{ alignItems: "center" }}><Chip label={`${assignment.term.code} — ${assignment.term.label}`} /><Typography variant="caption">{assignment.provenance}</Typography><Button color="error" startIcon={<Delete />} disabled={busy || assignment.provenance !== "MANUAL"} onClick={() => void mutate(() => api.removeEventTerm(selected.id, assignment.termId))}>Remove</Button></Stack>) : <Alert severity="info">No additional classifications.</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><FormControl fullWidth><InputLabel shrink>Classification term</InputLabel><Select native label="Classification term" value={classificationToAdd} onChange={(event) => setClassificationToAdd(event.target.value)}><option value="" />{assignableTerms.map((term) => <option key={term.id} value={term.id}>{term.type}: {term.label}</option>)}</Select></FormControl><Button startIcon={<Add />} disabled={busy || !classificationToAdd} onClick={() => void mutate(async () => { await api.assignEventTerm(selected.id, classificationToAdd); setClassificationToAdd(""); })}>Assign</Button></Stack>
      <Typography variant="h6">Evidence articles</Typography><Alert severity="warning">Evidence is supporting source material and is not a verified statement of truth.</Alert>
      {selected.evidence?.length ? selected.evidence.map((evidence) => <Stack key={evidence.articleId} direction="row" spacing={1} sx={{ alignItems: "center" }}><Link sx={{ flex: 1 }} href={evidence.article.url} target="_blank" rel="noopener noreferrer">{evidence.article.title}</Link><Button color="error" onClick={() => void mutate(() => api.removeEventEvidence(selected.id, evidence.articleId))}>Remove</Button></Stack>) : <Alert severity="info">No evidence articles linked.</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><FormControl fullWidth><InputLabel shrink>Evidence article</InputLabel><Select native label="Evidence article" value={evidenceToAdd} onChange={(event) => setEvidenceToAdd(event.target.value)}><option value="" />{articles.map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}</Select></FormControl><Button startIcon={<Add />} disabled={busy || !evidenceToAdd} onClick={() => void mutate(async () => { await api.addEventEvidence(selected.id, evidenceToAdd); setEvidenceToAdd(""); })}>Add evidence</Button></Stack>
    </>}</Stack></DialogContent><DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions></Dialog>
  </Stack>;
}
