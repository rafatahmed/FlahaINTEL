/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Web Authentication Context
 * Introduction: Holds tenant/user session for Phase 3L product shell.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setGovernanceAuth, setProductAuth } from "./api";

export type AuthState = {
  userId: string;
  tenantId: string;
  displayName?: string;
  email?: string;
  role?: string;
  token?: string;
};

type AuthContextValue = {
  auth: AuthState | null;
  setAuth: (next: AuthState | null) => void;
  ready: boolean;
};

const AuthContext = createContext<AuthContextValue>({ auth: null, setAuth: () => undefined, ready: false });

const STORAGE_KEY = "flaha.product.auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAuthState(JSON.parse(raw) as AuthState);
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const setAuth = (next: AuthState | null) => {
    setAuthState(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    if (auth) {
      setProductAuth({ userId: auth.userId, tenantId: auth.tenantId, token: auth.token });
      setGovernanceAuth({ userId: auth.userId, tenantId: auth.tenantId });
    } else {
      setProductAuth(null);
      setGovernanceAuth(null);
    }
  }, [auth]);

  const value = useMemo(() => ({ auth, setAuth, ready }), [auth, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
