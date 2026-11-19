"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, UNAUTHORIZED_EVENT, api } from "./api";
import type { User } from "./types";

type AuthContextValue = {
  /** The signed-in user, or null when signed out. */
  user: User | null;
  /** True until the first check with the server has finished. */
  loading: boolean;
  /** Set when the server could not be reached, so we do not wrongly show "sign in". */
  serverError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.auth
      .me()
      .then((current) => {
        if (!cancelled) {
          setUser(current);
          setServerError(null);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(null); // simply not signed in
          setServerError(null);
        } else {
          setServerError(error instanceof Error ? error.message : "Cannot reach the server.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Any request that learns the session has ended signs the user out here.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login(email, password);
    setUser(result.user);
    setServerError(null);
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const result = await api.auth.register(fullName, email, password);
    setUser(result.user);
    setServerError(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({ user, loading, serverError, login, register, logout, retry, setUser }),
    [user, loading, serverError, login, register, logout, retry]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
