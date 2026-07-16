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
 * Last modified: 2026-07-16
 */
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export function LoginPage() {
  const { setAuth } = useAuth();
  const [userId, setUserId] = useState(localStorage.getItem("flaha.governance.userId") ?? "");
  const [tenantId, setTenantId] = useState(localStorage.getItem("flaha.governance.tenantId") ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    setError("");
    try {
      const session = await api.createSession(userId.trim(), tenantId.trim());
      setAuth({
        userId: session.user.id,
        tenantId: session.tenant.id,
        displayName: session.user.displayName,
        email: session.user.email,
        role: session.role,
        token: session.token,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
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
              Uses verified membership identity. No external IdP in Phase 3L. Development headers remain available for tests.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} fullWidth />
            <TextField label="Tenant ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} fullWidth />
            <Button variant="contained" disabled={busy || !userId || !tenantId} onClick={() => void login()}>
              Continue
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
