"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Award,
  Clock,
  Crown,
  Flame,
  Gavel,
  Lock,
  PlusCircle,
  Search,
  ShieldCheck,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { formatKes } from "@/components/ui/Badges";
import { CreatorAvatar } from "@/components/ui/EditorialVisuals";

interface BriefPreviewBid {
  id: string;
  rankPosition: number;
  isTopBoostedSlot: boolean;
  isFeatured: boolean;
  isSealed: boolean;
  boostConnects: number;
  proposedPrice: number | null;
  deliveryDays: number;
  creator: {
    username: string;
    displayName: string;
    creatorTier: string;
    taglineBadge: string | null;
    availableNow: boolean;
    featured: boolean;
    ratingAverage: number;
    avatarUrl: string | null;
  };
}

interface BriefSummary {
  id: string;
  briefRef: string;
  title: string;
  description: string;
  academicLevel: string;
  wordCount: number;
  citationStyle: string;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  deadlineDays: number;
  requiredConnects: number;
  isUrgent: boolean;
  isSealed: boolean;
  ndaRequired: boolean;
  allowTripwireOutline: boolean;
  status: string;
  expiresAt: string;
  createdAt: string;
  category: { id: string; slug: string; name: string };
  customer: { id: string; name: string };
  bidCount: number;
  bidStats: { minBid: number | null; avgBid: number | null; maxBid: number | null };
  topPreview: BriefPreviewBid[];
  myBid: {
    id: string;
    rankPosition: number;
    totalBidders: number;
    boostConnects: number;
    proposedPrice: number;
    connectsNeededForRank1: number;
    connectsNeededForTop3: number;
  } | null;
}

interface CategoryOption {
  id: string;
  slug: string;
  name: string;
}

export default function LiveBiddingMarketplacePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [briefs, setBriefs] = useState<BriefSummary[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [connectsBalance, setConnectsBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const [showPostForm, setShowPostForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newBrief, setNewBrief] = useState({
    title: "",
    categoryId: "",
    description: "",
    academicLevel: "Postgraduate / Masters",
    wordCount: 2500,
    citationStyle: "APA 7th",
    budgetMin: 5000,
    budgetMax: 9000,
    deadlineDays: 4,
    isUrgent: false,
    isSealed: false,
    ndaRequired: false,
    allowTripwireOutline: true,
  });

  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams();
    if (categoryFilter !== "all") qs.set("category", categoryFilter);
    if (searchQ.trim()) qs.set("q", searchQ.trim());
    if (mineOnly) qs.set("mine", "true");

    Promise.all([
      fetch(`/api/bidding/briefs?${qs.toString()}`, { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
    ])
      .then(async ([briefsRes, catsRes]) => {
        if (!active) return;
        if (briefsRes.ok) {
          const j = await briefsRes.json();
          if (!active) return;
          setBriefs(j.data?.briefs ?? []);
          setConnectsBalance(j.data?.viewerConnectsBalance ?? null);
        }
        if (catsRes.ok) {
          const cj = await catsRes.json();
          if (!active) return;
          const cats = cj.data?.categories ?? [];
          setCategories(cats);
          setNewBrief((prev) =>
            prev.categoryId || cats.length === 0
              ? prev
              : { ...prev, categoryId: cats[0].id }
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [categoryFilter, searchQ, mineOnly]);

  async function handlePostBrief(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      router.push(`/auth?callbackUrl=${encodeURIComponent("/bidding")}`);
      return;
    }
    setFormError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/bidding/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newBrief,
          wordCount: Number(newBrief.wordCount),
          budgetMin: Number(newBrief.budgetMin),
          budgetMax: Number(newBrief.budgetMax),
          deadlineDays: Number(newBrief.deadlineDays),
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || "Could not post brief.");
      }
      setShowPostForm(false);
      router.push(`/bidding/${j.data.brief.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create brief.");
    } finally {
      setCreating(false);
    }
  }

  const isApprovedCreator = Boolean(
    user?.roles.includes("CREATOR") &&
      user?.creatorProfile?.applicationStatus === "APPROVED"
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-reveal">
      {/* Dual-Mode Bidding Hero */}
      <section className="editorial-card p-6 sm:p-8 bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0c1b18] text-white border-0 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wider px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                <Gavel className="w-3.5 h-3.5" />
                Live Proposal Auction
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                KES 490 Outline Tripwire Enabled
              </span>
            </div>

            <h1 className="font-editorial text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-[#faf7f2]">
              Post once. Let vetted writers compete for #1.
            </h1>

            <p className="text-sm sm:text-base text-stone-300 max-w-2xl leading-relaxed">
              Clients receive ranked, rubric-vetted proposals in minutes—and can lock a writer for just{" "}
              <strong className="text-amber-300">KES 490</strong> first-page outline. Writers see exact live rank positions and promote bids into Top-3 boosted slots using Connects.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowPostForm((v) => !v)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#faf7f2] text-[#111827] text-sm font-semibold hover:bg-amber-100 transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-[#1e3a8a]" />
                Post Custom Brief (Free)
              </button>

              {isApprovedCreator ? (
                <Link
                  href="/creators-hub/connects"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-sm font-semibold hover:bg-amber-500/30 transition-colors"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>
                    {connectsBalance ?? user?.creatorProfile?.connectsBalance ?? 0}{" "}
                    Connects Available · Top Up
                  </span>
                </Link>
              ) : (
                <Link
                  href="/creators-hub/join"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/25 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Qualify as a Bidder
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 grid grid-cols-2 gap-3 bg-white/5 border border-white/10 rounded-2xl p-5">
            <div>
              <p className="text-[11px] font-tech uppercase text-stone-400">
                Open Briefs
              </p>
              <p className="font-tech text-3xl font-bold text-white mt-1">
                {briefs.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-tech uppercase text-stone-400">
                Tripwire Lock
              </p>
              <p className="font-tech text-2xl font-bold text-amber-300 mt-1">
                KES 490
              </p>
            </div>
            <div className="col-span-2 pt-2 border-t border-white/10 text-xs text-stone-300 flex items-center justify-between">
              <span>Top-3 Boosted Slots</span>
              <span className="font-tech text-emerald-300 font-semibold">
                Live Rank Auction
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Post Brief Drawer */}
      {showPostForm && (
        <section className="editorial-card p-6 sm:p-8 bg-white border-2 border-[#1e3a8a]/30 space-y-5 animate-reveal">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-[#111827]">
                Post a Custom Brief for Competitive Bids
              </h2>
              <p className="text-xs text-stone-600 mt-0.5">
                Free to publish. Compare ranked writers, sample hooks, and lock with a KES 490 outline or 25% deposit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPostForm(false)}
              className="p-2 rounded-xl border border-[#e6e0d4] text-stone-500 hover:text-[#111827]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs">
              {formError}
            </div>
          )}

          <form onSubmit={handlePostBrief} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">
                  Brief Title
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={newBrief.title}
                  onChange={(e) =>
                    setNewBrief((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="e.g. Systematic Literature Review on Mobile Credit Risk in East Africa"
                  className="w-full rounded-xl border border-[#e6e0d4] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Discipline
                </label>
                <select
                  value={newBrief.categoryId}
                  onChange={(e) =>
                    setNewBrief((p) => ({ ...p, categoryId: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[#e6e0d4] px-3.5 py-2.5 text-sm bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Detailed Brief &amp; Rubric Requirements
              </label>
              <textarea
                rows={4}
                required
                minLength={20}
                value={newBrief.description}
                onChange={(e) =>
                  setNewBrief((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Describe thesis goal, required scholarly/industry sources, structure, and deliverable expectations..."
                className="w-full rounded-xl border border-[#e6e0d4] px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Level
                </label>
                <input
                  type="text"
                  value={newBrief.academicLevel}
                  onChange={(e) =>
                    setNewBrief((p) => ({
                      ...p,
                      academicLevel: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[#e6e0d4] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Words
                </label>
                <input
                  type="number"
                  min={100}
                  value={newBrief.wordCount}
                  onChange={(e) =>
                    setNewBrief((p) => ({
                      ...p,
                      wordCount: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-[#e6e0d4] px-3 py-2 text-xs font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Min Budget (KES)
                </label>
                <input
                  type="number"
                  min={500}
                  value={newBrief.budgetMin}
                  onChange={(e) =>
                    setNewBrief((p) => ({
                      ...p,
                      budgetMin: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-[#e6e0d4] px-3 py-2 text-xs font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Max Budget (KES)
                </label>
                <input
                  type="number"
                  min={500}
                  value={newBrief.budgetMax}
                  onChange={(e) =>
                    setNewBrief((p) => ({
                      ...p,
                      budgetMax: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-[#e6e0d4] px-3 py-2 text-xs font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Turnaround (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={newBrief.deadlineDays}
                  onChange={(e) =>
                    setNewBrief((p) => ({
                      ...p,
                      deadlineDays: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-[#e6e0d4] px-3 py-2 text-xs font-tech"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <label className="flex items-center gap-2 p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBrief.isUrgent}
                  onChange={(e) =>
                    setNewBrief((p) => ({ ...p, isUrgent: e.target.checked }))
                  }
                />
                <span className="font-semibold text-rose-800">
                  Urgent Priority Alert
                </span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBrief.isSealed}
                  onChange={(e) =>
                    setNewBrief((p) => ({ ...p, isSealed: e.target.checked }))
                  }
                />
                <span className="font-semibold text-stone-800">
                  Sealed Proposals (No Undercutting)
                </span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBrief.ndaRequired}
                  onChange={(e) =>
                    setNewBrief((p) => ({ ...p, ndaRequired: e.target.checked }))
                  }
                />
                <span className="font-semibold text-stone-800">
                  Strict NDA Protection
                </span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBrief.allowTripwireOutline}
                  onChange={(e) =>
                    setNewBrief((p) => ({
                      ...p,
                      allowTripwireOutline: e.target.checked,
                    }))
                  }
                />
                <span className="font-semibold text-amber-950">
                  Allow KES 490 Outline Start
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPostForm(false)}
                className="btn-ghost px-4 py-2.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                {creating ? "Publishing Brief..." : "Publish Brief to Auction"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Search & Category Filter Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
              categoryFilter === "all"
                ? "bg-[#111827] text-white border-[#111827]"
                : "bg-white text-stone-700 border-[#e6e0d4]"
            }`}
          >
            All Disciplines
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.slug)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
                categoryFilter === cat.slug
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                  : "bg-white text-stone-700 border-[#e6e0d4]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={() => setMineOnly((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap ${
                mineOnly
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                  : "bg-white text-stone-700 border-[#e6e0d4]"
              }`}
            >
              My Posted Briefs
            </button>
          )}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Filter briefs..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#e6e0d4] bg-white"
            />
          </div>
        </div>
      </div>

      {/* Briefs List */}
      {loading ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading live bidding briefs and proposal ranks...
        </div>
      ) : briefs.length === 0 ? (
        <div className="editorial-card p-12 text-center space-y-3 bg-white">
          <Gavel className="w-10 h-10 text-stone-400 mx-auto" />
          <h3 className="font-editorial text-xl font-semibold">
            No open briefs match your filter
          </h3>
          <button
            onClick={() => setShowPostForm(true)}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            Post the First Brief
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {briefs.map((brief) => (
            <article
              key={brief.id}
              className="editorial-card-interactive p-6 bg-white flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-tech text-[11px] px-2 py-0.5 rounded-md bg-[#faf7f2] border border-[#e6e0d4] text-stone-700">
                      {brief.briefRef}
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0f766e] border border-teal-200">
                      {brief.category.name}
                    </span>
                    {brief.isUrgent && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        <Flame className="w-3 h-3" />
                        Urgent
                      </span>
                    )}
                    {brief.isSealed && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 border border-stone-300">
                        <Lock className="w-3 h-3" />
                        Sealed
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-tech font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    <Zap className="w-3 h-3 text-amber-600" />
                    {brief.requiredConnects} Connects
                  </span>
                </div>

                <Link
                  href={`/bidding/${brief.id}`}
                  className="block font-editorial text-xl font-semibold text-[#111827] hover:text-[#1e3a8a] leading-snug"
                >
                  {brief.title}
                </Link>

                <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                  {brief.description}
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                    <span className="text-[10px] font-tech uppercase text-stone-500 block">
                      Client Budget
                    </span>
                    <span className="font-tech font-bold text-[#111827]">
                      {formatKes(brief.budgetMin)} – {formatKes(brief.budgetMax)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                    <span className="text-[10px] font-tech uppercase text-stone-500 block">
                      Scope &amp; Style
                    </span>
                    <span className="font-tech font-semibold text-[#111827]">
                      {brief.wordCount.toLocaleString()}w · {brief.citationStyle}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                    <span className="text-[10px] font-tech uppercase text-stone-500 block">
                      Deadline
                    </span>
                    <span className="font-tech font-semibold text-[#111827] inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#1e3a8a]" />
                      {brief.deadlineDays} days
                    </span>
                  </div>
                </div>

                {/* My Live Rank Banner */}
                {brief.myBid && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-300 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-700" />
                      <span className="font-semibold text-[#111827]">
                        Your Live Rank:{" "}
                        <strong className="font-tech text-amber-900">
                          #{brief.myBid.rankPosition} of {brief.myBid.totalBidders}
                        </strong>
                      </span>
                    </div>
                    {brief.myBid.rankPosition > 1 ? (
                      <span className="font-tech text-[11px] font-semibold text-[#1e3a8a]">
                        +{brief.myBid.connectsNeededForRank1}⚡ for #1
                      </span>
                    ) : (
                      <span className="font-tech text-[11px] font-bold text-emerald-700">
                        Leading #1 Slot
                      </span>
                    )}
                  </div>
                )}

                {/* Top Ranked Bidders Preview */}
                {brief.topPreview.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] font-tech uppercase tracking-wider text-stone-500">
                      Current Top Ranked Proposals ({brief.bidCount} total)
                    </p>
                    <div className="space-y-1.5">
                      {brief.topPreview.map((tb) => (
                        <div
                          key={tb.id}
                          className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            tb.isTopBoostedSlot || tb.isFeatured
                              ? "bg-amber-50/60 border-amber-200"
                              : "bg-[#faf7f2] border-[#e6e0d4]"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-tech font-bold text-[11px] px-1.5 py-0.5 rounded bg-[#111827] text-white shrink-0">
                              #{tb.rankPosition}
                            </span>
                            <CreatorAvatar
                              name={tb.creator.displayName}
                              avatarUrl={tb.creator.avatarUrl}
                              available={tb.creator.availableNow}
                              size="sm"
                            />
                            <span className="font-semibold truncate">
                              {tb.creator.displayName}
                            </span>
                            {tb.creator.creatorTier === "ELITE" && (
                              <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                            {tb.isTopBoostedSlot && (
                              <span className="text-[10px] font-tech px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold shrink-0">
                                Boosted +{tb.boostConnects}⚡
                              </span>
                            )}
                          </div>
                          <span className="font-tech font-bold text-[#111827] shrink-0">
                            {tb.proposedPrice !== null
                              ? formatKes(tb.proposedPrice)
                              : "Sealed"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#e6e0d4] flex items-center justify-between gap-3">
                <div className="text-[11px] text-stone-500 flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-[#0f766e]" />
                  <span>
                    {brief.bidCount} proposal{brief.bidCount === 1 ? "" : "s"}
                    {brief.bidStats.avgBid
                      ? ` · Avg ${formatKes(brief.bidStats.avgBid)}`
                      : ""}
                  </span>
                </div>
                <Link
                  href={`/bidding/${brief.id}`}
                  className="btn-primary px-4 py-2 text-xs gap-1.5"
                >
                  {brief.myBid
                    ? "Boost Rank / Edit"
                    : isApprovedCreator
                      ? "Place Ranked Bid"
                      : "View Proposals"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
