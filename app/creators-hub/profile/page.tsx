"use client";

import { CreatorShell } from "@/components/CreatorShell";
import { CreatorAvatar } from "@/components/ui/EditorialVisuals";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  ExternalLink,
  FileText,
  Paperclip,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  MAX_BROWSER_UPLOAD_LABEL,
  isSafeMediaDisplayUrl,
  validateClientAvatarFile,
  validateClientPortfolioFile,
} from "@/lib/upload-constants";

interface SampleItem {
  title: string;
  category: string;
  excerpt: string;
  url?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentAssetId?: string;
  mimeType?: string;
}

function sanitizeSamplePayload(sample: SampleItem): SampleItem {
  return {
    title: sample.title.trim(),
    category: sample.category.trim(),
    excerpt: sample.excerpt.trim(),
    ...(sample.url?.trim() ? { url: sample.url.trim() } : {}),
    ...(sample.attachmentUrl?.trim()
      ? { attachmentUrl: sample.attachmentUrl.trim() }
      : {}),
    ...(sample.attachmentName?.trim()
      ? { attachmentName: sample.attachmentName.trim() }
      : {}),
    ...(sample.attachmentAssetId?.trim()
      ? { attachmentAssetId: sample.attachmentAssetId.trim() }
      : {}),
    ...(sample.mimeType?.trim() ? { mimeType: sample.mimeType.trim() } : {}),
  };
}

