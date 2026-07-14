import { AppBar, Box, Container, CssBaseline, Tab, Tabs, Toolbar, Typography } from "@mui/material";
import { useState } from "react";
import { ArticleFeed } from "./components/ArticleFeed";
import { EventWorkspace } from "./components/EventWorkspace";
import { OrganizationWorkspace } from "./components/OrganizationWorkspace";
import { ProductWorkspace } from "./components/ProductWorkspace";
import { SourceManager } from "./components/SourceManager";
import { TaxonomyExplorer } from "./components/TaxonomyExplorer";

const views = [
  { label: "Articles", content: <ArticleFeed /> },
  { label: "Events", content: <EventWorkspace /> },
  { label: "Organizations", content: <OrganizationWorkspace /> },
  { label: "Products", content: <ProductWorkspace /> },
  { label: "Taxonomy", content: <TaxonomyExplorer /> },
  { label: "Sources", content: <SourceManager /> },
];

export default function App() {
  const [tab, setTab] = useState(0);
  return <>
    <CssBaseline />
    <AppBar position="static">
      <Toolbar sx={{ minHeight: { xs: 58, sm: 68 } }}>
        <Box
          component="img"
          src="/brand/flahaintel/flahaintel-logo-reverse.png"
          alt="FlahaINTEL — Intelligence for a Resilient World"
          sx={{ display: "block", width: "auto", height: { xs: 42, sm: 52 }, maxWidth: "100%" }}
        />
      </Toolbar>
    </AppBar>
    <Container maxWidth="xl">
      <Box component="section" aria-labelledby="flahaintel-introduction" sx={{ py: { xs: 2, sm: 2.5 } }}>
        <Typography id="flahaintel-introduction" variant="h5">FlahaINTEL</Typography>
        <Typography color="primary.main" sx={{ fontWeight: 600, letterSpacing: "0.04em" }}>Intelligence for a Resilient World</Typography>
        <Typography variant="body2" color="text.secondary">Verified sources. Governed taxonomy. Contextual and agricultural intelligence.</Typography>
      </Box>
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="FlahaINTEL workspaces" sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        {views.map((view) => <Tab key={view.label} label={view.label} />)}
      </Tabs>
      <Box sx={{ pb: 5 }}>{views[tab].content}</Box>
    </Container>
  </>;
}
