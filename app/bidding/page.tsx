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
import { HUD_THEME_CYCLE } from "@/lib/design-tokens";
import {
  AuroraHeading,
  HudCard,
  RadarAvatar,
} from "@/components/ui/AuroraPrimitives";

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
      {/* Dark Aurora HUD Jobs Hero */}
      <HudCard theme="amber" brackets className="p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wider px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/35">
                <Gavel className="w-3.5 h-3.5" />
                Open Writing Jobs
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/35">
                <ShieldCheck className="w-3.5 h-3.5" />
                Try Page 1 for KES 490
              </span>
            </div>

            <AuroraHeading
              as="h1"
              className="text-3xl sm:text-5xl leading-[1.08]"
            >
              Post your job for free. Tested writers apply.
            </AuroraHeading>

            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              Share what you need once and compare prices and messages from
              tested writers. You can start small by ordering{" "}
              <strong className="text-amber-300">Page 1 for KES 490</strong>{" "}
              before paying for the whole project.
            </p>

            {/* Clear 3-Step Guide */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1">
              <div className="rounded-xl bg-white/[0.05] border border-white/[0.11] px-3 py-2">
                <p className="font-semibold text-amber-300">1. Post your job</p>
                <p className="text-slate-300 text-[11px]">Takes 2 minutes, always free</p>
              </div>
              <div className="rounded-xl bg-white/[0.05] border border-white/[0.11] px-3 py-2">
                <p className="font-semibold text-amber-300">2. Compare offers</p>
                <p className="text-slate-300 text-[11px]">See writer ratings &amp; prices</p>
              </div>
              <div className="rounded-xl bg-white/[0.05] border border-white/[0.11] px-3 py-2">
                <p className="font-semibold text-amber-300">3. Pick &amp; pay safely</p>
                <p className="text-slate-300 text-[11px]">Start from KES 490 or 25%</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowPostForm((v) => !v)}
                className="btn-primary px-5 py-3 text-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Post a Free Job
              </button>

              {isApprovedCreator ? (
                <Link
                  href="/creators-hub/connects"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500/20 border border-amber-400/45 text-amber-200 text-sm font-semibold hover:bg-amber-500/30 transition-colors"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>
                    {connectsBalance ?? user?.creatorProfile?.connectsBalance ?? 0}{" "}
                    Credits Left · Get More
                  </span>
                </Link>
              ) : (
                <Link
                  href="/creators-hub/join"
                  className="btn-ghost px-5 py-3 text-sm"
                >
                  Become a Writer
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 grid grid-cols-2 gap-3 bg-white/[0.05] border border-white/[0.12] rounded-2xl p-5">
            <div>
              <p className="text-[11px] font-tech uppercase text-slate-400">
                Open Jobs
              </p>
              <p className="font-tech text-3xl font-bold text-white mt-1">
                {briefs.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-tech uppercase text-slate-400">
                Start Small
              </p>
              <p className="font-tech text-2xl font-bold text-amber-300 mt-1">
                KES 490
              </p>
            </div>
            <div className="col-span-2 pt-2 border-t border-white/[0.1] text-xs text-slate-300 flex items-center justify-between">
              <span>Safe Payment</span>
              <span className="font-tech text-emerald-300 font-semibold">
                Writer paid on approval
              </span>
            </div>
          </div>
        </div>
      </HudCard>

      {/* Post a Job Drawer */}
      {showPostForm && (
        <HudCard theme="cyan" brackets className="p-6 sm:p-8 space-y-5 animate-reveal">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-white">
                Post a Writing Job (Free)
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Free to post. Compare offers from writers and start with Page 1 for KES 490 or a 25% deposit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPostForm(false)}
              className="p-2 rounded-xl border border-white/[0.14] bg-white/[0.06] text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-xs">
              {formError}
            </div>
          )}

          <form onSubmit={handlePostBrief} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={newBrief.title}
                  onChange={(e) =>
                    setNewBrief((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="e.g. Research paper on mobile money growth in Kenya"
                  className="hud-input w-full px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Category
                </label>
                <select
                  value={newBrief.categoryId}
                  onChange={(e) =>
                    setNewBrief((p) => ({ ...p, categoryId: e.target.value }))
                  }
                  className="hud-input w-full px-3.5 py-2.5 text-sm"
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
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                What do you need written?
              </label>
              <textarea
                rows={4}
                required
                minLength={20}
                value={newBrief.description}
                onChange={(e) =>
                  setNewBrief((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Share your main topic, sections to include, style or tone, and any notes writers should know..."
                className="hud-input w-full px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Type / Level
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
                  className="hud-input w-full px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
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
                  className="hud-input w-full px-3 py-2 text-xs font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Lowest Budget (KES)
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
                  className="hud-input w-full px-3 py-2 text-xs font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Highest Budget (KES)
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
                  className="hud-input w-full px-3 py-2 text-xs font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Days to Finish
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
                  className="hud-input w-full px-3 py-2 text-xs font-tech"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <label className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.045] border border-white/[0.12] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBrief.isUrgent}
                  onChange={(e) =>
                    setNewBrief((p) => ({ ...p, isUrgent: e.target.checked }))
                  }
                  className="accent-rose-400"
                />
                <span className="font-semibold text-rose-300">Urgent job</span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.045] border border-white/[0.12] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBrief.isSealed}
                  onChange={(e) =>
                    setNewBrief((p) => ({ ...p, isSealed: e.target.checked }))
                  }
                  className="accent-cyan-400"
                />
                <span className="font-semibold text-slate-200">
                  Hide writer prices from others
                </span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.045] border border-white/[0.12] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBrief.ndaRequired}
                  onChange={(e) =>
                    setNewBrief((p) => ({ ...p, ndaRequired: e.target.checked }))
                  }
                  className="accent-cyan-400"
                />
                <span className="font-semibold text-slate-200">
                  Keep project private (NDA)
                </span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/15 border border-amber-400/35 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBrief.allowTripwireOutline}
                  onChange={(e) =>
                    setNewBrief((p) => ({
                      ...p,
                      allowTripwireOutline: e.target.checked,
                    }))
                  }
                  className="accent-amber-400"
                />
                <span className="font-semibold text-amber-200">
                  Allow KES 490 Page-1 start
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
                {creating ? "Posting Job..." : "Post Job Now"}
              </button>
            </div>
          </form>
        </HudCard>
      )}

      {/* Search & Category Filter Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              categoryFilter === "all"
                ? "bg-cyan-400/20 text-cyan-100 border-cyan-400/60"
                : "bg-white/[0.05] text-slate-300 border-white/[0.12] hover:text-white"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.slug)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                categoryFilter === cat.slug
                  ? "bg-sky-500/25 text-sky-100 border-sky-400/60"
                  : "bg-white/[0.05] text-slate-300 border-white/[0.12] hover:text-white"
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
                  ? "bg-sky-500/25 text-sky-100 border-sky-400/55"
                  : "bg-white/[0.05] text-slate-300 border-white/[0.12]"
              }`}
            >
              My Jobs
            </button>
          )}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search jobs..."
              className="hud-input pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading open jobs and offers...
        </div>
      ) : briefs.length === 0 ? (
        <div className="editorial-card p-12 text-center space-y-3">
          <Gavel className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="font-editorial text-xl font-semibold text-white">
            No open jobs match your search
          </h3>
          <button
            onClick={() => setShowPostForm(true)}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            Post a Job
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {briefs.map((brief, idx) => (
            <HudCard
              key={brief.id}
              theme={HUD_THEME_CYCLE[idx % HUD_THEME_CYCLE.length]}
              brackets
              interactive
              className="p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-tech text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.12] text-slate-300">
                      {brief.briefRef}
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-400/35">
                      {brief.category.name}
                    </span>
                    {brief.isUrgent && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-400/35">
                        <Flame className="w-3 h-3" />
                        Urgent
                      </span>
                    )}
                    {brief.isSealed && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-200 border border-white/[0.16]">
                        <Lock className="w-3 h-3" />
                        Private Prices
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-tech font-bold text-amber-300 bg-amber-500/15 border border-amber-400/35 px-2.5 py-0.5 rounded-full">
                    <Zap className="w-3 h-3 text-amber-300" />
                    {brief.requiredConnects} Credits
                  </span>
                </div>

                <Link
                  href={`/bidding/${brief.id}`}
                  className="block font-editorial text-xl font-semibold text-white hover:text-cyan-300 leading-snug transition-colors"
                >
                  {brief.title}
                </Link>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {brief.description}
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/[0.045] border border-white/[0.11]">
                    <span className="text-[10px] font-tech uppercase text-slate-400 block">
                      Budget
                    </span>
                    <span className="font-tech font-bold text-cyan-300">
                      {formatKes(brief.budgetMin)} – {formatKes(brief.budgetMax)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.045] border border-white/[0.11]">
                    <span className="text-[10px] font-tech uppercase text-slate-400 block">
                      Length &amp; Style
                    </span>
                    <span className="font-tech font-semibold text-white">
                      {brief.wordCount.toLocaleString()}w · {brief.citationStyle}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.045] border border-white/[0.11]">
                    <span className="text-[10px] font-tech uppercase text-slate-400 block">
                      Time Allowed
                    </span>
                    <span className="font-tech font-semibold text-white inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sky-300" />
                      {brief.deadlineDays} days
                    </span>
                  </div>
                </div>

                {brief.myBid && (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-300" />
                      <span className="font-semibold text-white">
                        Your offer position:{" "}
                        <strong className="font-tech text-amber-300">
                          #{brief.myBid.rankPosition} of {brief.myBid.totalBidders}
                        </strong>
                      </span>
                    </div>
                    {brief.myBid.rankPosition > 1 ? (
                      <span className="font-tech text-[11px] font-semibold text-sky-300">
                        +{brief.myBid.connectsNeededForRank1} Credits for #1
                      </span>
                    ) : (
                      <span className="font-tech text-[11px] font-bold text-emerald-300">
                        Top #1 Spot
                      </span>
                    )}
                  </div>
                )}

                {brief.topPreview.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] font-tech uppercase tracking-wider text-slate-400">
                      Current Offers ({brief.bidCount} total)
                    </p>
                    <div className="space-y-1.5">
                      {brief.topPreview.map((tb) => (
                        <div
                          key={tb.id}
                          className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            tb.isTopBoostedSlot || tb.isFeatured
                              ? "bg-amber-500/15 border-amber-400/35"
                              : "bg-white/[0.04] border-white/[0.1]"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-tech font-bold text-[11px] px-1.5 py-0.5 rounded bg-white/15 text-white shrink-0">
                              #{tb.rankPosition}
                            </span>
                            <RadarAvatar
                              name={tb.creator.displayName}
                              avatarUrl={tb.creator.avatarUrl}
                              available={tb.creator.availableNow}
                              theme={tb.isTopBoostedSlot || tb.isFeatured ? "amber" : "cyan"}
                              size="sm"
                            />
                            <span className="font-semibold text-white truncate">
                              {tb.creator.displayName}
                            </span>
                            {tb.creator.creatorTier === "ELITE" && (
                              <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                            )}
                            {tb.isTopBoostedSlot && (
                              <span className="text-[10px] font-tech px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 font-semibold shrink-0">
                                Boosted +{tb.boostConnects}
                              </span>
                            )}
                          </div>
                          <span className="font-tech font-bold text-cyan-300 shrink-0">
                            {tb.proposedPrice !== null
                              ? formatKes(tb.proposedPrice)
                              : "Hidden"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/[0.1] flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-teal-300" />
                  <span>
                    {brief.bidCount} offer{brief.bidCount === 1 ? "" : "s"}
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
                    ? "Boost or Edit Offer"
                    : isApprovedCreator
                      ? "Send an Offer"
                      : "See Offers"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </HudCard>
          ))}
        </div>
      )}
    </main>
  );
}
