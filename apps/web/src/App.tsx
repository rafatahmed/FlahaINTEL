/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaINTEL Application Root
 * Introduction: Product shell wiring navigation for whole intelligence surfaces.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-31
 */
import { Box, CssBaseline, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "./api";
import { AuthProvider, useAuth } from "./auth";
import { GovernanceConsole } from "./components/GovernanceConsole";
import { SourceManager } from "./components/SourceManager";
import { AppShell, type NavKey } from "./layout/AppShell";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { ContentPage } from "./pages/ContentPage";
import { DashboardPage } from "./pages/DashboardPage";
import { JobsPage } from "./pages/JobsPage";
import { KnowledgePacksPage } from "./pages/KnowledgePacksPage";
import { LoginPage } from "./pages/LoginPage";
import { MarketsPage } from "./pages/MarketsPage";
import { ReviewInboxPage } from "./pages/ReviewInboxPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SubmitPage } from "./pages/SubmitPage";

function Shell() {
  const { auth, ready } = useAuth();
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [readiness, setReadiness] = useState<string>("");
  const [governanceFocus, setGovernanceFocus] = useState<string | null>(null);
  const [knowledgeFocus, setKnowledgeFocus] = useState<{
    lane?: "overview" | "soil" | "calc" | "fast" | "markets";
    soilTool?: "packs" | "bank" | "cases" | "import";
  } | null>(null);

  useEffect(() => {
    if (!auth) return;
    void api
      .systemReadiness()
      .then((r) => setReadiness(r.overall))
      .catch(() => setReadiness("UNKNOWN"));
  }, [auth]);

  function navigate(key: NavKey, focus?: string) {
    setNav(key);
    if (key === "governance" && focus) setGovernanceFocus(focus);
    if (key !== "governance") setGovernanceFocus(null);
    if (key !== "knowledge") setKnowledgeFocus(null);
  }

  function deepLink(link: { nav: string; lane?: string; soilTool?: string; channelCode?: string }) {
    const nav = link.nav as NavKey;
    if (nav === "knowledge") {
      setKnowledgeFocus({
        lane: (link.lane as "soil" | "calc" | "fast" | "markets" | undefined) || "overview",
        soilTool: (link.soilTool as "packs" | "bank" | "cases" | "import" | undefined) || "packs",
      });
      setNav("knowledge");
      return;
    }
    if (nav === "markets") {
      setNav("markets");
      return;
    }
    navigate(nav);
  }

  if (!ready) return null;
  if (!auth) return <LoginPage />;

  return (
    <AppShell active={nav} onNavigate={(key) => navigate(key)} readiness={readiness}>
      {nav === "dashboard" && <DashboardPage onNavigate={navigate} />}
      {nav === "review" && <ReviewInboxPage onNavigate={navigate} />}
      {nav === "markets" && <MarketsPage />}
      {nav === "knowledge" && (
        <KnowledgePacksPage
          initialLane={knowledgeFocus?.lane}
          initialSoilTool={knowledgeFocus?.soilTool}
        />
      )}
      {nav === "sources" && (
        <>
          <SourcePurposeHeader />
          <SourceManager />
        </>
      )}
      {nav === "submit" && (
        <SubmitPage onOpenSubmission={() => navigate("jobs")} onDeepLink={deepLink} />
      )}
      {nav === "jobs" && <JobsPage />}
      {nav === "content" && (
        <ContentPage onOpenGovernance={(id) => navigate("governance", id)} />
      )}
      {nav === "governance" && (
        <GovernanceConsole initialCandidateId={governanceFocus} hideAuthForm />
      )}
      {nav === "artifacts" && <ArtifactsPage />}
      {nav === "settings" && <SettingsPage />}
    </AppShell>
  );
}

function SourcePurposeHeader() {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h5">Sources</Typography>
      <Typography variant="body2" color="text.secondary">
        <strong>Eyes (recurring)</strong> — RSS feeds Flaha watches on a schedule. One-shot files and market archives
        go through <strong>Submit</strong>; structured product notes live under <strong>Knowledge</strong>.
      </Typography>
    </Box>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CssBaseline />
      <Shell />
    </AuthProvider>
  );
}
