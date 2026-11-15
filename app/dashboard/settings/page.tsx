"use client";

import { CustomerShell } from "@/components/CustomerShell";
import { CreatorAvatar } from "@/components/ui/EditorialVisuals";

import React, { useEffect, useState } from "react";
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarAssetId, setAvatarAssetId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
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
          setAvatarUrl(d.user.avatarUrl ?? null);
          setAvatarAssetId(d.user.avatarAssetId ?? null);
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
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Avatar upload failed.");
      setAvatarUrl(j.data?.publicUrl ?? j.data?.asset?.publicUrl ?? null);
      setAvatarAssetId(j.data?.asset?.id ?? null);
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
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Could not remove photo.");
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
    <CustomerShell
      title="Account & Security"
      subtitle="Identity verification, connected providers, and alert channels."
    >
      {error && (
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Visual Verification Badges Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="editorial-card p-4 bg-white flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-tech uppercase text-stone-500">Email Identity</p>
            <p className="text-sm font-semibold text-[#111827] mt-0.5">{user.email}</p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              user.emailVerified
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}
          >
            {user.emailVerified ? "Verified" : "Unverified"}
          </span>
        </div>

        <div className="editorial-card p-4 bg-white flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-tech uppercase text-stone-500">M-Pesa / SMS OTP</p>
            <p className="text-sm font-tech font-semibold text-[#111827] mt-0.5">
              {phone || "No number saved"}
            </p>
          </div>
          <Link
            href="/auth/verify"
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              user.phoneVerified
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-blue-50 text-[#1e3a8a] border border-blue-200 hover:bg-blue-100"
            }`}
          >
            {user.phoneVerified ? "OTP Verified" : "Verify OTP →"}
          </Link>
        </div>
      </div>

      {/* Profile Avatar Card */}
      <div className="editorial-card p-6 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <CreatorAvatar
            name={name || user.name}
            avatarUrl={avatarUrl ?? user.avatarUrl}
            size="lg"
          />
          <div className="space-y-1">
            <h2 className="font-editorial text-lg font-semibold flex items-center gap-2 text-[#111827]">
              <Camera className="w-4 h-4 text-[#1e3a8a]" />
              Profile Photo
            </h2>
            <p className="text-xs text-stone-500">
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
          {(avatarUrl ?? user.avatarUrl) && (
            <button
              type="button"
              disabled={uploadingAvatar || removingAvatar}
              onClick={handleRemoveAvatar}
              className="btn-ghost px-3.5 py-2 text-xs text-rose-700 border-rose-200 hover:bg-rose-50 gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {removingAvatar ? "Removing..." : "Remove"}
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="editorial-card p-6 bg-white space-y-5"
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
              className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
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
              className="w-full rounded-xl border border-[#e6e0d4] bg-[#faf7f2] px-3.5 py-2.5 text-sm text-stone-600"
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
              className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Preferred Locale
            </label>
            <select
              value={preferredLocale}
              onChange={(e) => setPreferredLocale(e.target.value)}
              className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
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
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  prefs[k]
                    ? "border-[#1e3a8a] bg-blue-50/40 text-[#111827]"
                    : "border-[#e6e0d4] bg-[#faf7f2] text-stone-600"
                }`}
              >
                <span className="uppercase font-tech font-semibold">{k}</span>
                <input
                  type="checkbox"
                  checked={prefs[k]}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, [k]: e.target.checked }))
                  }
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
            Save Preferences
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="editorial-card p-6 bg-white space-y-3">
          <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0f766e]" />
            Auth Providers
          </h2>
          <div className="space-y-2 text-xs">
            {authAccounts.length === 0 ? (
              <p className="text-stone-500">Email &amp; Password credentials</p>
            ) : (
              authAccounts.map((a) => (
                <div
                  key={a.provider}
                  className="px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] flex items-center justify-between"
                >
                  <span className="font-tech font-semibold uppercase">{a.provider}</span>
                  <span className="text-emerald-700 font-semibold">Linked</span>
                </div>
              ))
            )}
          </div>
        </div>

        <form
          onSubmit={handlePasswordUpdate}
          className="editorial-card p-6 bg-white space-y-3"
        >
          <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#1e3a8a]" />
            Update Password
          </h2>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password (blank if Google-only)"
            className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-xs"
          />
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-xs"
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-ghost px-4 py-2 text-xs"
          >
            Update Password
          </button>
        </form>
      </div>
    </CustomerShell>
  );
}
