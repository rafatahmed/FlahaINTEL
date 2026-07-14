import { Alert, Card, CardContent, Chip, CircularProgress, Link, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { Article } from "../types";

export function ArticleFeed() {
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      api.articles(query)
        .then((result) => { setArticles(result.items); setError(""); })
        .catch((reason: Error) => setError(reason.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return <Stack spacing={2}>
    <TextField fullWidth label="Search articles" value={query} onChange={(event) => setQuery(event.target.value)} />
    {error && <Alert severity="error">{error}</Alert>}
    {loading ? <CircularProgress /> : articles.length === 0 ? <Alert severity="info">No articles found.</Alert> : articles.map((article) =>
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
  </Stack>;
}
