"use client";

import { CustomerShell } from "@/components/CustomerShell";
import { RadarAvatar } from "@/components/ui/AuroraPrimitives";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Camera,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  MAX_BROWSER_UPLOAD_LABEL,
  validateClientAvatarFile,
} from "@/lib/upload-constants";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(
    undefined
  );
  const [avatarAssetId, setAvatarAssetId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      loadedUserIdRef.current = null;
      return;
    }
    if (loadedUserIdRef.current === userId) return;
    let active = true;
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json().catch(() => null) : null))
      .then((j) => {
        if (!active) return;
        const d = j?.data;
        if (!d) return;
        loadedUserIdRef.current = userId;
        if (d.user) {
          setName(d.user.name || "");
          setPhone(d.user.phone || "");
          setAvatarUrl(d.user.avatarUrl ?? null);
          setAvatarAssetId(d.user.avatarAssetId ?? null);
        }
        if (d.customerProfile) {
          setPreferredLocale(d.customerProfile.preferredLocale || "en-KE");
          if (d.customerProfile.notificationPrefs) {
            setPrefs((prev) => ({
              ...prev,
              ...d.customerProfile.notificationPrefs,
            }));
          }
        }
        setAuthAccounts(d.authAccounts ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validationError = validateClientAvatarFile(file);
    if (validationError) {
      setError(validationError);
      setNotice(null);
      return;
    }

    setUploadingAvatar(true);
    setError(null);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "USER_AVATAR");
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Avatar upload failed (${res.status}).`
        );
      }
      setAvatarUrl(j?.data?.publicUrl ?? j?.data?.asset?.publicUrl ?? null);
      setAvatarAssetId(j?.data?.asset?.id ?? null);
      await refresh();
      setNotice("Profile photo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    setRemovingAvatar(true);
    setError(null);
    setNotice(null);
    try {
      const res = avatarAssetId
        ? await fetch(`/api/media/${encodeURIComponent(avatarAssetId)}`, {
            method: "DELETE",
          })
        : await fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clearAvatar: true }),
          });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Could not remove photo (${res.status}).`
        );
      }
      setAvatarUrl(null);
      setAvatarAssetId(null);
      await refresh();
      setNotice("Profile photo removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo.");
    } finally {
      setRemovingAvatar(false);
    }
  }

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
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || `Update failed (${res.status}).`);
      }
      await refresh();
      setNotice("Your details and alert settings were saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
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
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Password change failed (${res.status}).`
        );
      }
      setCurrentPassword("");
      setNewPassword("");
      setNotice("Your password has been changed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not change password."
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading your settings...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Sign in to change your settings
          </h1>
          <Link href="/auth?next=/dashboard/settings" className="btn-primary px-5 py-2.5 text-sm">
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  const effectiveAvatarUrl =
    avatarUrl !== undefined ? avatarUrl : user.avatarUrl;

  return (
    <CustomerShell
      title="Account & Alerts"
      subtitle="Update your details, phone number, password, and how we reach you."
    >
      {error && (
        <div className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
          <span>{notice}</span>
        </div>
      )}

      {/* Confirmation Status Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="editorial-card p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-tech uppercase text-slate-400">Email</p>
            <p className="text-sm font-semibold text-white mt-0.5">{user.email}</p>
          </div>
          <Link
            href="/auth/verify"
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
              user.emailVerified
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/35"
                : "bg-amber-500/15 text-amber-300 border-amber-400/35 hover:bg-amber-500/25"
            }`}
          >
            {user.emailVerified ? "Confirmed" : "Confirm email →"}
          </Link>
        </div>

        <div className="editorial-card p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-tech uppercase text-slate-400">M-Pesa Phone</p>
            <p className="text-sm font-tech font-semibold text-white mt-0.5">
              {phone || "No number saved"}
            </p>
          </div>
          <Link
            href="/auth/verify"
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              user.phoneVerified
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/35"
                : "bg-sky-500/15 text-sky-300 border-sky-400/35 hover:bg-sky-500/25"
            }`}
          >
            {user.phoneVerified ? "Confirmed" : "Confirm number →"}
          </Link>
        </div>
      </div>

      {/* Profile Photo Card */}
      <div className="editorial-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <RadarAvatar
            name={name || user.name}
            avatarUrl={effectiveAvatarUrl}
            theme="sky"
            size="lg"
          />
          <div className="space-y-1">
            <h2 className="font-editorial text-lg font-semibold flex items-center gap-2 text-white">
              <Camera className="w-4 h-4 text-sky-300" />
              Your Photo
            </h2>
            <p className="text-xs text-slate-400">
              Max {MAX_BROWSER_UPLOAD_LABEL} · JPG, PNG, or WEBP.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label
            className={`btn-primary px-4 py-2 text-xs gap-1.5 cursor-pointer ${
              uploadingAvatar || removingAvatar ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploadingAvatar ? "Uploading..." : "Upload Photo"}</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              disabled={uploadingAvatar || removingAvatar}
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </label>
          {effectiveAvatarUrl && (
            <button
              type="button"
              disabled={uploadingAvatar || removingAvatar}
              onClick={handleRemoveAvatar}
              className="btn-ghost px-3.5 py-2 text-xs text-rose-300 border-rose-400/35 hover:bg-rose-500/15 gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {removingAvatar ? "Removing..." : "Remove"}
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="editorial-card p-6 space-y-5"
      >
        <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
          <UserCog className="w-5 h-5 text-sky-300" />
          Personal Details &amp; Language
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hud-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Email Address ({user.emailVerified ? "Confirmed" : "Not confirmed"})
            </label>
            <input
              type="email"
              disabled
              value={user.email}
              className="hud-input w-full px-3.5 py-2.5 text-sm opacity-60 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Phone Number ({user.phoneVerified ? "Confirmed" : "Not confirmed"})
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254712345678"
              className="hud-input w-full px-3.5 py-2.5 text-sm font-tech"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Language &amp; Currency
            </label>
            <select
              value={preferredLocale}
              onChange={(e) => setPreferredLocale(e.target.value)}
              className="hud-input w-full px-3.5 py-2.5 text-sm"
            >
              <option value="en-KE">English (Kenya · KES)</option>
              <option value="en-US">English (International)</option>
              <option value="sw-KE">Kiswahili (Kenya)</option>
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-white/[0.1] space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-sky-300" />
            Where Should We Send Updates?
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {(
              [
                { key: "email", label: "Email" },
                { key: "push", label: "Phone push" },
                { key: "inApp", label: "On website" },
                { key: "sms", label: "Text (SMS)" },
              ] as const
            ).map((item) => (
              <label
                key={item.key}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  prefs[item.key]
                    ? "border-cyan-400/55 bg-cyan-500/[0.12] text-white"
                    : "border-white/[0.11] bg-white/[0.04] text-slate-400"
                }`}
              >
                <span className="font-semibold">{item.label}</span>
                <input
                  type="checkbox"
                  checked={prefs[item.key]}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, [item.key]: e.target.checked }))
                  }
                  className="accent-cyan-400"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="editorial-card p-6 space-y-3">
          <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-300" />
            How You Sign In
          </h2>
          <div className="space-y-2 text-xs">
            {authAccounts.length === 0 ? (
              <p className="text-slate-400">Email and password</p>
            ) : (
              authAccounts.map((a) => (
                <div
                  key={a.provider}
                  className="px-3.5 py-2.5 rounded-xl bg-white/[0.045] border border-white/[0.11] flex items-center justify-between"
                >
                  <span className="font-tech font-semibold uppercase text-white">
                    {a.provider}
                  </span>
                  <span className="text-emerald-300 font-semibold">Connected</span>
                </div>
              ))
            )}
          </div>
        </div>

        <form
          onSubmit={handlePasswordUpdate}
          className="editorial-card p-6 space-y-3"
        >
          <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-sky-300" />
            Change Password
          </h2>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password (leave blank if using Google)"
            className="hud-input w-full px-3.5 py-2 text-xs"
          />
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (at least 8 characters)"
            className="hud-input w-full px-3.5 py-2 text-xs"
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-ghost px-4 py-2 text-xs"
          >
            Change Password
          </button>
        </form>
      </div>
    </CustomerShell>
  );
}
