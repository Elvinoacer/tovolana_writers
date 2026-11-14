"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";

export default function CustomerSettingsPage() {
  const { user, refresh, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredLocale, setPreferredLocale] = useState("en-KE");
  const [prefs, setPrefs] = useState({
    email: true,
    push: true,
    inApp: true,
    sms: false,
  });
  const [authAccounts, setAuthAccounts] = useState<
    Array<{ provider: string; createdAt: string }>
  >([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const d = j.data;
        if (d?.user) {
          setName(d.user.name || "");
          setPhone(d.user.phone || "");
        }
        if (d?.customerProfile) {
          setPreferredLocale(d.customerProfile.preferredLocale || "en-KE");
          if (d.customerProfile.notificationPrefs) {
            setPrefs((prev) => ({
              ...prev,
              ...d.customerProfile.notificationPrefs,
            }));
          }
        }
        setAuthAccounts(d?.authAccounts ?? []);
      })
      .catch(() => {});
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          preferredLocale,
          notificationPrefs: prefs,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Update failed.");
      await refresh();
      setNotice("Profile & notification preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          newPassword,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Password update failed.");
      setCurrentPassword("");
      setNewPassword("");
      setNotice("Account password updated securely.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password update failed.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading settings...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold">
            Sign in to update Account Settings
          </h1>
          <Link
            href="/auth?next=/dashboard/settings"
            className="inline-flex px-5 py-2.5 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-editorial font-semibold">
          Account & Security Settings
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Manage your identity details, verification status, connected Google
          sign-in, and notification preferences.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <form
        onSubmit={handleSaveProfile}
        className="editorial-card p-6 space-y-5"
      >
        <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
          <UserCog className="w-5 h-5 text-[#1e3a8a]" />
          Personal Details & Localization
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Email Address ({user.emailVerified ? "Verified" : "Unverified"})
            </label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full rounded-lg border border-[#e6e0d4] bg-stone-100 px-3.5 py-2 text-sm text-stone-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Phone Number ({user.phoneVerified ? "OTP Verified" : "Unverified"})
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254712345678"
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm font-tech"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Preferred Locale
            </label>
            <select
              value={preferredLocale}
              onChange={(e) => setPreferredLocale(e.target.value)}
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
            >
              <option value="en-KE">English (Kenya · KES)</option>
              <option value="en-US">English (International)</option>
              <option value="sw-KE">Kiswahili (Kenya)</option>
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-[#e6e0d4] space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#1e3a8a]" />
            Notification Channels
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {(["email", "push", "inApp", "sms"] as const).map((k) => (
              <label
                key={k}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-[#e6e0d4] bg-[#faf7f2] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={prefs[k]}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, [k]: e.target.checked }))
                  }
                />
                <span className="uppercase font-medium">{k}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Link
            href="/auth/verify"
            className="text-xs font-medium text-[#1e3a8a] hover:underline"
          >
            Verify Email or Phone OTP →
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#172554] disabled:opacity-50"
          >
            Save Preferences
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="editorial-card p-6 space-y-3">
          <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0f766e]" />
            Connected Auth Providers
          </h2>
          <div className="space-y-2 text-xs">
            {authAccounts.length === 0 ? (
              <p className="text-stone-500">Email & Password credentials</p>
            ) : (
              authAccounts.map((a) => (
                <div
                  key={a.provider}
                  className="px-3 py-2 rounded-lg bg-stone-50 border border-[#e6e0d4] flex items-center justify-between"
                >
                  <span className="font-semibold uppercase">{a.provider}</span>
                  <span className="text-emerald-700 font-medium">Linked</span>
                </div>
              ))
            )}
          </div>
        </div>

        <form
          onSubmit={handlePasswordUpdate}
          className="editorial-card p-6 space-y-3"
        >
          <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#1e3a8a]" />
            Change Password
          </h2>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password (blank if Google-only account)"
            className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
          />
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-[#e6e0d4] bg-white text-xs font-semibold hover:bg-stone-50"
          >
            Update Password
          </button>
        </form>
      </div>
    </main>
  );
}
