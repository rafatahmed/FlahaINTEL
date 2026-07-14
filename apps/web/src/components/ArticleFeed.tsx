import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Link,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { Article } from "../types";

const PAGE_SIZE = 10;

export function ArticleFeed() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      api.articles(query, page, PAGE_SIZE)
        .then((result) => {
          if (cancelled) return;
          setArticles(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages);
          setError("");
        })
        .catch((reason: Error) => { if (!cancelled) setError(reason.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, page, reload]);

  return <Stack spacing={2}>
    <TextField
      fullWidth
      label="Search articles"
      value={query}
      onChange={(event) => { setQuery(event.target.value); setPage(1); }}
    />
    {loading && articles.length > 0 && <LinearProgress aria-label="Loading articles" />}
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => setReload((value) => value + 1)}>Retry</Button>}>{error}</Alert>}
    {loading && articles.length === 0
      ? <Stack sx={{ alignItems: "center", py: 4 }}><CircularProgress aria-label="Loading articles" /></Stack>
      : !error && articles.length === 0
        ? <Alert severity="info">{query ? "No articles match this search." : "No articles have been collected yet."}</Alert>
        : articles.map((article) =>
          <Card key={article.id} variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                <Chip size="small" label={article.source.name} />
                <Typography variant="caption" color="text.secondary">
                  {new Date(article.publishedAt ?? article.collectedAt).toLocaleString()}
                </Typography>
              </Stack>
              <Typography variant="h6">
                <Link href={article.url} target="_blank" rel="noopener noreferrer" underline="hover">{article.title}</Link>
              </Typography>
              {article.summary && <Typography color="text.secondary" sx={{ mt: 1 }}>{article.summary}</Typography>}
            </CardContent>
          </Card>)}
    {!loading && !error && total > 0 && <Stack spacing={1} sx={{ alignItems: "center", pt: 1 }}>
      <Typography variant="body2" color="text.secondary">{total} article{total === 1 ? "" : "s"}</Typography>
      <Pagination
        page={page}
        count={totalPages}
        color="primary"
        onChange={(_event, value) => setPage(value)}
        aria-label="Article pages"
      />
    </Stack>}
  </Stack>;
}
