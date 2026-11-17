"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Gavel,
  Lock,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  BID_FEATURED_CONNECTS_COST,
  BID_SEALED_CONNECTS_COST,
  CLIENT_CHECKOUT_ADDONS,
  CheckoutMode,
  TRIPWIRE_OUTLINE_PRICE_KES,
  calculateAddOnsTotal,
  computeBidRankScore,
  rankBidsForBrief,
} from "@/lib/pricing";
import { formatKes } from "@/components/ui/Badges";
import { CreatorAvatar } from "@/components/ui/EditorialVisuals";

interface RankedBidItem {
  id: string;
  openBriefId: string;
  creatorProfileId: string;
  proposedPrice: number | null;
  currency: string;
  deliveryDays: number;
  pitch: string;
  sampleHook: string | null;
  baseConnectsSpent: number;
  boostConnects: number;
  isSealed: boolean;
  isFeatured: boolean;
  rankScore: number;
  status: string;
  createdAt: string;
  rankPosition: number;
  totalBidders: number;
  isTopBoostedSlot: boolean;
  connectsNeededForRank1: number;
  connectsNeededForTop3: number;
  isRedacted: boolean;
  isMyBid: boolean;
  creator: {
    id: string;
    username: string;
    displayName: string;
    headline: string;
    creatorTier: string;
    assessmentScore: number | null;
    ratingAverage: number;
    completedBookingsCount: number;
    profileCompletenessScore: number;
    taglineBadge: string | null;
    educationCredentials: string | null;
    yearsExperience: number;
    responseTimeMinutes: number;
    onTimeDeliveryRate: number;
    availableNow: boolean;
    featuredProfile: boolean;
    creatorPlus: boolean;
    avatarUrl: string | null;
  };
}

interface BriefDetail {
  id: string;
  briefRef: string;
  customerId: string;
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
  createdAt: string;
  category: { id: string; slug: string; name: string };
  customer: { id: string; name: string };
}

