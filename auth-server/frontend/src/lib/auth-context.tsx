"use client";

import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from "react";
import { googleSignIn, firebaseSignOut } from "@/lib/firebase";
import { createApi } from "@/lib/api";
import { decodeJwt } from "@/lib/utils";

type AuthState = {
  token: string | null;
  email: string | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = "maru_cms_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback((t: string | null) => {
    setToken(t);
    if (t) {
      const payload = decodeJwt(t);
      setEmail((payload.email as string) ?? null);
      setIsAdmin(Boolean(payload.isAdmin));
    } else {
      setEmail(null);
      setIsAdmin(false);
    }
  }, []);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const payload = decodeJwt(stored);
      const exp = (payload.exp as number) ?? 0;
      if (exp * 1000 > Date.now()) {
        applyToken(stored);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, [applyToken]);

  const signIn = useCallback(async () => {
    const idToken = await googleSignIn();
    const api = createApi("");
    const { accessToken } = await api.auth.exchangeFirebaseToken(idToken);
    localStorage.setItem(STORAGE_KEY, accessToken);
    applyToken(accessToken);
  }, [applyToken]);

  const signOut = useCallback(async () => {
    await firebaseSignOut();
    localStorage.removeItem(STORAGE_KEY);
    applyToken(null);
  }, [applyToken]);

  return (
    <AuthContext.Provider value={{ token, email, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
