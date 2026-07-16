"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setStoredToken, getStoredToken } from "./api";
import type { User } from "./types";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (payload: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

const USER_KEY = "workpulse_user";

function loadCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: User | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = loadCachedUser();
    const token = getStoredToken();
    if (cached && token) setUser(cached);
    setLoading(false);
  }, []);

  const refreshUser = useCallback((next: User | null) => {
    setUser(next);
    cacheUser(next);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api<{
      user: User;
      token?: string;
      message?: string;
    }>("/api/auth/login", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
    if (res.token) setStoredToken(res.token);
    refreshUser(res.user);
    return res.user;
  }, [refreshUser]);

  const register = useCallback(async (payload: Record<string, unknown>) => {
    await api("/api/auth/register", {
      method: "POST",
      body: payload,
      auth: false,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors on logout
    }
    setStoredToken(null);
    refreshUser(null);
  }, [refreshUser]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
