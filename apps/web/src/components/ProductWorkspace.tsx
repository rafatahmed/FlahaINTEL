import { Add, Edit, Link as LinkIcon } from "@mui/icons-material";
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel,
  MenuItem, Pagination, Select, Stack, Switch, TextField, Typography,
} from "@mui/material";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api, type ProductInput } from "../api";
import { BrandedState } from "./BrandedState";
import type { ClassificationTerm, Organization, OrganizationProductRole, Product } from "../types";

const ROLES: OrganizationProductRole[] = ["MANUFACTURER", "BRAND_OWNER", "DEVELOPER", "DISTRIBUTOR", "SUPPLIER", "IMPORTER"];
const emptyForm: ProductInput = { code: "", name: "", categoryTermId: "", description: "" };

export function ProductWorkspace() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ClassificationTerm[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [q, setQ] = useState("");
  const [categoryTermId, setCategoryTermId] = useState("");
  const [active, setActive] = useState<"true" | "false" | "">("true");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [selected, setSelected] = useState<Product | null>(null);
  const [relationshipOrganization, setRelationshipOrganization] = useState("");
  const [relationshipRole, setRelationshipRole] = useState<OrganizationProductRole>("MANUFACTURER");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.products({ q, categoryTermId: categoryTermId || undefined, active: active === "" ? undefined : active === "true", page, limit: 10 });
      setItems(result.items); setTotalPages(result.totalPages); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setLoading(false); }
  }, [active, categoryTermId, page, q]);

  useEffect(() => {
    Promise.all([api.taxonomyType("PRODUCT_CATEGORY"), api.organizations({ active: true, limit: 100 })])
      .then(([taxonomy, nextOrganizations]) => {
        setCategories(taxonomy.items.filter((term) => term.active && term.assignable && term.entityEligibility === "COMMERCIAL_PRODUCT"));
        setOrganizations(nextOrganizations.items);
      }).catch((reason: Error) => setError(reason.message));
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 200); return () => clearTimeout(timer); }, [load]);

  async function refreshDetail(id: string) { setSelected(await api.product(id)); }
  function openCreate() { setEditing(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(item: Product) { setEditing(item); setForm({ code: item.code, name: item.name, categoryTermId: item.categoryTermId, description: item.description ?? "", active: item.active }); setFormOpen(true); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const saved = editing
        ? await api.updateProduct(editing.id, { name: form.name, categoryTermId: form.categoryTermId, description: form.description || null, active: form.active })
        : await api.createProduct({ ...form, code: form.code.toUpperCase(), description: form.description || null });
      setFormOpen(false); await load(); await refreshDetail(saved.id); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function toggleActive(item: Product) {
    if (item.active && !window.confirm(`Deactivate ${item.name}?`)) return;
    setBusy(true);
    try { await api.updateProduct(item.id, { active: !item.active }); await load(); if (selected?.id === item.id) await refreshDetail(item.id); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function addRelationship() {
    if (!selected || !relationshipOrganization) return; setBusy(true);
    try { await api.linkOrganizationProduct(relationshipOrganization, selected.id, relationshipRole); await refreshDetail(selected.id); setRelationshipOrganization(""); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function removeRelationship(organizationId: string, role: OrganizationProductRole) {
    if (!selected) return; setBusy(true);
    try { await api.unlinkOrganizationProduct(organizationId, selected.id, role); await refreshDetail(selected.id); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }

  return <Stack spacing={2}>
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Box><Typography variant="h5">Products</Typography><Typography color="text.secondary">Governed commercial offerings; commodity data remains out of scope.</Typography></Box><Button variant="contained" startIcon={<Add />} onClick={openCreate}>Create product</Button></Stack>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1}><TextField fullWidth label="Search products" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} /><FormControl fullWidth><InputLabel>Commercial category</InputLabel><Select label="Commercial category" value={categoryTermId} onChange={(event) => { setCategoryTermId(event.target.value); setPage(1); }}><MenuItem value="">All categories</MenuItem>{categories.map((category) => <MenuItem key={category.id} value={category.id}>{category.label}</MenuItem>)}</Select></FormControl><FormControl fullWidth><InputLabel shrink>State</InputLabel><Select native label="State" value={active} onChange={(event) => { setActive(event.target.value as typeof active); setPage(1); }}><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></Select></FormControl></Stack>
    {error && <Alert severity="error">{error}</Alert>}{loading && <BrandedState loading label="Loading products" />}{!loading && items.length === 0 && <BrandedState label="No products match these filters." />}
    {items.map((item) => <Card key={item.id} variant="outlined"><CardActionArea onClick={() => void refreshDetail(item.id)}><CardContent><Typography variant="h6">{item.code} — {item.name}</Typography><Typography color="text.secondary">{item.category.label} · {item.active ? "Active" : "Inactive"}</Typography></CardContent></CardActionArea></Card>)}
    {!loading && items.length > 0 && <Pagination page={page} count={totalPages} onChange={(_event, value) => setPage(value)} aria-label="Product pages" sx={{ alignSelf: "center" }} />}

    <Dialog open={formOpen} onClose={() => !busy && setFormOpen(false)} fullWidth maxWidth="sm"><Stack component="form" onSubmit={submit}><DialogTitle>{editing ? "Edit product" : "Create product"}</DialogTitle><DialogContent dividers><Stack spacing={2}>
      <TextField required disabled={Boolean(editing)} label="Immutable uppercase code" slotProps={{ htmlInput: { pattern: "[A-Z][A-Z0-9_]*" } }} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />
      <TextField required label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <FormControl required><InputLabel shrink>Commercial product category</InputLabel><Select native label="Commercial product category" value={form.categoryTermId} onChange={(event) => setForm({ ...form, categoryTermId: event.target.value })}><option value="" />{categories.map((category) => <option key={category.id} value={category.id}>{category.code} — {category.label}</option>)}</Select></FormControl>
      <TextField multiline minRows={3} label="Description" value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      {editing && <FormControlLabel control={<Switch checked={form.active ?? true} onChange={(_, checked) => setForm({ ...form, active: checked })} />} label="Active" />}
    </Stack></DialogContent><DialogActions><Button onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogActions></Stack></Dialog>

    <Dialog open={Boolean(selected)} onClose={() => !busy && setSelected(null)} fullWidth maxWidth="md"><DialogTitle>{selected && `${selected.code} — ${selected.name}`}</DialogTitle><DialogContent dividers><Stack spacing={2}>{selected && <>
      <Typography>{selected.category.label} · {selected.active ? "Active" : "Inactive"}</Typography>{selected.description && <Typography>{selected.description}</Typography>}
      <Stack direction="row" spacing={1}><Button startIcon={<Edit />} onClick={() => openEdit(selected)}>Edit</Button><Button color={selected.active ? "warning" : "success"} disabled={busy} onClick={() => void toggleActive(selected)}>{selected.active ? "Deactivate" : "Reactivate"}</Button></Stack>
      <Typography variant="h6">Related organizations and roles</Typography>
      {selected.organizations?.length ? selected.organizations.map((link) => <Stack key={`${link.organizationId}-${link.role}`} direction="row" spacing={1} sx={{ alignItems: "center" }}><Typography sx={{ flex: 1 }}>{link.organization?.canonicalName} · {link.role.replaceAll("_", " ")}</Typography><Button color="error" onClick={() => void removeRelationship(link.organizationId, link.role)}>Remove</Button></Stack>) : <Alert severity="info">No organization relationships.</Alert>}
      {selected.active && <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><FormControl fullWidth><InputLabel shrink>Organization</InputLabel><Select native label="Organization" value={relationshipOrganization} onChange={(event) => setRelationshipOrganization(event.target.value)}><option value="" />{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.canonicalName}</option>)}</Select></FormControl><FormControl fullWidth><InputLabel shrink>Role</InputLabel><Select native label="Role" value={relationshipRole} onChange={(event) => setRelationshipRole(event.target.value as OrganizationProductRole)}>{ROLES.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</Select></FormControl><Button startIcon={<LinkIcon />} disabled={busy || !relationshipOrganization} onClick={() => void addRelationship()}>Link</Button></Stack>}
    </>}</Stack></DialogContent><DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions></Dialog>
  </Stack>;
}
