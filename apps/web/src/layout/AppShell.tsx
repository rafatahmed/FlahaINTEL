/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaINTEL Application Shell
 * Introduction: Branded sidebar shell for Phase 3L operational application.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-30
 */
import {
  Article,
  CloudUpload,
  Dashboard,
  Gavel,
  Inventory2,
  MenuBook,
  Settings,
  Source,
  Storefront,
  Work,
} from "@mui/icons-material";
import {
  AppBar,
  Box,
  Chip,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useAuth } from "../auth";

const DRAWER_WIDTH = 240;

export type NavKey =
  | "dashboard"
  | "markets"
  | "knowledge"
  | "sources"
  | "submit"
  | "jobs"
  | "content"
  | "governance"
  | "artifacts"
  | "settings";

const NAV: Array<{ key: NavKey; label: string; icon: ReactNode }> = [
  { key: "dashboard", label: "Dashboard", icon: <Dashboard /> },
  { key: "markets", label: "Markets", icon: <Storefront /> },
  { key: "knowledge", label: "Knowledge", icon: <MenuBook /> },
  { key: "sources", label: "Sources", icon: <Source /> },
  { key: "submit", label: "Submit", icon: <CloudUpload /> },
  { key: "jobs", label: "Jobs", icon: <Work /> },
  { key: "content", label: "Content", icon: <Article /> },
  { key: "governance", label: "Governance", icon: <Gavel /> },
  { key: "artifacts", label: "Artifacts", icon: <Inventory2 /> },
  { key: "settings", label: "Settings", icon: <Settings /> },
];

export function AppShell(props: {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  children: ReactNode;
  readiness?: string;
}) {
  const { auth } = useAuth();
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2, minHeight: { xs: 58, sm: 68 } }}>
          <Box
            component="img"
            src="/brand/flahaintel/flahaintel-logo-reverse.png"
            alt="FlahaINTEL"
            sx={{ height: { xs: 36, sm: 44 }, width: "auto" }}
          />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>Intelligence for a Resilient World</Typography>
          </Box>
          {props.readiness && <Chip size="small" color="default" label={`System ${props.readiness}`} sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff" }} />}
          {auth && (
            <Typography variant="body2" sx={{ color: "common.white" }}>
              {auth.displayName || auth.userId.slice(0, 8)} · {auth.role || "member"}
            </Typography>
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box", borderRightColor: "divider" },
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, py: 2 }}>
          <Typography variant="overline" color="text.secondary">Flaha Agri Tech</Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>FlahaINTEL</Typography>
        </Box>
        <Divider />
        <List dense>
          {NAV.map((item) => (
            <ListItemButton
              key={item.key}
              selected={props.active === item.key}
              onClick={() => props.onNavigate(item.key)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: `calc(100% - ${DRAWER_WIDTH}px)` }}>
        <Toolbar />
        {props.children}
      </Box>
    </Box>
  );
}
