"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthContext";

interface SampleItem {
  title: string;
  category: string;
  excerpt: string;
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
  const [newSample, setNewSample] = useState<SampleItem>({
    title: "",
    category: "Academic Writing",
    excerpt: "",
  });
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
        setSamples(Array.isArray(p.portfolioSamples) ? p.portfolioSamples : []);
      })
      .catch(() => {});
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
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
          portfolioSamples: samples,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Update failed.");
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
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-editorial font-semibold">
            Creator Portfolio & Availability
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Customize how customers see you at{" "}
            <Link
              href={`/creators/${username}`}
              className="text-[#0f766e] font-medium hover:underline"
            >
              /creators/{username}
            </Link>
          </p>
        </div>
        <Link
          href="/creators-hub"
          className="text-xs font-semibold text-[#0f766e] hover:underline"
        >
          ← Creators Hub
        </Link>
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

      <form onSubmit={handleSave} className="editorial-card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Bio</label>
          <textarea
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
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
                  className={`px-3 py-1 rounded-full text-xs border ${
                    active
                      ? "bg-[#0f766e] text-white border-[#0f766e]"
                      : "bg-white text-stone-700 border-[#e6e0d4]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-[#e6e0d4] bg-[#faf7f2] cursor-pointer">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
            />
            <span>Available to receive new customer bookings</span>
          </label>
          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-[#e6e0d4] bg-[#faf7f2] cursor-pointer">
            <input
              type="checkbox"
              checked={autoAcceptBookings}
              onChange={(e) => setAutoAcceptBookings(e.target.checked)}
            />
            <span>Auto-accept incoming paid bookings automatically</span>
          </label>
        </div>

        <div className="space-y-3 pt-2 border-t border-[#e6e0d4]">
          <h2 className="font-editorial text-base font-semibold">
            Portfolio Excerpts
          </h2>
          {samples.map((s, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-[#e6e0d4] bg-stone-50 flex items-start justify-between gap-3 text-xs"
            >
              <div>
                <p className="font-semibold">
                  {s.title}{" "}
                  <span className="text-[#0f766e]">({s.category})</span>
                </p>
                <p className="text-stone-600 mt-1">{s.excerpt}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSamples((prev) => prev.filter((_, i) => i !== idx))
                }
                className="text-stone-400 hover:text-rose-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="p-3.5 rounded-lg border border-dashed border-[#e6e0d4] space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={newSample.title}
                onChange={(e) =>
                  setNewSample((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="Sample title"
                className="rounded border border-[#e6e0d4] px-2.5 py-1.5"
              />
              <input
                type="text"
                value={newSample.category}
                onChange={(e) =>
                  setNewSample((p) => ({ ...p, category: e.target.value }))
                }
                placeholder="Category"
                className="rounded border border-[#e6e0d4] px-2.5 py-1.5"
              />
            </div>
            <textarea
              rows={2}
              value={newSample.excerpt}
              onChange={(e) =>
                setNewSample((p) => ({ ...p, excerpt: e.target.value }))
              }
              placeholder="Short sample excerpt..."
              className="w-full rounded border border-[#e6e0d4] px-2.5 py-1.5"
            />
            <button
              type="button"
              onClick={() => {
                if (!newSample.title.trim() || !newSample.excerpt.trim()) return;
                setSamples((p) => [...p, newSample]);
                setNewSample({
                  title: "",
                  category: "Academic Writing",
                  excerpt: "",
                });
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-white border border-[#e6e0d4] font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Sample
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold hover:bg-teal-900"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Creator Profile"}
          </button>
        </div>
      </form>
    </main>
  );
}
