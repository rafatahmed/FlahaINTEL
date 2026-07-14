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
    <AppBar position="static"><Toolbar><Typography variant="h6">FlahaINTEL</Typography></Toolbar></AppBar>
    <Container maxWidth="xl">
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="FlahaINTEL workspaces" sx={{ mb: 3 }}>
        {views.map((view) => <Tab key={view.label} label={view.label} />)}
      </Tabs>
      <Box sx={{ pb: 5 }}>{views[tab].content}</Box>
    </Container>
  </>;
}
