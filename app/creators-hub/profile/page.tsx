"use client";

import { CreatorShell } from "@/components/CreatorShell";
import { HudCard, RadarAvatar } from "@/components/ui/AuroraPrimitives";

import React, { useEffect, useRef, useState } from "react";
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
  isAllowedNextImageSrc,
  isSafeMediaDisplayUrl,
  isSafeRasterImageMimeOrExt,
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
  const [taglineBadge, setTaglineBadge] = useState("");
  const [educationCredentials, setEducationCredentials] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [yearsExperience, setYearsExperience] = useState<number>(0);
  const [responseTimeMinutes, setResponseTimeMinutes] = useState<number>(30);
  const [standoutReport, setStandoutReport] = useState<{
    score: number;
    tierRecommendation: string;
    breakdown: Array<{
      key: string;
      label: string;
      completed: boolean;
      points: number;
      impactHint: string;
    }>;
  } | null>(null);
  const [writingCategories, setWritingCategories] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [autoAcceptBookings, setAutoAcceptBookings] = useState(false);
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [savedAssetIds, setSavedAssetIds] = useState<Set<string>>(new Set());
  const [pendingDeletedAssetIds, setPendingDeletedAssetIds] = useState<
    string[]
  >([]);
  const [newSample, setNewSample] = useState<SampleItem>({
    title: "",
    category: "Academic Writing",
    excerpt: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(
    undefined
  );
  const [avatarAssetId, setAvatarAssetId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/categories", { cache: "no-store" })
      .then((r) => (r.ok ? r.json().catch(() => null) : null))
      .then((j) =>
        setAllCategories(
          (j?.data?.categories ?? []).map((c: { name: string }) => c.name)
        )
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      loadedUserIdRef.current = null;
      return;
    }
    if (loadedUserIdRef.current === userId) return;
    let active = true;
    fetch("/api/creators-hub/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json().catch(() => null) : null))
      .then((j) => {
        if (!active) return;
        const p = j?.data?.creatorProfile;
        if (!p) return;
        loadedUserIdRef.current = userId;
        setUsername(p.username || "");
        setDisplayName(p.displayName || "");
        setHeadline(p.headline || "");
        setBio(p.bio || "");
        setTaglineBadge(p.taglineBadge || "");
        setEducationCredentials(p.educationCredentials || "");
        setIntroVideoUrl(p.introVideoUrl || "");
        setYearsExperience(
          typeof p.yearsExperience === "number" ? p.yearsExperience : 0
        );
        setResponseTimeMinutes(
          typeof p.responseTimeMinutes === "number"
            ? p.responseTimeMinutes
            : 30
        );
        if (j?.data?.standoutReport) {
          setStandoutReport(j.data.standoutReport);
        }
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
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Could not remove avatar (${res.status}).`
        );
      }
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

    const {
      error: validationError,
      purpose,
      inferredMimeType,
    } = validateClientPortfolioFile(file);
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
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Attachment upload failed (${res.status}).`
        );
      }

      if (previousPendingId) {
        await fetch(`/api/media/${encodeURIComponent(previousPendingId)}`, {
          method: "DELETE",
        }).catch(() => undefined);
      }

      const asset = j?.data?.asset;
      const publicUrl = j?.data?.publicUrl ?? asset?.publicUrl;
      setNewSample((prev) => ({
        ...prev,
        attachmentUrl:
          typeof publicUrl === "string" ? publicUrl.trim() : undefined,
        attachmentName: asset?.fileName || file.name,
        attachmentAssetId: asset?.id,
        mimeType: asset?.mimeType || uploadFile.type,
      }));
      setNotice(
        `Attached "${asset?.fileName || file.name}" to draft excerpt.`
      );
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
      await fetch(
        `/api/media/${encodeURIComponent(target.attachmentAssetId)}`,
        {
          method: "DELETE",
        }
      ).catch(() => undefined);
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
          taglineBadge: taglineBadge.trim() || null,
          educationCredentials: educationCredentials.trim() || null,
          introVideoUrl: introVideoUrl.trim() || null,
          yearsExperience: Number.isFinite(Number(yearsExperience))
            ? Math.max(0, Math.round(Number(yearsExperience)))
            : 0,
          responseTimeMinutes: Number.isFinite(Number(responseTimeMinutes))
            ? Math.max(5, Math.round(Number(responseTimeMinutes)))
            : 30,
          writingCategories,
          isAvailable,
          autoAcceptBookings,
          portfolioSamples: cleanedSamples,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || `Update failed (${res.status}).`);
      }
      if (j?.data?.standoutReport) {
        setStandoutReport(j.data.standoutReport);
      }

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
      setNotice("Your writer profile and writing samples were saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading your writer profile...
        </div>
      </main>
    );
  }

  if (!user?.creatorProfile) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <HudCard theme="cyan" brackets className="p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Writer Profile Not Found
          </h1>
          <Link
            href="/creators-hub/onboarding"
            className="btn-creator inline-flex px-5 py-2.5 text-sm font-semibold"
          >
            Apply as a Writer
          </Link>
        </HudCard>
      </main>
    );
  }

  const effectiveAvatarUrl =
    avatarUrl !== undefined ? avatarUrl : user.avatarUrl;

  return (
    <CreatorShell
      title="My Writer Profile"
      subtitle={`How clients see your page at /creators/${username}`}
    >
      <div className="max-w-4xl space-y-6">
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

        <HudCard theme="cyan" brackets className="p-6 sm:p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4 pb-5 border-b border-white/[0.08]">
              <div className="flex items-center gap-4">
                <RadarAvatar
                  name={displayName || username || "Creator"}
                  avatarUrl={effectiveAvatarUrl}
                  available={isAvailable}
                  theme="cyan"
                  size="lg"
                />
                <div className="space-y-1">
                  <p className="font-editorial text-xl font-semibold text-white">
                    {displayName || "Your Name"}
                  </p>
                  <p className="font-tech text-xs text-slate-400">
                    @{username}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label
                      className={`btn-creator inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        uploadingAvatar || removingAvatar
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }`}
                    >
                      <Camera className="w-3 h-3" />
                      <span>
                        {uploadingAvatar ? "Uploading..." : "Change Photo"}
                      </span>
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-400/35 bg-rose-500/15 text-rose-200 text-[11px] font-semibold hover:bg-rose-500/25 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        {removingAvatar ? "Removing..." : "Remove"}
                      </button>
                    )}
                    <span className="text-[11px] text-slate-400">
                      Max {MAX_BROWSER_UPLOAD_LABEL} · JPG, PNG, WEBP
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href={`/creators/${username}`}
                className="btn-ghost px-3.5 py-2 text-xs text-teal-300"
              >
                See Public Profile →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Public Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="hud-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Short Headline
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="hud-input"
                />
              </div>
            </div>

            {/* Profile Strength Meter */}
            {standoutReport && (
              <div className="rounded-2xl border border-white/[0.11] bg-white/[0.04] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                      Profile Strength
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {standoutReport.tierRecommendation}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-tech text-2xl font-bold text-sky-300">
                      {standoutReport.score}%
                    </span>
                    <Link
                      href="/creators-hub/connects"
                      className="btn-primary px-3 py-1.5 text-xs font-semibold"
                    >
                      Boost with Credits →
                    </Link>
                  </div>
                </div>

                <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-teal-400 to-amber-400 transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, standoutReport.score))}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {standoutReport.breakdown.map((item) => (
                    <div
                      key={item.key}
                      className={`p-3 rounded-xl border ${
                        item.completed
                          ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-100"
                          : "bg-white/[0.04] border-white/[0.11] text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-semibold">
                        <span>
                          {item.completed ? "✓" : "○"} {item.label}
                        </span>
                        <span className="font-tech text-[11px]">
                          +{item.points} pts
                        </span>
                      </div>
                      {!item.completed && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          {item.impactHint}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extra Profile Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Short Highlight Badge
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={taglineBadge}
                  onChange={(e) => setTaglineBadge(e.target.value)}
                  placeholder="e.g. Fast & Clear Business Writer · Always On Time"
                  className="hud-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Education or Experience
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={educationCredentials}
                  onChange={(e) => setEducationCredentials(e.target.value)}
                  placeholder="e.g. BCom Finance, UoN · 4 yrs writing"
                  className="hud-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Years Writing
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={yearsExperience}
                  onChange={(e) =>
                    setYearsExperience(Number(e.target.value || 0))
                  }
                  className="hud-input font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Usual Reply Time (minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={responseTimeMinutes}
                  onChange={(e) =>
                    setResponseTimeMinutes(Number(e.target.value || 30))
                  }
                  className="hud-input font-tech"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Short Intro Video Link (Optional)
                </label>
                <input
                  type="url"
                  value={introVideoUrl}
                  onChange={(e) => setIntroVideoUrl(e.target.value)}
                  placeholder="https://loom.com/share/..."
                  className="hud-input font-tech"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                About You
              </label>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="hud-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Categories You Write
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
                          ? "bg-teal-400/20 text-teal-100 border-teal-400/60 shadow-[0_0_16px_rgba(45,212,191,0.2)]"
                          : "bg-white/[0.05] text-slate-300 border-white/[0.12] hover:text-white"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-200">
              <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-white/[0.11] bg-white/[0.045] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="accent-teal-400"
                />
                <span>Available for new orders</span>
              </label>
              <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-white/[0.11] bg-white/[0.045] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAcceptBookings}
                  onChange={(e) => setAutoAcceptBookings(e.target.checked)}
                  className="accent-teal-400"
                />
                <span>Automatically accept paid orders</span>
              </label>
            </div>

            <div className="space-y-3 pt-2 border-t border-white/[0.08]">
              <h2 className="font-editorial text-base font-semibold text-white">
                Writing Samples
              </h2>
              {samples.map((s, idx) => {
                const trimmedAttachment = s.attachmentUrl?.trim() || "";
                const safeAttachment = isSafeMediaDisplayUrl(trimmedAttachment)
                  ? trimmedAttachment
                  : null;
                const isImageAttachment = Boolean(
                  safeAttachment &&
                    isAllowedNextImageSrc(safeAttachment) &&
                    isSafeRasterImageMimeOrExt(s.mimeType, safeAttachment)
                );
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-white/[0.11] bg-white/[0.045] flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <p className="font-semibold text-white">
                        {s.title}{" "}
                        <span className="text-teal-300">({s.category})</span>
                      </p>
                      <p className="text-slate-300">{s.excerpt}</p>
                      {safeAttachment && (
                        <div className="pt-1 flex items-center gap-2.5 flex-wrap">
                          {isImageAttachment && (
                            <Image
                              src={safeAttachment}
                              alt={s.attachmentName || s.title}
                              width={48}
                              height={48}
                              unoptimized={safeAttachment.startsWith("/api/")}
                              className="w-12 h-12 rounded-lg object-cover border border-white/[0.15]"
                            />
                          )}
                          <a
                            href={safeAttachment}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-400/35 text-teal-200 font-medium hover:bg-teal-500/25 transition-colors"
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
                      className="text-slate-400 hover:text-rose-300 shrink-0 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              <div className="p-4 rounded-xl border border-dashed border-white/[0.16] bg-white/[0.025] space-y-2.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newSample.title}
                    onChange={(e) =>
                      setNewSample((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="Sample title (min 3 chars)"
                    className="hud-input py-2"
                  />
                  <input
                    type="text"
                    value={newSample.category}
                    onChange={(e) =>
                      setNewSample((p) => ({ ...p, category: e.target.value }))
                    }
                    placeholder="Category"
                    className="hud-input py-2"
                  />
                </div>
                <textarea
                  rows={2}
                  value={newSample.excerpt}
                  onChange={(e) =>
                    setNewSample((p) => ({ ...p, excerpt: e.target.value }))
                  }
                  placeholder="Short excerpt (min 10 chars)..."
                  className="hud-input py-2"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.05] text-slate-200 font-medium cursor-pointer hover:bg-white/[0.1] transition-colors ${
                        uploadingAttachment
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 text-teal-300" />
                      <span>
                        {uploadingAttachment
                          ? "Uploading attachment..."
                          : newSample.attachmentUrl
                            ? "Replace File"
                            : "Attach Image / PDF / Word"}
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
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-400/35 text-teal-200">
                        <Paperclip className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">
                          {newSample.attachmentName || "Attached"}
                        </span>
                        <button
                          type="button"
                          onClick={handleClearNewSampleAttachment}
                          aria-label="Remove attachment"
                          className="text-teal-300 hover:text-rose-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      Optional · Max {MAX_BROWSER_UPLOAD_LABEL} (JPG, PNG, WEBP,
                      PDF, Word, TXT)
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
                        setError(
                          "Sample category must be at least 2 characters."
                        );
                        return;
                      }
                      if (newSample.excerpt.trim().length < 10) {
                        setError(
                          "Sample excerpt must be at least 10 characters."
                        );
                        return;
                      }
                      setError(null);
                      setSamples((p) => [
                        ...p,
                        sanitizeSamplePayload(newSample),
                      ]);
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
        </HudCard>
      </div>
    </CreatorShell>
  );
}
