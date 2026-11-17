"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface ClientUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: ("CUSTOMER" | "CREATOR" | "ADMIN")[];
  adminScopes: ("SUPER_ADMIN" | "MODERATION_ADMIN" | "FINANCE_ADMIN" | "SUPPORT_ADMIN")[];
  status: string;
  membershipTier: "FREE" | "PRO";
  proExpiresAt: string | null;
  emailVerified: string | null;
  phoneVerified: string | null;
  creatorProfile?: {
    id: string;
    username: string;
    displayName: string;
    applicationStatus: string;
    assessmentScore: number | null;
    connectsBalance?: number;
    creatorTier?: string;
    profileCompletenessScore?: number;
  } | null;
}

interface AuthContextValue {
  user: ClientUser | null;
  unreadNotifications: number;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  unreadNotifications: 0,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setUser(json.data?.user ?? null);
        setUnreadNotifications(json.data?.unreadNotifications ?? 0);
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUnreadNotifications(0);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active || !json) return;
        setUser(json.data?.user ?? null);
        setUnreadNotifications(json.data?.unreadNotifications ?? 0);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, unreadNotifications, loading, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
