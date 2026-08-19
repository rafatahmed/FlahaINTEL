/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Web Authentication Context
 * Introduction: Holds tenant/user session for the product shell and validates it against the API.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-19
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAuthFailureHandler, setGovernanceAuth, setProductAuth } from "./api";

export type AuthState = {
  userId: string;
  tenantId: string;
  displayName?: string;
  email?: string;
  role?: string;
  token?: string;
  csrf?: string;
};

type AuthContextValue = {
  auth: AuthState | null;
  setAuth: (next: AuthState | null) => void;
  signOut: () => Promise<void>;
  ready: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  auth: null,
  setAuth: () => undefined,
  signOut: async () => undefined,
  ready: false,
});

const STORAGE_KEY = "flaha.product.auth";
const HINT_USER_KEY = "flaha.governance.userId";
const HINT_TENANT_KEY = "flaha.governance.tenantId";

function persistLoginHints(userId?: string, tenantId?: string) {
  if (userId) localStorage.setItem(HINT_USER_KEY, userId);
  if (tenantId) localStorage.setItem(HINT_TENANT_KEY, tenantId);
}

function applyClientAuth(next: AuthState | null) {
  if (next) {
    setProductAuth({ userId: next.userId, tenantId: next.tenantId, token: next.token, csrf: next.csrf });
    setGovernanceAuth({ userId: next.userId, tenantId: next.tenantId });
    return;
  }
  setProductAuth(null);
  setGovernanceAuth(null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [ready, setReady] = useState(false);

  const setAuth = useCallback((next: AuthState | null) => {
    setAuthState(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      persistLoginHints(next.userId, next.tenantId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    applyClientAuth(next);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // still drop local session
    }
    setAuth(null);
  }, [setAuth]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as AuthState;
          applyClientAuth(parsed);
          try {
            const me = await api.me();
            if (cancelled) return;
            const next: AuthState = {
              ...parsed,
              userId: me.userId,
              tenantId: me.tenantId,
              displayName: me.displayName,
              email: me.email,
              role: me.role,
            };
            setAuthState(next);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            persistLoginHints(next.userId, next.tenantId);
            applyClientAuth(next);
          } catch {
            persistLoginHints(parsed.userId, parsed.tenantId);
            localStorage.removeItem(STORAGE_KEY);
            applyClientAuth(null);
            if (!cancelled) setAuthState(null);
          }
        }
      } catch {
        // ignore corrupt storage
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => {
      persistLoginHints(auth?.userId, auth?.tenantId);
      localStorage.removeItem(STORAGE_KEY);
      applyClientAuth(null);
      setAuthState(null);
    });
    return () => setAuthFailureHandler(null);
  }, [auth]);

  const value = useMemo(() => ({ auth, setAuth, signOut, ready }), [auth, setAuth, signOut, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
