/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaINTEL Application Shell
 * Introduction: Branded sidebar — whole intelligence navigation (eyes, muscles, brain, feeds).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-19
 */
import {
  Article,
  CloudUpload,
  Dashboard,
  FactCheck,
  Feed,
  Gavel,
  Inventory2,
  Logout,
  MenuBook,
  Settings,
  Source,
  Storefront,
  Work,
} from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
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

const DRAWER_WIDTH = 248;

export type NavKey =
  | "dashboard"
  | "review"
  | "markets"
  | "knowledge"
  | "sources"
  | "articles"
  | "submit"
  | "jobs"
  | "content"
  | "governance"
  | "artifacts"
  | "settings";

type NavItem = { key: NavKey; label: string; icon: ReactNode; group: string };

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: <Dashboard />, group: "Command" },
  { key: "review", label: "Review inbox", icon: <FactCheck />, group: "Command" },
  { key: "markets", label: "Markets", icon: <Storefront />, group: "Eyes" },
  { key: "knowledge", label: "Knowledge", icon: <MenuBook />, group: "Feeds" },
  { key: "sources", label: "Sources", icon: <Source />, group: "Eyes" },
  { key: "articles", label: "Articles", icon: <Feed />, group: "Eyes" },
  { key: "submit", label: "Submit", icon: <CloudUpload />, group: "Eyes" },
  { key: "jobs", label: "Jobs", icon: <Work />, group: "Muscles" },
  { key: "content", label: "Content", icon: <Article />, group: "Structure" },
  { key: "governance", label: "Governance", icon: <Gavel />, group: "Brain" },
  { key: "artifacts", label: "Artifacts", icon: <Inventory2 />, group: "Backbone" },
  { key: "settings", label: "Settings", icon: <Settings />, group: "Ops" },
];

export function AppShell(props: {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  children: ReactNode;
  readiness?: string;
}) {
  const { auth, signOut } = useAuth();
  let lastGroup = "";
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
            <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
              Intelligence for a Resilient World
            </Typography>
          </Box>
          {props.readiness && (
            <Chip
              size="small"
              color="default"
              label={`System ${props.readiness}`}
              sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff" }}
            />
          )}
          {auth && (
            <>
              <Typography variant="body2" sx={{ color: "common.white", display: { xs: "none", md: "block" } }}>
                {auth.displayName || auth.userId.slice(0, 8)} · {auth.role || "member"}
              </Typography>
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                onClick={() => void signOut()}
                sx={{ borderColor: "rgba(255,255,255,0.5)", flexShrink: 0 }}
              >
                Sign out
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          [`& .MuiDrawer-paper`]: {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            borderRightColor: "divider",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, py: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Flaha Agri Tech
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            FlahaINTEL
          </Typography>
          <Typography variant="caption" color="text.secondary">
            One intelligence · Eyes · Muscles · Brain
          </Typography>
        </Box>
        <Divider />
        <List dense sx={{ flex: 1 }}>
          {NAV.map((item) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <Box key={item.key}>
                {showGroup && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ px: 2, pt: 1.25, pb: 0.25, display: "block", fontWeight: 700 }}
                  >
                    {item.group}
                  </Typography>
                )}
                <ListItemButton
                  selected={props.active === item.key}
                  onClick={() => props.onNavigate(item.key)}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </Box>
            );
          })}
        </List>
        {auth && (
          <>
            <Divider />
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {auth.displayName || auth.email || "Signed in"}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {auth.email || auth.userId} · {auth.role}
              </Typography>
            </Box>
            <List dense>
              <ListItemButton onClick={() => void signOut()}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Logout />
                </ListItemIcon>
                <ListItemText primary="Sign out" />
              </ListItemButton>
            </List>
          </>
        )}
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: `calc(100% - ${DRAWER_WIDTH}px)` }}
      >
        <Toolbar />
        {props.children}
      </Box>
    </Box>
  );
}