export default function BriefDetailBiddingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, refresh } = useAuth();
  const router = useRouter();

  const [brief, setBrief] = useState<BriefDetail | null>(null);
  const [bids, setBids] = useState<RankedBidItem[]>([]);
  const [myBid, setMyBid] = useState<RankedBidItem | null>(null);
  const [bidStats, setBidStats] = useState<{
    count: number;
    minBid: number | null;
    avgBid: number | null;
    maxBid: number | null;
  }>({ count: 0, minBid: null, avgBid: null, maxBid: null });
  const [connectsBalance, setConnectsBalance] = useState<number>(0);
  const [isOwner, setIsOwner] = useState(false);
  const [hasCreatorPlus, setHasCreatorPlus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New Bid State
  const [proposedPrice, setProposedPrice] = useState(6500);
  const [deliveryDays, setDeliveryDays] = useState(3);
  const [pitch, setPitch] = useState("");
  const [sampleHook, setSampleHook] = useState("");
  const [boostConnects, setBoostConnects] = useState(5);
  const [isSealed, setIsSealed] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);

  // Boost Existing Bid State
  const [addBoost, setAddBoost] = useState(5);
  const [upgradeSealed, setUpgradeSealed] = useState(false);
  const [upgradeFeatured, setUpgradeFeatured] = useState(false);
  const [boosting, setBoosting] = useState(false);

  // Client Award & Checkout Mode State
  const [checkoutMode, setCheckoutMode] =
    useState<CheckoutMode>("TRIPWIRE_OUTLINE");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([
    "originality_report",
  ]);
  const [awardingId, setAwardingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/bidding/briefs/${encodeURIComponent(id)}/bids`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || "Failed to load brief.");
      }
      const d = j.data;
      setBrief(d.brief);
      setBids(d.bids ?? []);
      setMyBid(d.myBid ?? null);
      setBidStats(d.bidStats ?? { count: 0, minBid: null, avgBid: null, maxBid: null });
      setConnectsBalance(d.viewerConnectsBalance ?? 0);
      setIsOwner(Boolean(d.isOwner));
      setHasCreatorPlus(Boolean(d.hasCreatorPlus));
      setProposedPrice(Math.round((d.brief.budgetMin + d.brief.budgetMax) / 2));
      setDeliveryDays(d.brief.deadlineDays);
      if (!d.brief.allowTripwireOutline) {
        setCheckoutMode("MILESTONE_SPLIT");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load error.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    fetch(`/api/bidding/briefs/${encodeURIComponent(id)}/bids`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(j?.error?.message || "Failed to load brief.");
        }
        return j.data;
      })
      .then((d) => {
        if (!active) return;
        setBrief(d.brief);
        setBids(d.bids ?? []);
        setMyBid(d.myBid ?? null);
        setBidStats(d.bidStats ?? { count: 0, minBid: null, avgBid: null, maxBid: null });
        setConnectsBalance(d.viewerConnectsBalance ?? 0);
        setIsOwner(Boolean(d.isOwner));
        setHasCreatorPlus(Boolean(d.hasCreatorPlus));
        setProposedPrice(Math.round((d.brief.budgetMin + d.brief.budgetMax) / 2));
        setDeliveryDays(d.brief.deadlineDays);
        if (!d.brief.allowTripwireOutline) {
          setCheckoutMode("MILESTONE_SPLIT");
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Load error.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Live Rank Simulation for New Bid
  const creatorProfile = user?.creatorProfile;
  const simulatedPlacement = useMemo(() => {
    if (!brief || !creatorProfile) return null;
    const simulatedScore = computeBidRankScore({
      boostConnects,
      isFeatured,
      isSealed,
      creatorTier: creatorProfile.creatorTier,
      assessmentScore: creatorProfile.assessmentScore ?? 85,
      ratingAverage: 4.9,
      profileCompletenessScore: creatorProfile.profileCompletenessScore ?? 75,
    });
    const combined = rankBidsForBrief([
      ...bids.map((b) => ({
        id: b.id,
        creatorProfileId: b.creatorProfileId,
        boostConnects: b.boostConnects,
        isFeatured: b.isFeatured,
        isSealed: b.isSealed,
        rankScore: b.rankScore,
        createdAt: b.createdAt,
      })),
      {
        id: "__preview__",
        creatorProfileId: creatorProfile.id,
        boostConnects,
        isFeatured,
        isSealed,
        rankScore: simulatedScore,
        createdAt: brief.createdAt,
      },
    ]);
    const mine = combined.find((b) => b.id === "__preview__");
    return {
      rankPosition: mine?.rankPosition ?? 1,
      totalBidders: combined.length,
      score: simulatedScore,
      totalCost:
        brief.requiredConnects +
        boostConnects +
        (isSealed ? BID_SEALED_CONNECTS_COST : 0) +
        (isFeatured ? BID_FEATURED_CONNECTS_COST : 0),
    };
  }, [brief, bids, creatorProfile, boostConnects, isFeatured, isSealed]);

  async function handleSubmitBid(e: React.FormEvent) {
    e.preventDefault();
    if (!brief) return;
    setError(null);
    setNotice(null);
    setSubmittingBid(true);
    try {
      const res = await fetch(
        `/api/bidding/briefs/${encodeURIComponent(brief.id)}/bids`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposedPrice: Number(proposedPrice),
            deliveryDays: Number(deliveryDays),
            pitch,
            sampleHook: sampleHook.trim() || undefined,
            boostConnects: Number(boostConnects),
            isSealed,
            isFeatured,
          }),
        }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || "Could not submit proposal.");
      }
      setNotice(
        `Proposal placed at Rank #${j.data.rankPosition} of ${j.data.totalBidders}!`
      );
      await Promise.all([loadData(), refresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission error.");
    } finally {
      setSubmittingBid(false);
    }
  }

  async function handleBoostExistingBid(quickExactBoost?: number) {
    if (!brief || !myBid) return;
    setError(null);
    setNotice(null);
    setBoosting(true);
    try {
      const boostAmount =
        quickExactBoost !== undefined ? quickExactBoost : Number(addBoost);
      const res = await fetch(
        `/api/bidding/briefs/${encodeURIComponent(brief.id)}/bids`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addBoostConnects: boostAmount,
            enableSealed: upgradeSealed,
            enableFeatured: upgradeFeatured,
          }),
        }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || "Boost failed.");
      }
      setNotice(
        `Rank updated! You are now #${j.data.rankPosition} of ${j.data.totalBidders}.`
      );
      setUpgradeSealed(false);
      setUpgradeFeatured(false);
      await Promise.all([loadData(), refresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Boost error.");
    } finally {
      setBoosting(false);
    }
  }

  async function handleAwardBid(bidId: string) {
    if (!brief) return;
    setError(null);
    setAwardingId(bidId);
    try {
      const res = await fetch(
        `/api/bidding/briefs/${encodeURIComponent(brief.id)}/award`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bidId,
            checkoutMode,
            selectedAddOns,
          }),
        }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || "Could not award bid.");
      }
      router.push(`/dashboard/bookings/${j.data.booking.bookingRef}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Award failed.");
    } finally {
      setAwardingId(null);
    }
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading ranked proposal auction...
        </div>
      </main>
    );
  }

  if (!brief) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold">
            Brief Not Found
          </h1>
          <Link href="/bidding" className="btn-primary px-5 py-2.5 text-sm">
            Back to Live Bidding
          </Link>
        </div>
      </main>
    );
  }

  const isApprovedCreator = Boolean(
    user?.roles.includes("CREATOR") &&
      user?.creatorProfile?.applicationStatus === "APPROVED"
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-reveal">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href="/bidding"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-[#1e3a8a]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Open Briefs
        </Link>
        {isApprovedCreator && (
          <Link
            href="/creators-hub/connects"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-950 text-xs font-tech font-bold hover:bg-amber-100"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            Balance: {connectsBalance} Connects · Top Up
          </Link>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-start justify-between gap-3">
          <span>{error}</span>
          {error.includes("Connects") && (
            <Link
              href="/creators-hub/connects"
              className="shrink-0 px-3 py-1 rounded-lg bg-amber-700 text-white text-xs font-semibold"
            >
              Buy Connects
            </Link>
          )}
        </div>
      )}

      {notice && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Brief + Ranked Proposals Leaderboard */}
        <div className="lg:col-span-7 space-y-6">
          {/* Brief Card */}
          <div className="editorial-card p-6 sm:p-8 bg-white space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-tech text-xs px-2.5 py-0.5 rounded-md bg-[#faf7f2] border border-[#e6e0d4]">
                  {brief.briefRef}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0f766e] border border-teal-200">
                  {brief.category.name}
                </span>
                {brief.isUrgent && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-tech uppercase font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    <Flame className="w-3 h-3" />
                    Urgent
                  </span>
                )}
                {brief.isSealed && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-tech uppercase font-bold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-800 border border-stone-300">
                    <Lock className="w-3 h-3" />
                    Sealed Auction
                  </span>
                )}
              </div>
              <span className="text-xs font-tech font-bold px-3 py-1 rounded-full bg-[#111827] text-white">
                {brief.status}
              </span>
            </div>

            <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#111827] leading-tight">
              {brief.title}
            </h1>

            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
              {brief.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                <span className="text-[10px] font-tech uppercase text-stone-500 block">
                  Budget
                </span>
                <span className="font-tech font-bold text-[#111827]">
                  {formatKes(brief.budgetMin)} – {formatKes(brief.budgetMax)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                <span className="text-[10px] font-tech uppercase text-stone-500 block">
                  Length &amp; Style
                </span>
                <span className="font-tech font-bold text-[#111827]">
                  {brief.wordCount.toLocaleString()}w · {brief.citationStyle}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                <span className="text-[10px] font-tech uppercase text-stone-500 block">
                  Target Turnaround
                </span>
                <span className="font-tech font-bold text-[#111827] inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#1e3a8a]" />
                  {brief.deadlineDays} Days
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-tech uppercase text-amber-800 block">
                  Entry Fee
                </span>
                <span className="font-tech font-bold text-amber-950">
                  {brief.requiredConnects} Connects
                </span>
              </div>
            </div>
          </div>

          {/* Competitor Bid Stats */}
          <div className="editorial-card p-4 bg-[#faf7f2] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-[#1e3a8a]" />
              <span className="font-semibold text-[#111827]">
                Live Auction Telemetry ({bidStats.count} Bidders)
              </span>
            </div>
            {bidStats.avgBid !== null ? (
              <div className="flex items-center gap-4 font-tech text-stone-700">
                <span>Low: {formatKes(bidStats.minBid ?? 0)}</span>
                <span className="font-bold text-[#111827]">
                  Avg: {formatKes(bidStats.avgBid)}
                </span>
                <span>High: {formatKes(bidStats.maxBid ?? 0)}</span>
              </div>
            ) : (
              <span className="text-stone-500">
                {hasCreatorPlus
                  ? "No bids yet"
                  : "Sealed brief — unlock Creator Plus to inspect market price ranges"}
              </span>
            )}
          </div>

          {/* Client Award Options (Visible to Brief Owner) */}
          {isOwner && brief.status === "OPEN" && bids.length > 0 && (
            <div className="editorial-card p-6 bg-gradient-to-br from-blue-50/70 via-white to-amber-50/50 border-blue-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-editorial text-lg font-semibold text-[#111827]">
                  Choose How to Lock Your Winning Writer
                </h2>
                <span className="text-[11px] font-tech uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-semibold">
                  Escrow Protected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {brief.allowTripwireOutline && (
                  <button
                    type="button"
                    onClick={() => setCheckoutMode("TRIPWIRE_OUTLINE")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      checkoutMode === "TRIPWIRE_OUTLINE"
                        ? "border-[#1e3a8a] bg-blue-50 ring-2 ring-[#1e3a8a]/20"
                        : "border-[#e6e0d4] bg-white"
                    }`}
                  >
                    <span className="font-tech font-bold text-[#1e3a8a] block">
                      KES {TRIPWIRE_OUTLINE_PRICE_KES} Start
                    </span>
                    <span className="font-semibold text-[#111827] block mt-0.5">
                      First-Page Outline Tripwire
                    </span>
                    <span className="text-[11px] text-stone-500 block mt-0.5">
                      Test draft quality before full escrow.
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCheckoutMode("MILESTONE_SPLIT")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    checkoutMode === "MILESTONE_SPLIT"
                      ? "border-[#1e3a8a] bg-blue-50 ring-2 ring-[#1e3a8a]/20"
                      : "border-[#e6e0d4] bg-white"
                  }`}
                >
                  <span className="font-tech font-bold text-amber-800 block">
                    25% Deposit
                  </span>
                  <span className="font-semibold text-[#111827] block mt-0.5">
                    Milestone Split Lock
                  </span>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    Fund 25% today, 75% on review.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCheckoutMode("FULL_ESCROW")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    checkoutMode === "FULL_ESCROW"
                      ? "border-[#1e3a8a] bg-blue-50 ring-2 ring-[#1e3a8a]/20"
                      : "border-[#e6e0d4] bg-white"
                  }`}
                >
                  <span className="font-tech font-bold text-[#0f766e] block">
                    100% Escrow
                  </span>
                  <span className="font-semibold text-[#111827] block mt-0.5">
                    Full Scope Protection
                  </span>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    Single payment, full revision quota.
                  </span>
                </button>
              </div>

              {/* Order Bumps */}
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-tech uppercase tracking-wider text-stone-500">
                  Optional Quality &amp; Speed Add-Ons
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {CLIENT_CHECKOUT_ADDONS.map((addon) => {
                    const checked = selectedAddOns.includes(addon.id);
                    return (
                      <label
                        key={addon.id}
                        className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer ${
                          checked
                            ? "bg-white border-[#1e3a8a]"
                            : "bg-[#faf7f2] border-[#e6e0d4]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedAddOns((prev) =>
                              e.target.checked
                                ? [...prev, addon.id]
                                : prev.filter((x) => x !== addon.id)
                            )
                          }
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-[#111827] truncate">
                              {addon.label}
                            </span>
                            <span className="font-tech font-bold text-[#0f766e] shrink-0">
                              {addon.pricingKind === "FLAT"
                                ? `+KES ${addon.value}`
                                : `+${addon.value}%`}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Ranked Proposals List */}
          <div className="space-y-4">
            <h2 className="font-editorial text-2xl font-semibold text-[#111827]">
              Ranked Writer Proposals ({bids.length})
            </h2>

            {bids.length === 0 ? (
              <div className="editorial-card p-8 bg-white text-center text-sm text-stone-500">
                No proposals yet — be the first writer to claim the #1 rank slot!
              </div>
            ) : (
              bids.map((bid) => {
                const addOnBreakdown =
                  bid.proposedPrice !== null
                    ? calculateAddOnsTotal(bid.proposedPrice, selectedAddOns)
                    : { addOnsTotal: 0 };
                return (
                  <div
                    key={bid.id}
                    className={`editorial-card p-5 sm:p-6 space-y-4 transition-all ${
                      bid.isMyBid
                        ? "bg-gradient-to-br from-emerald-50/40 via-white to-amber-50/30 border-emerald-400 ring-1 ring-emerald-300"
                        : bid.isFeatured || bid.isTopBoostedSlot
                          ? "bg-gradient-to-br from-amber-50/50 via-white to-white border-amber-300"
                          : "bg-white"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center shrink-0">
                          <span
                            className={`w-10 h-10 rounded-xl font-tech font-bold text-sm flex items-center justify-center ${
                              bid.rankPosition === 1
                                ? "bg-amber-500 text-white shadow-sm"
                                : bid.rankPosition <= 3
                                  ? "bg-[#111827] text-white"
                                  : "bg-stone-100 text-stone-700 border border-[#e6e0d4]"
                            }`}
                          >
                            #{bid.rankPosition}
                          </span>
                          <span className="text-[10px] font-tech text-stone-400 mt-1">
                            {Math.round(bid.rankScore)} pts
                          </span>
                        </div>

                        <CreatorAvatar
                          name={bid.creator.displayName}
                          username={bid.creator.username}
                          avatarUrl={bid.creator.avatarUrl}
                          available={bid.creator.availableNow}
                          size="md"
                        />

                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/creators/${bid.creator.username}`}
                              className="font-editorial text-lg font-semibold text-[#111827] hover:text-[#1e3a8a]"
                            >
                              {bid.creator.displayName}
                            </Link>
                            {bid.creator.creatorTier === "ELITE" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                <Crown className="w-3 h-3" />
                                ELITE
                              </span>
                            )}
                            {bid.creator.creatorTier === "TOP_RATED" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-teal-50 text-[#0f766e] border border-teal-200">
                                <Award className="w-3 h-3" />
                                TOP RATED
                              </span>
                            )}
                            {bid.isTopBoostedSlot && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                <Zap className="w-3 h-3" />
                                Boosted +{bid.boostConnects}
                              </span>
                            )}
                            {bid.isFeatured && (
                              <span className="text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1e3a8a] border border-blue-200">
                                Featured Pitch
                              </span>
                            )}
                            {bid.isSealed && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-300">
                                <Lock className="w-3 h-3" />
                                Sealed
                              </span>
                            )}
                            {bid.isMyBid && (
                              <span className="text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                                Your Bid
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-stone-600">
                            {bid.creator.taglineBadge || bid.creator.headline}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-tech text-stone-600">
                            <span className="inline-flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              {bid.creator.ratingAverage.toFixed(1)} (
                              {bid.creator.completedBookingsCount} orders)
                            </span>
                            <span>
                              Rubric {Math.round(bid.creator.assessmentScore ?? 85)}%
                            </span>
                            <span>
                              {bid.creator.onTimeDeliveryRate.toFixed(0)}% on-time
                            </span>
                            <span>~{bid.creator.responseTimeMinutes}m SLA</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <p className="font-tech text-xl font-bold text-[#111827]">
                          {bid.proposedPrice !== null
                            ? formatKes(bid.proposedPrice, bid.currency)
                            : "Sealed Quote"}
                        </p>
                        <p className="text-xs font-tech text-stone-500">
                          {bid.deliveryDays} day
                          {bid.deliveryDays === 1 ? "" : "s"} turnaround
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] space-y-2 text-xs text-stone-700 leading-relaxed">
                      <p>{bid.pitch}</p>
                      {bid.sampleHook && (
                        <div className="pt-2 border-t border-[#e6e0d4]">
                          <span className="text-[10px] font-tech uppercase font-bold text-[#0f766e] block mb-1">
                            Opening Sample Hook
                          </span>
                          <p className="italic text-stone-800">
                            “{bid.sampleHook}”
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <Link
                        href={`/creators/${bid.creator.username}`}
                        className="text-xs font-semibold text-[#1e3a8a] hover:underline"
                      >
                        Inspect Standout Portfolio ({bid.creator.profileCompletenessScore}%) →
                      </Link>

                      {isOwner && brief.status === "OPEN" && (
                        <button
                          type="button"
                          disabled={awardingId === bid.id}
                          onClick={() => handleAwardBid(bid.id)}
                          className="btn-primary px-4 py-2 text-xs gap-1.5"
                        >
                          {awardingId === bid.id
                            ? "Creating Escrow..."
                            : checkoutMode === "TRIPWIRE_OUTLINE"
                              ? `Start for KES ${TRIPWIRE_OUTLINE_PRICE_KES}`
                              : checkoutMode === "MILESTONE_SPLIT"
                                ? `Award & Pay 25% Deposit`
                                : `Award Bid (${formatKes((bid.proposedPrice ?? 0) + addOnBreakdown.addOnsTotal)} + fee)`}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Sticky Column: Bid & Rank Booster Studio */}
        <aside className="lg:col-span-5 sticky top-24 space-y-5">
          {myBid ? (
            <div className="editorial-card p-6 bg-white border-2 border-amber-300 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-tech uppercase tracking-wider text-amber-800 font-bold">
                    Live Auction Rank Tracker
                  </span>
                  <h2 className="font-editorial text-2xl font-semibold text-[#111827]">
                    Rank #{myBid.rankPosition} of {myBid.totalBidders}
                  </h2>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-[#111827] text-amber-300 flex flex-col items-center justify-center font-tech">
                  <span className="text-xl font-bold leading-none">
                    #{myBid.rankPosition}
                  </span>
                  <span className="text-[9px] uppercase">Rank</span>
                </div>
              </div>

              {myBid.rankPosition === 1 ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    You hold the <strong>#1 Top Boosted Slot</strong>! You are the first writer the client sees.
                  </span>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5 text-xs">
                  <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-amber-700" />
                    Stake +{myBid.connectsNeededForRank1} Connects to overtake #1!
                  </p>
                  <button
                    type="button"
                    disabled={boosting || brief.status !== "OPEN"}
                    onClick={() =>
                      handleBoostExistingBid(myBid.connectsNeededForRank1)
                    }
                    className="w-full py-2.5 rounded-xl bg-amber-700 text-white font-semibold hover:bg-amber-800 transition-colors disabled:opacity-50"
                  >
                    {boosting
                      ? "Boosting Rank..."
                      : `Promote to #1 Now (-${myBid.connectsNeededForRank1} Connects)`}
                  </button>
                </div>
              )}

              {brief.status === "OPEN" && (
                <div className="space-y-4 pt-2 border-t border-[#e6e0d4]">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Custom Rank Boost (+Connects)
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[3, 5, 10, 20].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAddBoost(val)}
                          className={`py-1.5 rounded-lg text-xs font-tech font-bold border ${
                            addBoost === val
                              ? "bg-[#111827] text-white border-[#111827]"
                              : "bg-[#faf7f2] text-stone-700 border-[#e6e0d4]"
                          }`}
                        >
                          +{val}⚡
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={addBoost}
                      onChange={(e) => setAddBoost(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#e6e0d4] px-3 py-2 text-sm font-tech"
                    />
                  </div>

                  {(!myBid.isSealed || !myBid.isFeatured) && (
                    <div className="space-y-2 text-xs">
                      {!myBid.isSealed && (
                        <label className="flex items-center justify-between p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] cursor-pointer">
                          <span className="flex items-center gap-2 font-semibold">
                            <input
                              type="checkbox"
                              checked={upgradeSealed}
                              onChange={(e) => setUpgradeSealed(e.target.checked)}
                            />
                            Upgrade to Sealed Bid (+10 rank pts)
                          </span>
                          <span className="font-tech font-bold text-amber-800">
                            +{BID_SEALED_CONNECTS_COST}⚡
                          </span>
                        </label>
                      )}
                      {!myBid.isFeatured && (
                        <label className="flex items-center justify-between p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] cursor-pointer">
                          <span className="flex items-center gap-2 font-semibold">
                            <input
                              type="checkbox"
                              checked={upgradeFeatured}
                              onChange={(e) =>
                                setUpgradeFeatured(e.target.checked)
                              }
                            />
                            Upgrade to Featured Pitch (+25 rank pts)
                          </span>
                          <span className="font-tech font-bold text-amber-800">
                            +{BID_FEATURED_CONNECTS_COST}⚡
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={boosting}
                    onClick={() => handleBoostExistingBid()}
                    className="btn-creator w-full py-3 text-sm gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Apply Rank Promotion (-
                    {addBoost +
                      (upgradeSealed ? BID_SEALED_CONNECTS_COST : 0) +
                      (upgradeFeatured ? BID_FEATURED_CONNECTS_COST : 0)}{" "}
                    Connects)
                  </button>
                </div>
              )}
            </div>
          ) : isApprovedCreator && !isOwner && brief.status === "OPEN" ? (
            <form
              onSubmit={handleSubmitBid}
              className="editorial-card p-6 bg-white space-y-5"
            >
              <div>
                <span className="text-[11px] font-tech uppercase tracking-wider text-[#0f766e] font-bold">
                  Bid &amp; Rank Booster Studio
                </span>
                <h2 className="font-editorial text-2xl font-semibold text-[#111827]">
                  Submit Ranked Proposal
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Your Quote (KES)
                  </label>
                  <input
                    type="number"
                    min={500}
                    required
                    value={proposedPrice}
                    onChange={(e) => setProposedPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#e6e0d4] px-3 py-2 text-sm font-tech font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Delivery (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#e6e0d4] px-3 py-2 text-sm font-tech font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Proposal Strategy &amp; Credentials Pitch
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={20}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="Outline your methodology, source strategy, and why your background fits this brief..."
                  className="w-full rounded-xl border border-[#e6e0d4] px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Sample Opening Hook (Optional — doubles win rate)
                </label>
                <textarea
                  rows={2}
                  value={sampleHook}
                  onChange={(e) => setSampleHook(e.target.value)}
                  placeholder="Write a 2-sentence preview hook demonstrating your scholarly voice..."
                  className="w-full rounded-xl border border-[#e6e0d4] px-3 py-2 text-xs"
                />
              </div>

              {/* Rank Boost Simulator */}
              <div className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e6e0d4] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#111827] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    Boost Your Rank Position
                  </span>
                  <span className="font-tech font-bold text-amber-900">
                    +{boostConnects} Connects
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 5, 10, 20, 40].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setBoostConnects(v)}
                      className={`py-1.5 rounded-lg text-xs font-tech font-bold border ${
                        boostConnects === v
                          ? "bg-[#111827] text-white border-[#111827]"
                          : "bg-white text-stone-700 border-[#e6e0d4]"
                      }`}
                    >
                      +{v}⚡
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 text-xs pt-1">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSealed}
                        onChange={(e) => setIsSealed(e.target.checked)}
                      />
                      <span>Sealed Bid (Hide price from rivals)</span>
                    </span>
                    <span className="font-tech font-bold text-amber-800">
                      +{BID_SEALED_CONNECTS_COST}⚡
                    </span>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isFeatured}
                        onChange={(e) => setIsFeatured(e.target.checked)}
                      />
                      <span>Featured Gold Pitch (+25 rank pts)</span>
                    </span>
                    <span className="font-tech font-bold text-amber-800">
                      +{BID_FEATURED_CONNECTS_COST}⚡
                    </span>
                  </label>
                </div>

                {simulatedPlacement && (
                  <div className="p-3 rounded-xl bg-white border border-amber-300 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-tech uppercase text-stone-500 block">
                        Projected Live Rank
                      </span>
                      <span className="font-tech font-bold text-base text-amber-900">
                        #{simulatedPlacement.rankPosition} of{" "}
                        {simulatedPlacement.totalBidders} Bidders
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-tech uppercase text-stone-500 block">
                        Total Connects
                      </span>
                      <span className="font-tech font-bold text-base text-[#111827]">
                        {simulatedPlacement.totalCost} ⚡
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingBid}
                className="btn-creator w-full py-3.5 text-sm gap-2"
              >
                <Zap className="w-4 h-4" />
                {submittingBid
                  ? "Locking Proposal Rank..."
                  : `Submit Bid (-${simulatedPlacement?.totalCost ?? brief.requiredConnects} Connects)`}
              </button>
            </form>
          ) : (
            <div className="editorial-card p-6 bg-white space-y-4">
              <div className="flex items-center gap-2 text-xs font-tech uppercase text-[#1e3a8a] font-bold">
                <ShieldCheck className="w-4 h-4" />
                Escrow &amp; Conversion Guarantee
              </div>
              <h3 className="font-editorial text-xl font-semibold text-[#111827]">
                Zero Risk Client Protection
              </h3>
              <ul className="space-y-2.5 text-xs text-stone-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0f766e] shrink-0 mt-0.5" />
                  <span>
                    Start any awarded brief for just{" "}
                    <strong>KES {TRIPWIRE_OUTLINE_PRICE_KES}</strong> first-page
                    outline or 25% deposit.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0f766e] shrink-0 mt-0.5" />
                  <span>
                    Writers stake real Connects to prove commitment &amp; rank
                    #1.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0f766e] shrink-0 mt-0.5" />
                  <span>
                    M-Pesa STK Push &amp; Card escrow releases funds only on
                    delivery sign-off.
                  </span>
                </li>
              </ul>

              {!user && (
                <Link
                  href={`/auth?callbackUrl=${encodeURIComponent(`/bidding/${brief.id}`)}`}
                  className="btn-primary w-full py-3 text-sm"
                >
                  Sign In to Bid or Post a Brief
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
