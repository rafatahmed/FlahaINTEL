import { Add, Edit, Link as LinkIcon } from "@mui/icons-material";
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel,
  MenuItem, Pagination, Select, Stack, Switch, TextField, Typography,
} from "@mui/material";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api, type OrganizationInput } from "../api";
import type { Organization, OrganizationProductRole, OrganizationType, Product } from "../types";

const ROLES: OrganizationProductRole[] = ["MANUFACTURER", "BRAND_OWNER", "DEVELOPER", "DISTRIBUTOR", "SUPPLIER", "IMPORTER"];
const emptyForm: OrganizationInput = { typeId: "", canonicalName: "", homepageUrl: "", countryCode: "", region: "", description: "" };

export function OrganizationWorkspace() {
  const [items, setItems] = useState<Organization[]>([]);
  const [types, setTypes] = useState<OrganizationType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [typeId, setTypeId] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [active, setActive] = useState<"true" | "false" | "">("true");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [form, setForm] = useState<OrganizationInput>(emptyForm);
  const [selected, setSelected] = useState<Organization | null>(null);
  const [relationshipProduct, setRelationshipProduct] = useState("");
  const [relationshipRole, setRelationshipRole] = useState<OrganizationProductRole>("MANUFACTURER");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.organizations({ q, typeId: typeId || undefined, countryCode: countryCode || undefined, active: active === "" ? undefined : active === "true", page, limit: 10 });
      setItems(result.items); setTotalPages(result.totalPages); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setLoading(false); }
  }, [active, countryCode, page, q, typeId]);

  useEffect(() => {
    Promise.all([api.organizationTypes(), api.products({ active: true, limit: 100 })])
      .then(([nextTypes, nextProducts]) => { setTypes(nextTypes.items); setProducts(nextProducts.items); })
      .catch((reason: Error) => setError(reason.message));
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 200); return () => clearTimeout(timer); }, [load]);

  async function refreshDetail(id: string) { setSelected(await api.organization(id)); }
  function openCreate() { setEditing(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(item: Organization) {
    setEditing(item);
    setForm({ typeId: item.typeId, canonicalName: item.canonicalName, homepageUrl: item.homepageUrl ?? "", countryCode: item.countryCode ?? "", region: item.region ?? "", description: item.description ?? "", active: item.active });
    setFormOpen(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const payload = { ...form, countryCode: form.countryCode?.toUpperCase() || null, homepageUrl: form.homepageUrl || null, region: form.region || null, description: form.description || null };
      const saved = editing ? await api.updateOrganization(editing.id, payload) : await api.createOrganization(payload);
      setFormOpen(false); await load(); await refreshDetail(saved.id); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function toggleActive(item: Organization) {
    if (item.active && !window.confirm(`Deactivate ${item.canonicalName}?`)) return;
    setBusy(true);
    try { await api.updateOrganization(item.id, { active: !item.active }); await load(); if (selected?.id === item.id) await refreshDetail(item.id); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function addRelationship() {
    if (!selected || !relationshipProduct) return;
    setBusy(true);
    try { await api.linkOrganizationProduct(selected.id, relationshipProduct, relationshipRole); await refreshDetail(selected.id); setRelationshipProduct(""); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function removeRelationship(productId: string, role: OrganizationProductRole) {
    if (!selected) return; setBusy(true);
    try { await api.unlinkOrganizationProduct(selected.id, productId, role); await refreshDetail(selected.id); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }

  return <Stack spacing={2}>
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Box><Typography variant="h5">Organizations</Typography><Typography color="text.secondary">Governed organizations and explicit product roles.</Typography></Box><Button variant="contained" startIcon={<Add />} onClick={openCreate}>Create organization</Button></Stack>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
      <TextField fullWidth label="Search organizations" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} />
      <FormControl fullWidth><InputLabel>Primary type</InputLabel><Select label="Primary type" value={typeId} onChange={(event) => { setTypeId(event.target.value); setPage(1); }}><MenuItem value="">All types</MenuItem>{types.map((type) => <MenuItem key={type.id} value={type.id}>{type.label}</MenuItem>)}</Select></FormControl>
      <TextField label="Country code" slotProps={{ htmlInput: { maxLength: 2 } }} value={countryCode} onChange={(event) => { setCountryCode(event.target.value.toUpperCase()); setPage(1); }} />
      <FormControl fullWidth><InputLabel shrink>State</InputLabel><Select native label="State" value={active} onChange={(event) => { setActive(event.target.value as typeof active); setPage(1); }}><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></Select></FormControl>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {loading && <CircularProgress aria-label="Loading organizations" />}
    {!loading && items.length === 0 && <Alert severity="info">No organizations match these filters.</Alert>}
    {items.map((item) => <Card key={item.id} variant="outlined"><CardActionArea onClick={() => void refreshDetail(item.id)}><CardContent><Typography variant="h6">{item.canonicalName}</Typography><Typography color="text.secondary">{item.type.label}{item.countryCode ? ` · ${item.countryCode}` : ""} · {item.active ? "Active" : "Inactive"}</Typography></CardContent></CardActionArea></Card>)}
    {!loading && items.length > 0 && <Pagination page={page} count={totalPages} onChange={(_event, value) => setPage(value)} aria-label="Organization pages" sx={{ alignSelf: "center" }} />}

    <Dialog open={formOpen} onClose={() => !busy && setFormOpen(false)} fullWidth maxWidth="sm"><Stack component="form" onSubmit={submit}>
      <DialogTitle>{editing ? "Edit organization" : "Create organization"}</DialogTitle><DialogContent dividers><Stack spacing={2}>
        <TextField required label="Canonical name" value={form.canonicalName} onChange={(event) => setForm({ ...form, canonicalName: event.target.value })} />
        <FormControl required><InputLabel shrink>Primary organization type</InputLabel><Select native label="Primary organization type" value={form.typeId} onChange={(event) => setForm({ ...form, typeId: event.target.value })}><option value="" />{types.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</Select></FormControl>
        <TextField type="url" label="Homepage URL" value={form.homepageUrl ?? ""} onChange={(event) => setForm({ ...form, homepageUrl: event.target.value })} />
        <TextField label="Country code" slotProps={{ htmlInput: { maxLength: 2 } }} value={form.countryCode ?? ""} onChange={(event) => setForm({ ...form, countryCode: event.target.value.toUpperCase() })} />
        <TextField label="Region" value={form.region ?? ""} onChange={(event) => setForm({ ...form, region: event.target.value })} />
        <TextField multiline minRows={3} label="Description" value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        {editing && <FormControlLabel control={<Switch checked={form.active ?? true} onChange={(_, checked) => setForm({ ...form, active: checked })} />} label="Active" />}
      </Stack></DialogContent><DialogActions><Button onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogActions>
    </Stack></Dialog>

    <Dialog open={Boolean(selected)} onClose={() => !busy && setSelected(null)} fullWidth maxWidth="md"><DialogTitle>{selected?.canonicalName}</DialogTitle><DialogContent dividers><Stack spacing={2}>
      {selected && <><Typography>{selected.type.label} · {selected.active ? "Active" : "Inactive"}</Typography><Typography color="text.secondary">Normalized name: {selected.normalizedName}</Typography>{selected.description && <Typography>{selected.description}</Typography>}
        <Stack direction="row" spacing={1}><Button startIcon={<Edit />} onClick={() => openEdit(selected)}>Edit</Button><Button color={selected.active ? "warning" : "success"} disabled={busy} onClick={() => void toggleActive(selected)}>{selected.active ? "Deactivate" : "Reactivate"}</Button></Stack>
        <Typography variant="h6">Related products and roles</Typography>
        {selected.products?.length ? selected.products.map((link) => <Stack key={`${link.productId}-${link.role}`} direction="row" spacing={1} sx={{ alignItems: "center" }}><Typography sx={{ flex: 1 }}>{link.product?.code} — {link.product?.name} · {link.role.replaceAll("_", " ")}</Typography><Button color="error" onClick={() => void removeRelationship(link.productId, link.role)}>Remove</Button></Stack>) : <Alert severity="info">No product relationships.</Alert>}
        {selected.active && <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><FormControl fullWidth><InputLabel shrink>Product</InputLabel><Select native label="Product" value={relationshipProduct} onChange={(event) => setRelationshipProduct(event.target.value)}><option value="" />{products.map((product) => <option key={product.id} value={product.id}>{product.code} — {product.name}</option>)}</Select></FormControl><FormControl fullWidth><InputLabel shrink>Role</InputLabel><Select native label="Role" value={relationshipRole} onChange={(event) => setRelationshipRole(event.target.value as OrganizationProductRole)}>{ROLES.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</Select></FormControl><Button startIcon={<LinkIcon />} disabled={busy || !relationshipProduct} onClick={() => void addRelationship()}>Link</Button></Stack>}
      </>}
    </Stack></DialogContent><DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions></Dialog>
  </Stack>;
}
