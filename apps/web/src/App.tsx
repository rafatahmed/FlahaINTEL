/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaINTEL Application Root
 * Introduction: Phase 3L product shell wiring navigation, auth, and operational pages.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { CssBaseline } from "@mui/material";
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
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SubmitPage } from "./pages/SubmitPage";

function Shell() {
  const { auth, ready } = useAuth();
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [readiness, setReadiness] = useState<string>("");
  const [governanceFocus, setGovernanceFocus] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    void api.systemReadiness().then((r) => setReadiness(r.overall)).catch(() => setReadiness("UNKNOWN"));
  }, [auth]);

  if (!ready) return null;
  if (!auth) return <LoginPage />;

  return (
    <AppShell
      active={nav}
      onNavigate={(key) => { setNav(key); if (key !== "governance") setGovernanceFocus(null); }}
      readiness={readiness}
    >
      {nav === "dashboard" && <DashboardPage />}
      {nav === "sources" && <SourceManager />}
      {nav === "submit" && <SubmitPage />}
      {nav === "jobs" && <JobsPage />}
      {nav === "content" && <ContentPage onOpenGovernance={(id) => { setGovernanceFocus(id); setNav("governance"); }} />}
      {nav === "governance" && <GovernanceConsole initialCandidateId={governanceFocus} hideAuthForm />}
      {nav === "artifacts" && <ArtifactsPage />}
      {nav === "settings" && <SettingsPage />}
    </AppShell>
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
