import { Add, Delete, Link as LinkIcon } from "@mui/icons-material";
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Chip,
  Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, LinearProgress,
  Link, MenuItem, Pagination, Select, Stack, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { BrandedState } from "./BrandedState";
import type {
  Article, ArticleRelationships, ClassificationAssignment, ClassificationTerm,
  ClassificationType, Organization, Product, RssSource,
} from "../types";
import { CLASSIFICATION_TYPES } from "../types";

const PAGE_SIZE = 10;
interface ArticleIntel { classifications: ClassificationAssignment[]; relationships: ArticleRelationships }

export function ArticleFeed() {
  const [query, setQuery] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [classificationType, setClassificationType] = useState<ClassificationType | "">("");
  const [termId, setTermId] = useState("");
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [intel, setIntel] = useState<Record<string, ArticleIntel>>({});
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sources, setSources] = useState<RssSource[]>([]);
  const [terms, setTerms] = useState<ClassificationTerm[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [termToAdd, setTermToAdd] = useState("");
  const [organizationToAdd, setOrganizationToAdd] = useState("");
  const [productToAdd, setProductToAdd] = useState("");

  useEffect(() => {
    Promise.all([
      api.sources(), api.taxonomy(), api.organizations({ active: true, limit: 100 }), api.products({ active: true, limit: 100 }),
    ]).then(([nextSources, nextTerms, nextOrganizations, nextProducts]) => {
      setSources(nextSources);
      setTerms(nextTerms.items);
      setOrganizations(nextOrganizations.items);
      setProducts(nextProducts.items);
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.articles({
        q: query, sourceId: sourceId || undefined,
        classificationType: classificationType || undefined, termId: termId || undefined,
        page, limit: PAGE_SIZE,
      });
      setArticles(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      const entries = await Promise.all(result.items.map(async (article) => {
        const [classifications, relationships] = await Promise.all([
          api.articleClassifications(article.id), api.articleRelationships(article.id),
        ]);
        return [article.id, { classifications: classifications.items, relationships }] as const;
      }));
      setIntel(Object.fromEntries(entries));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [classificationType, page, query, reload, sourceId, termId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const filteredTerms = useMemo(
    () => terms.filter((term) => !classificationType || term.type === classificationType),
    [classificationType, terms],
  );
  const assignableTerms = terms.filter((term) => term.active && term.assignable);
  const selectedIntel = selected ? intel[selected.id] : undefined;

  async function refreshSelected() {
    if (!selected) return;
    const [classifications, relationships] = await Promise.all([
      api.articleClassifications(selected.id), api.articleRelationships(selected.id),
    ]);
    setIntel((current) => ({ ...current, [selected.id]: { classifications: classifications.items, relationships } }));
  }

  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refreshSelected();
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  function resetPage() { setPage(1); }

  return <Stack spacing={2}>
    <Box><Typography variant="h5">Article intelligence</Typography><Typography color="text.secondary">Search collected reporting and add explicit governed context.</Typography></Box>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
      <TextField fullWidth label="Search articles" value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} />
      <FormControl fullWidth><InputLabel>RSS source</InputLabel><Select label="RSS source" value={sourceId} onChange={(event) => { setSourceId(event.target.value); resetPage(); }}>
        <MenuItem value="">All sources</MenuItem>{sources.map((source) => <MenuItem key={source.id} value={source.id}>{source.name}</MenuItem>)}
      </Select></FormControl>
      <FormControl fullWidth><InputLabel>Classification type</InputLabel><Select label="Classification type" value={classificationType} onChange={(event) => { setClassificationType(event.target.value as ClassificationType | ""); setTermId(""); resetPage(); }}>
        <MenuItem value="">All types</MenuItem>{CLASSIFICATION_TYPES.map((type) => <MenuItem key={type} value={type}>{type.replaceAll("_", " ")}</MenuItem>)}
      </Select></FormControl>
      <FormControl fullWidth><InputLabel>Classification term</InputLabel><Select label="Classification term" value={termId} onChange={(event) => { setTermId(event.target.value); resetPage(); }}>
        <MenuItem value="">All terms</MenuItem>{filteredTerms.map((term) => <MenuItem key={term.id} value={term.id}>{term.code} — {term.label}</MenuItem>)}
      </Select></FormControl>
    </Stack>
    {loading && articles.length > 0 && <LinearProgress aria-label="Loading articles" />}
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => setReload((value) => value + 1)}>Retry</Button>}>{error}</Alert>}
    {loading && articles.length === 0
      ? <BrandedState loading label="Loading articles" />
      : !error && articles.length === 0
        ? <BrandedState label="No articles match the selected filters." />
        : articles.map((article) => {
          const itemIntel = intel[article.id];
          return <Card key={article.id} variant="outlined"><CardActionArea onClick={() => setSelected(article)}>
            <CardContent><Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Chip size="small" label={article.source.name} />
                <Typography variant="caption" color="text.secondary">{new Date(article.publishedAt ?? article.collectedAt).toLocaleString()}</Typography>
              </Stack>
              <Typography variant="h6">{article.title}</Typography>
              {article.summary && <Typography color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{article.summary}</Typography>}
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                {itemIntel?.classifications.map((assignment) => <Chip key={assignment.termId} size="small" color="primary" variant="outlined" label={assignment.term.label} />)}
                {itemIntel?.relationships.organizations.map((link) => <Chip key={link.organizationId} size="small" label={`Org: ${link.canonicalName}`} />)}
                {itemIntel?.relationships.products.map((link) => <Chip key={link.productId} size="small" label={`Product: ${link.name}`} />)}
              </Stack>
            </Stack></CardContent>
          </CardActionArea></Card>;
        })}
    {!loading && !error && total > 0 && <Stack spacing={1} sx={{ alignItems: "center", pt: 1 }}>
      <Typography variant="body2" color="text.secondary">{total} article{total === 1 ? "" : "s"}</Typography>
      <Pagination page={page} count={totalPages} color="primary" onChange={(_event, value) => setPage(value)} aria-label="Article pages" />
    </Stack>}

    <Dialog open={Boolean(selected)} onClose={() => !busy && setSelected(null)} fullWidth maxWidth="md">
      <DialogTitle>Article intelligence</DialogTitle>
      <DialogContent dividers><Stack spacing={2}>
        {selected && <>
          <Typography variant="h6">{selected.title}</Typography>
          <Link href={selected.url} target="_blank" rel="noopener noreferrer">Open publisher article</Link>
          {selected.summary && <Typography color="text.secondary">{selected.summary}</Typography>}
        </>}
        <Typography variant="subtitle1">Classifications</Typography>
        {selectedIntel?.classifications.length
          ? selectedIntel.classifications.map((assignment) => <Stack key={assignment.termId} direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Chip label={`${assignment.term.code} — ${assignment.term.label}`} />
            <Typography variant="caption">{assignment.provenance}{assignment.confidence === null ? "" : ` · confidence ${assignment.confidence}`}</Typography>
            <Button size="small" color="error" startIcon={<Delete />} disabled={busy || assignment.provenance !== "MANUAL"} onClick={() => void mutate(() => api.removeArticleTerm(selected!.id, assignment.termId))}>Remove</Button>
          </Stack>)
          : <Alert severity="info">No classifications assigned.</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControl fullWidth><InputLabel shrink>Assign term</InputLabel><Select native label="Assign term" value={termToAdd} onChange={(event) => setTermToAdd(event.target.value)}>
            <option value="" />{assignableTerms.map((term) => <option key={term.id} value={term.id}>{term.type}: {term.code} — {term.label}</option>)}
          </Select></FormControl>
          <Button variant="outlined" startIcon={<Add />} disabled={busy || !termToAdd} onClick={() => void mutate(async () => { await api.assignArticleTerm(selected!.id, termToAdd); setTermToAdd(""); })}>Assign</Button>
        </Stack>

        <Typography variant="subtitle1">Linked organizations</Typography>
        {selectedIntel?.relationships.organizations.map((link) => <Stack key={link.organizationId} direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography sx={{ flex: 1 }}>{link.canonicalName} · {link.type.label}{!link.active && " · inactive"}</Typography>
          <Button size="small" color="error" onClick={() => void mutate(() => api.unlinkArticleOrganization(selected!.id, link.organizationId))}>Unlink</Button>
        </Stack>)}
        {!selectedIntel?.relationships.organizations.length && <Alert severity="info">No organizations linked.</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControl fullWidth><InputLabel shrink>Organization</InputLabel><Select native label="Organization" value={organizationToAdd} onChange={(event) => setOrganizationToAdd(event.target.value)}>
            <option value="" />{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.canonicalName}</option>)}
          </Select></FormControl>
          <Button variant="outlined" startIcon={<LinkIcon />} disabled={busy || !organizationToAdd} onClick={() => void mutate(async () => { await api.linkArticleOrganization(selected!.id, organizationToAdd); setOrganizationToAdd(""); })}>Link</Button>
        </Stack>

        <Typography variant="subtitle1">Linked products</Typography>
        {selectedIntel?.relationships.products.map((link) => <Stack key={link.productId} direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography sx={{ flex: 1 }}>{link.code} — {link.name}{!link.active && " · inactive"}</Typography>
          <Button size="small" color="error" onClick={() => void mutate(() => api.unlinkArticleProduct(selected!.id, link.productId))}>Unlink</Button>
        </Stack>)}
        {!selectedIntel?.relationships.products.length && <Alert severity="info">No products linked.</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControl fullWidth><InputLabel shrink>Product</InputLabel><Select native label="Product" value={productToAdd} onChange={(event) => setProductToAdd(event.target.value)}>
            <option value="" />{products.map((product) => <option key={product.id} value={product.id}>{product.code} — {product.name}</option>)}
          </Select></FormControl>
          <Button variant="outlined" startIcon={<LinkIcon />} disabled={busy || !productToAdd} onClick={() => void mutate(async () => { await api.linkArticleProduct(selected!.id, productToAdd); setProductToAdd(""); })}>Link</Button>
        </Stack>
      </Stack></DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setSelected(null)}>Close</Button></DialogActions>
    </Dialog>
  </Stack>;
}
