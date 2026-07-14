import { AccountTree } from "@mui/icons-material";
import {
  Alert, Box, Card, CardContent, Chip, CircularProgress, FormControl, InputLabel,
  MenuItem, Select, Stack, Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { CLASSIFICATION_TYPES, type ClassificationTerm, type ClassificationType } from "../types";

export function TaxonomyExplorer() {
  const [type, setType] = useState<ClassificationType>("GENERAL_DOMAIN");
  const [terms, setTerms] = useState<ClassificationTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.taxonomyType(type).then((result) => {
      if (!cancelled) { setTerms(result.items); setError(""); }
    }).catch((reason: Error) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type]);

  const depthByCode = useMemo(() => {
    const byCode = new Map(terms.map((term) => [term.code, term]));
    const result = new Map<string, number>();
    const depth = (term: ClassificationTerm, seen = new Set<string>()): number => {
      if (!term.parentCode || seen.has(term.code)) return 0;
      const parent = byCode.get(term.parentCode);
      return parent ? 1 + depth(parent, new Set(seen).add(term.code)) : 0;
    };
    terms.forEach((term) => result.set(term.code, depth(term)));
    return result;
  }, [terms]);

  return <Stack spacing={2}>
    <Box><Typography variant="h5">Governed taxonomy</Typography><Typography color="text.secondary">Read-only contextual and agricultural vocabularies.</Typography></Box>
    <FormControl sx={{ maxWidth: 420 }}><InputLabel>Classification type</InputLabel><Select label="Classification type" value={type} onChange={(event) => setType(event.target.value as ClassificationType)}>
      {CLASSIFICATION_TYPES.map((item) => <MenuItem key={item} value={item}>{item.replaceAll("_", " ")}</MenuItem>)}
    </Select></FormControl>
    {loading && <Stack sx={{ alignItems: "center", py: 4 }}><CircularProgress aria-label="Loading taxonomy" /></Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    {!loading && !error && terms.length === 0 && <Alert severity="info">No active terms exist for this type.</Alert>}
    {!loading && terms.map((term) => <Card key={term.id} variant="outlined" sx={{ ml: Math.min(depthByCode.get(term.code) ?? 0, 4) * 3 }}>
      <CardContent><Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <AccountTree color={term.parentCode ? "action" : "primary"} fontSize="small" />
          <Typography variant="h6">{term.label}</Typography>
          <Chip size="small" label={term.code} />
          <Chip size="small" color={term.assignable ? "success" : "default"} label={term.assignable ? "Assignable" : "Grouping only"} />
          <Chip size="small" label={term.active ? "Active" : "Inactive"} />
        </Stack>
        {term.parentCode && <Typography variant="caption" color="text.secondary">Parent: {term.parentCode}</Typography>}
        <Typography><strong>Definition and inclusion boundary:</strong> {term.description}</Typography>
        {term.standardCode && <Typography variant="body2">Standard code: {term.standardCode}</Typography>}
        {term.aliases.length > 0 && <Typography variant="body2">Aliases: {term.aliases.join(", ")}</Typography>}
        {term.entityEligibility && <Typography variant="body2">Product entity eligibility: {term.entityEligibility}</Typography>}
      </Stack></CardContent>
    </Card>)}
  </Stack>;
}