export default function CreatorProfileEditorPage() {
  const { user, refresh, loading: authLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [writingCategories, setWritingCategories] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [autoAcceptBookings, setAutoAcceptBookings] = useState(false);
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [savedAssetIds, setSavedAssetIds] = useState<Set<string>>(new Set());
  const [pendingDeletedAssetIds, setPendingDeletedAssetIds] = useState<string[]>([]);
  const [newSample, setNewSample] = useState<SampleItem>({
    title: "",
    category: "Academic Writing",
    excerpt: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarAssetId, setAvatarAssetId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) =>
        setAllCategories((j.data?.categories ?? []).map((c: { name: string }) => c.name))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/creators-hub/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = j?.data?.creatorProfile;
        if (!p) return;
        setUsername(p.username || "");
        setDisplayName(p.displayName || "");
        setHeadline(p.headline || "");
        setBio(p.bio || "");
        setWritingCategories(p.writingCategories || []);
        setIsAvailable(Boolean(p.isAvailable));
        setAutoAcceptBookings(Boolean(p.autoAcceptBookings));
        const loadedSamples: SampleItem[] = Array.isArray(p.portfolioSamples)
          ? p.portfolioSamples
          : [];
        setSamples(loadedSamples);
        setSavedAssetIds(
          new Set(
            loadedSamples
              .map((item) => item.attachmentAssetId)
              .filter((id): id is string => Boolean(id))
          )
        );
        setAvatarUrl(p.user?.avatarUrl ?? null);
        setAvatarAssetId(j?.data?.avatarAssetId ?? null);
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
      setNotice("Creator avatar updated.");
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
      if (!res.ok) throw new Error(j.error?.message || "Could not remove avatar.");
      setAvatarUrl(null);
      setAvatarAssetId(null);
      await refresh();
      setNotice("Creator avatar removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove avatar.");
    } finally {
      setRemovingAvatar(false);
    }
  }

  async function handlePortfolioAttachmentUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const { error: validationError, purpose, inferredMimeType } =
      validateClientPortfolioFile(file);
    if (validationError || !purpose) {
      setError(validationError || "Unsupported portfolio attachment.");
      setNotice(null);
      return;
    }

    setUploadingAttachment(true);
    setError(null);
    setNotice(null);
    const previousPendingId = newSample.attachmentAssetId;

    try {
      const uploadFile =
        !file.type && inferredMimeType
          ? new File([file], file.name, { type: inferredMimeType })
          : file;

      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("purpose", purpose);
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error?.message || "Attachment upload failed.");
      }

      if (previousPendingId) {
        await fetch(`/api/media/${encodeURIComponent(previousPendingId)}`, {
          method: "DELETE",
        }).catch(() => undefined);
      }

      const asset = j.data?.asset;
      const publicUrl = j.data?.publicUrl ?? asset?.publicUrl;
      setNewSample((prev) => ({
        ...prev,
        attachmentUrl: publicUrl,
        attachmentName: asset?.fileName || file.name,
        attachmentAssetId: asset?.id,
        mimeType: asset?.mimeType || uploadFile.type,
      }));
      setNotice(`Attached "${asset?.fileName || file.name}" to draft excerpt.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Attachment upload failed."
      );
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function handleClearNewSampleAttachment() {
    const assetId = newSample.attachmentAssetId;
    setNewSample((prev) => ({
      ...prev,
      attachmentUrl: undefined,
      attachmentName: undefined,
      attachmentAssetId: undefined,
      mimeType: undefined,
    }));
    if (assetId) {
      await fetch(`/api/media/${encodeURIComponent(assetId)}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
  }

  async function handleRemoveSample(index: number) {
    const target = samples[index];
    setSamples((prev) => prev.filter((_, i) => i !== index));
    if (!target?.attachmentAssetId) return;
    if (savedAssetIds.has(target.attachmentAssetId)) {
      setPendingDeletedAssetIds((prev) => [...prev, target.attachmentAssetId!]);
    } else {
      await fetch(`/api/media/${encodeURIComponent(target.attachmentAssetId)}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const cleanedSamples = samples.map(sanitizeSamplePayload);
      const res = await fetch("/api/creators-hub/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          headline,
          bio,
          writingCategories,
          isAvailable,
          autoAcceptBookings,
          portfolioSamples: cleanedSamples,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Update failed.");

      if (pendingDeletedAssetIds.length > 0) {
        await Promise.all(
          pendingDeletedAssetIds.map((assetId) =>
            fetch(`/api/media/${encodeURIComponent(assetId)}`, {
              method: "DELETE",
            }).catch(() => undefined)
          )
        );
        setPendingDeletedAssetIds([]);
      }
      setSavedAssetIds(
        new Set(
          cleanedSamples
            .map((item) => item.attachmentAssetId)
            .filter((id): id is string => Boolean(id))
        )
      );

      await refresh();
      setNotice("Creator profile and portfolio saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Creator profile...
        </div>
      </main>
    );
  }

  if (!user?.creatorProfile) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold">
            Creator Profile Not Found
          </h1>
          <Link
            href="/creators-hub/onboarding"
            className="inline-flex px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold"
          >
            Start Creator Onboarding
          </Link>
        </div>
      </main>
    );
  }

  return (
    <CreatorShell
      title="Public Writer Portfolio"
      subtitle={`Preview live showcase at /creators/${username}`}
    >
      <div className="max-w-4xl space-y-6">
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

        <form onSubmit={handleSave} className="editorial-card p-6 sm:p-8 bg-white space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-5 border-b border-[#e6e0d4]">
            <div className="flex items-center gap-4">
              <CreatorAvatar
                name={displayName || username || "Creator"}
                username={username}
                avatarUrl={avatarUrl ?? user.avatarUrl}
                available={isAvailable}
                size="lg"
              />
              <div className="space-y-1">
                <p className="font-editorial text-xl font-semibold text-[#111827]">
                  {displayName || "Your Name"}
                </p>
                <p className="font-tech text-xs text-stone-500">@{username}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0f766e] text-white text-[11px] font-semibold cursor-pointer hover:bg-teal-800 transition-colors ${
                      uploadingAvatar || removingAvatar
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }`}
                  >
                    <Camera className="w-3 h-3" />
                    <span>{uploadingAvatar ? "Uploading..." : "Change Photo"}</span>
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-semibold hover:bg-rose-100 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      {removingAvatar ? "Removing..." : "Remove"}
                    </button>
                  )}
                  <span className="text-[11px] text-stone-500">
                    Max {MAX_BROWSER_UPLOAD_LABEL} · JPG, PNG, WEBP
                  </span>
                </div>
              </div>
            </div>
            <Link
              href={`/creators/${username}`}
              className="btn-ghost px-3.5 py-2 text-xs text-[#0f766e]"
            >
              View Live Public Profile →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Bio</label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">
              Specialty Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((cat) => {
                const active = writingCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setWritingCategories((prev) =>
                        prev.includes(cat)
                          ? prev.filter((c) => c !== cat)
                          : [...prev, cat]
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      active
                        ? "bg-[#0f766e] text-white border-[#0f766e]"
                        : "bg-[#faf7f2] text-stone-700 border-[#e6e0d4]"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-[#e6e0d4] bg-[#faf7f2] cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
              />
              <span>Accepting new customer bookings</span>
            </label>
            <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-[#e6e0d4] bg-[#faf7f2] cursor-pointer">
              <input
                type="checkbox"
                checked={autoAcceptBookings}
                onChange={(e) => setAutoAcceptBookings(e.target.checked)}
              />
              <span>Auto-accept incoming paid bookings</span>
            </label>
          </div>

          <div className="space-y-3 pt-2 border-t border-[#e6e0d4]">
            <h2 className="font-editorial text-base font-semibold">
              Portfolio Excerpts
            </h2>
            {samples.map((s, idx) => {
              const safeAttachment = isSafeMediaDisplayUrl(s.attachmentUrl)
                ? s.attachmentUrl
                : null;
              const isImageAttachment = Boolean(
                safeAttachment && s.mimeType?.startsWith("image/")
              );
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-[#e6e0d4] bg-[#faf7f2] flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-1.5">
                    <p className="font-semibold">
                      {s.title}{" "}
                      <span className="text-[#0f766e]">({s.category})</span>
                    </p>
                    <p className="text-stone-600">{s.excerpt}</p>
                    {safeAttachment && (
                      <div className="pt-1 flex items-center gap-2.5 flex-wrap">
                        {isImageAttachment && (
                          <Image
                            src={safeAttachment}
                            alt={s.attachmentName || s.title}
                            width={48}
                            height={48}
                            unoptimized={safeAttachment.startsWith("/api/")}
                            className="w-12 h-12 rounded-lg object-cover border border-[#e6e0d4]"
                          />
                        )}
                        <a
                          href={safeAttachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#e6e0d4] text-[#0f766e] font-medium hover:bg-teal-50 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[220px]">
                            {s.attachmentName || "View Sample Attachment"}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSample(idx)}
                    aria-label={`Remove ${s.title}`}
                    className="text-stone-400 hover:text-rose-700 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

            <div className="p-4 rounded-xl border border-dashed border-[#e6e0d4] space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newSample.title}
                  onChange={(e) =>
                    setNewSample((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Sample title (min 3 chars)"
                  className="rounded-lg border border-[#e6e0d4] px-3 py-2"
                />
                <input
                  type="text"
                  value={newSample.category}
                  onChange={(e) =>
                    setNewSample((p) => ({ ...p, category: e.target.value }))
                  }
                  placeholder="Category"
                  className="rounded-lg border border-[#e6e0d4] px-3 py-2"
                />
              </div>
              <textarea
                rows={2}
                value={newSample.excerpt}
                onChange={(e) =>
                  setNewSample((p) => ({ ...p, excerpt: e.target.value }))
                }
                placeholder="Short excerpt (min 10 chars)..."
                className="w-full rounded-lg border border-[#e6e0d4] px-3 py-2"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e6e0d4] bg-[#faf7f2] text-stone-700 font-medium cursor-pointer hover:bg-stone-100 ${
                      uploadingAttachment ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 text-[#0f766e]" />
                    <span>
                      {uploadingAttachment
                        ? "Uploading attachment..."
                        : newSample.attachmentUrl
                          ? "Replace Attachment"
                          : "Attach Image / PDF / DOCX"}
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.docx,image/jpeg,image/png,image/webp,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      disabled={uploadingAttachment}
                      className="hidden"
                      onChange={handlePortfolioAttachmentUpload}
                    />
                  </label>
                  {newSample.attachmentUrl && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900">
                      <Paperclip className="w-3 h-3" />
                      <span className="truncate max-w-[180px]">
                        {newSample.attachmentName || "Attached"}
                      </span>
                      <button
                        type="button"
                        onClick={handleClearNewSampleAttachment}
                        aria-label="Remove attachment"
                        className="text-teal-700 hover:text-rose-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <span className="text-[11px] text-stone-500">
                    Optional · Max {MAX_BROWSER_UPLOAD_LABEL} (JPG, PNG, WEBP, PDF, DOCX, TXT)
                  </span>
                </div>

                <button
                  type="button"
                  disabled={uploadingAttachment}
                  onClick={() => {
                    if (newSample.title.trim().length < 3) {
                      setError("Sample title must be at least 3 characters.");
                      return;
                    }
                    if (newSample.category.trim().length < 2) {
                      setError("Sample category must be at least 2 characters.");
                      return;
                    }
                    if (newSample.excerpt.trim().length < 10) {
                      setError("Sample excerpt must be at least 10 characters.");
                      return;
                    }
                    setError(null);
                    setSamples((p) => [...p, sanitizeSamplePayload(newSample)]);
                    setNewSample({
                      title: "",
                      category: "Academic Writing",
                      excerpt: "",
                    });
                  }}
                  className="btn-ghost px-3 py-1.5 font-semibold gap-1 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Sample
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || uploadingAttachment}
              className="btn-creator px-5 py-2.5 text-sm gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </CreatorShell>
  );
}
