import { AppBar, Box, Container, CssBaseline, Tab, Tabs, Toolbar, Typography } from "@mui/material";
import { useState } from "react";
import { ArticleFeed } from "./components/ArticleFeed";
import { SourceManager } from "./components/SourceManager";

export default function App() {
  const [tab, setTab] = useState(0);
  return <>
    <CssBaseline />
    <AppBar position="static"><Toolbar><Typography variant="h6">FlahaINTEL</Typography></Toolbar></AppBar>
    <Container maxWidth="md">
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)} sx={{ mb: 3 }}>
        <Tab label="News feed" /><Tab label="RSS sources" />
      </Tabs>
      <Box sx={{ pb: 5 }}>{tab === 0 ? <ArticleFeed /> : <SourceManager />}</Box>
    </Container>
  </>;
}
