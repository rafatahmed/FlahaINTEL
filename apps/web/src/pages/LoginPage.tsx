/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Internal Login
 * Introduction: Establishes authenticated session from verified tenant membership identities.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-19
 */
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function LoginPage() {
  const { setAuth } = useAuth();
  const [account, setAccount] = useState(
    localStorage.getItem("flaha.login.account")
      ?? localStorage.getItem("flaha.governance.userId")
      ?? "",
  );
  const [tenant, setTenant] = useState(
    localStorage.getItem("flaha.login.tenant")
      ?? localStorage.getItem("flaha.governance.tenantId")
      ?? "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    setError("");
    try {
      const left = account.trim();
      const right = tenant.trim();
      const identity = UUID.test(left) && UUID.test(right)
        ? { userId: left, tenantId: right }
        : { email: left, tenantCode: right };
      const session = await api.createSession(identity);
      setAuth({
        userId: session.user.id,
        tenantId: session.tenant.id,
        displayName: session.user.displayName,
        email: session.user.email,
        tenantCode: session.tenant.code,
        role: session.role,
        token: session.token,
        csrf: session.csrf,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed.";
      if (/networkerror|failed to fetch|load failed|network request failed/i.test(msg)) {
        setError(
          `${msg} — API not reachable. Start apps/api (default http://localhost:3003) and check VITE_API_URL matches.`,
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <Card sx={{ width: "100%", maxWidth: 480 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">FlahaINTEL internal sign-in</Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in with your membership email and tenant code (for example admin@flaha.local and flaha-local),
              or with user and tenant UUIDs. Production uses a signed session — development identity headers are not accepted.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email or user ID"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              fullWidth
              autoComplete="username"
            />
            <TextField
              label="Tenant code or tenant ID"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              fullWidth
            />
            <Button variant="contained" disabled={busy || !account || !tenant} onClick={() => void login()}>
              Continue
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
