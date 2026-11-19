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
import {
  StatusPill,
  formatCreatorTier,
  formatKes,
  formatStatusLabel,
} from "@/components/ui/Badges";
import {
  HudCard,
  HudPriceDock,
  RadarAvatar,
} from "@/components/ui/AuroraPrimitives";
import { NextStepBanner } from "@/components/ui/FlowGuide";

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

  const [proposedPrice, setProposedPrice] = useState(6500);
  const [deliveryDays, setDeliveryDays] = useState(3);
  const [pitch, setPitch] = useState("");
  const [sampleHook, setSampleHook] = useState("");
  const [boostConnects, setBoostConnects] = useState(5);
  const [isSealed, setIsSealed] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);

  const [addBoost, setAddBoost] = useState(5);
  const [upgradeSealed, setUpgradeSealed] = useState(false);
  const [upgradeFeatured, setUpgradeFeatured] = useState(false);
  const [boosting, setBoosting] = useState(false);

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
        `Offer sent! You are at #${j.data.rankPosition} of ${j.data.totalBidders}.`
      );
      await Promise.all([loadData(), refresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send offer.");
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
        `Offer position updated! You are now #${j.data.rankPosition} of ${j.data.totalBidders}.`
      );
      setUpgradeSealed(false);
      setUpgradeFeatured(false);
      await Promise.all([loadData(), refresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update position.");
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
        throw new Error(j?.error?.message || "Could not pick writer.");
      }
      router.push(`/dashboard/bookings/${j.data.booking.bookingRef}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create order.");
    } finally {
      setAwardingId(null);
    }
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading job details and writer offers...
        </div>
      </main>
    );
  }

  if (!brief) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Job Not Found
          </h1>
          <Link href="/bidding" className="btn-primary px-5 py-2.5 text-sm">
            Back to Open Jobs
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Open Jobs
        </Link>
        {isApprovedCreator && (
          <Link
            href="/creators-hub/connects"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-tech font-bold hover:bg-amber-500/25"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            Balance: {connectsBalance} Credits · Get More
          </Link>
        )}
      </div>

      {/* Role-Aware Next-Step Banner */}
      {isOwner && brief.status === "OPEN" ? (
        <NextStepBanner
          tone={bids.length > 0 ? "teal" : "blue"}
          eyebrow="Your job"
          now={
            bids.length === 0
              ? "Your job is open. Tested writers are reading it now."
              : `You have ${bids.length} writer offer${bids.length === 1 ? "" : "s"} to compare below.`
          }
          next={
            bids.length === 0
              ? "Check back shortly — writers usually reply fast."
              : "Pick how you want to pay below, then click Choose This Writer on the offer you like best."
          }
          goal="Hire the right writer safely — money is held until you approve finished work."
        />
      ) : myBid ? (
        <NextStepBanner
          tone={myBid.rankPosition === 1 ? "emerald" : "amber"}
          eyebrow="Your offer"
          now={`Your offer is at position #${myBid.rankPosition} of ${myBid.totalBidders}.`}
          next={
            myBid.rankPosition === 1
              ? "You are in the #1 spot. Wait for the client to pick a writer."
              : "You can add Credits on the right if you want to move into a higher spot."
          }
          goal="Get picked by the client and start writing."
        />
      ) : isApprovedCreator && brief.status === "OPEN" ? (
        <NextStepBanner
          tone="teal"
          eyebrow="Writer view"
          now={`This job is open and costs ${brief.requiredConnects} Credits to apply.`}
          next="Enter your price, days to finish, and a short message on the right to send your offer."
          goal="Get hired by the client and paid via M-Pesa when complete."
        />
      ) : (
        <NextStepBanner
          tone="stone"
          eyebrow="Job details"
          now={`Status: ${formatStatusLabel(brief.status)} · ${bids.length} writer offer${bids.length === 1 ? "" : "s"}.`}
          next={
            user
              ? "Read the job details and compare writer offers below."
              : "Sign in to post your own job or apply as a tested writer."
          }
          goal="Clear pricing and safe payment protection."
          actionLabel={!user ? "Sign In" : undefined}
          actionHref={!user ? `/auth?callbackUrl=${encodeURIComponent(`/bidding/${brief.id}`)}` : undefined}
        />
      )}

      {error && (
        <div className="p-4 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm flex items-start justify-between gap-3">
          <span>{error}</span>
          {(error.includes("Connects") || error.toLowerCase().includes("credit")) && (
            <Link
              href="/creators-hub/connects"
              className="shrink-0 px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold"
            >
              Get More Credits
            </Link>
          )}
        </div>
      )}

      {notice && (
        <div className="p-4 rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Job Details + Writer Offers */}
        <div className="lg:col-span-7 space-y-6">
          {/* Job HUD Card */}
          <HudCard theme="cyan" brackets className="p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-tech text-xs px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.12] text-slate-300">
                  {brief.briefRef}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-400/35">
                  {brief.category.name}
                </span>
                {brief.isUrgent && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-tech uppercase font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-400/35">
                    <Flame className="w-3 h-3" />
                    Urgent
                  </span>
                )}
                {brief.isSealed && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-tech uppercase font-bold px-2.5 py-0.5 rounded-full bg-white/[0.08] text-slate-200 border border-white/[0.16]">
                    <Lock className="w-3 h-3" />
                    Private Prices
                  </span>
                )}
              </div>
              <StatusPill status={brief.status} />
            </div>

            <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-white leading-tight">
              {brief.title}
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {brief.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.045] border border-white/[0.11]">
                <span className="text-[10px] font-tech uppercase text-slate-400 block">
                  Budget
                </span>
                <span className="font-tech font-bold text-cyan-300">
                  {formatKes(brief.budgetMin)} – {formatKes(brief.budgetMax)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.045] border border-white/[0.11]">
                <span className="text-[10px] font-tech uppercase text-slate-400 block">
                  Length &amp; Style
                </span>
                <span className="font-tech font-bold text-white">
                  {brief.wordCount.toLocaleString()}w · {brief.citationStyle}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.045] border border-white/[0.11]">
                <span className="text-[10px] font-tech uppercase text-slate-400 block">
                  Time Allowed
                </span>
                <span className="font-tech font-bold text-white inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-sky-300" />
                  {brief.deadlineDays} Days
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/35">
                <span className="text-[10px] font-tech uppercase text-amber-300 block">
                  Apply Cost
                </span>
                <span className="font-tech font-bold text-amber-200">
                  {brief.requiredConnects} Credits
                </span>
              </div>
            </div>
          </HudCard>

          {/* Offer Price Range */}
          <div className="editorial-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-sky-300" />
              <span className="font-semibold text-white">
                Offer Price Range ({bidStats.count} Writer{bidStats.count === 1 ? "" : "s"})
              </span>
            </div>
            {bidStats.avgBid !== null ? (
              <div className="flex items-center gap-4 font-tech text-slate-300">
                <span>Lowest: {formatKes(bidStats.minBid ?? 0)}</span>
                <span className="font-bold text-cyan-300">
                  Average: {formatKes(bidStats.avgBid)}
                </span>
                <span>Highest: {formatKes(bidStats.maxBid ?? 0)}</span>
              </div>
            ) : (
              <span className="text-slate-400">
                {hasCreatorPlus
                  ? "No offers yet"
                  : "Private job — upgrade to Writer Pro to see average prices"}
              </span>
            )}
          </div>

          {/* Client Payment Choice */}
          {isOwner && brief.status === "OPEN" && bids.length > 0 && (
            <div className="editorial-card p-6 border-sky-400/30 bg-sky-500/[0.07] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-editorial text-lg font-semibold text-white">
                  1. Choose How You Want to Pay
                </h2>
                <span className="text-[11px] font-tech uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-semibold">
                  Payment Held Safely
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {brief.allowTripwireOutline && (
                  <button
                    type="button"
                    onClick={() => setCheckoutMode("TRIPWIRE_OUTLINE")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      checkoutMode === "TRIPWIRE_OUTLINE"
                        ? "border-sky-400/60 bg-sky-500/20 ring-1 ring-sky-400/40"
                        : "border-white/[0.11] bg-white/[0.04]"
                    }`}
                  >
                    <span className="font-tech font-bold text-sky-300 block">
                      KES {TRIPWIRE_OUTLINE_PRICE_KES} Start
                    </span>
                    <span className="font-semibold text-white block mt-0.5">
                      Try Page 1 First
                    </span>
                    <span className="text-[11px] text-slate-300 block mt-0.5">
                      Check the first page before paying for the whole job.
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCheckoutMode("MILESTONE_SPLIT")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    checkoutMode === "MILESTONE_SPLIT"
                      ? "border-amber-400/60 bg-amber-500/20 ring-1 ring-amber-400/40"
                      : "border-white/[0.11] bg-white/[0.04]"
                  }`}
                >
                  <span className="font-tech font-bold text-amber-300 block">
                    25% Deposit
                  </span>
                  <span className="font-semibold text-white block mt-0.5">
                    Pay 25% Deposit Now
                  </span>
                  <span className="text-[11px] text-slate-300 block mt-0.5">
                    Pay 25% today, pay the rest after the first draft arrives.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCheckoutMode("FULL_ESCROW")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    checkoutMode === "FULL_ESCROW"
                      ? "border-teal-400/60 bg-teal-500/20 ring-1 ring-teal-400/40"
                      : "border-white/[0.11] bg-white/[0.04]"
                  }`}
                >
                  <span className="font-tech font-bold text-teal-300 block">
                    100% Full
                  </span>
                  <span className="font-semibold text-white block mt-0.5">
                    Pay Full Amount
                  </span>
                  <span className="text-[11px] text-slate-300 block mt-0.5">
                    Pay all upfront, held safely until you approve.
                  </span>
                </button>
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-tech uppercase tracking-wider text-slate-400">
                  Optional Extras
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {CLIENT_CHECKOUT_ADDONS.map((addon) => {
                    const checked = selectedAddOns.includes(addon.id);
                    return (
                      <label
                        key={addon.id}
                        className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer ${
                          checked
                            ? "bg-sky-500/15 border-sky-400/50"
                            : "bg-white/[0.04] border-white/[0.11]"
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
                          className="mt-0.5 accent-cyan-400"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-white truncate">
                              {addon.label}
                            </span>
                            <span className="font-tech font-bold text-teal-300 shrink-0">
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

          {/* Writer Offers List */}
          <div className="space-y-4">
            <h2 className="font-editorial text-2xl font-semibold text-white">
              Writer Offers ({bids.length})
            </h2>

            {bids.length === 0 ? (
              <div className="editorial-card p-8 text-center text-sm text-slate-400">
                No offers yet — be the first writer to send one!
              </div>
            ) : (
              bids.map((bid) => {
                const addOnBreakdown =
                  bid.proposedPrice !== null
                    ? calculateAddOnsTotal(bid.proposedPrice, selectedAddOns)
                    : { addOnsTotal: 0 };
                const cardTheme = bid.isMyBid
                  ? "emerald"
                  : bid.isFeatured || bid.isTopBoostedSlot
                    ? "amber"
                    : "sky";
                return (
                  <HudCard
                    key={bid.id}
                    theme={cardTheme}
                    brackets
                    className="p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center shrink-0">
                          <span
                            className={`w-10 h-10 rounded-xl font-tech font-bold text-sm flex items-center justify-center border ${
                              bid.rankPosition === 1
                                ? "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.45)]"
                                : bid.rankPosition <= 3
                                  ? "bg-sky-400/20 text-sky-200 border-sky-400/45"
                                  : "bg-white/[0.06] text-slate-300 border-white/[0.14]"
                            }`}
                          >
                            #{bid.rankPosition}
                          </span>
                          <span className="text-[10px] font-tech text-slate-400 mt-1">
                            {Math.round(bid.rankScore)} pts
                          </span>
                        </div>

                        <RadarAvatar
                          name={bid.creator.displayName}
                          avatarUrl={bid.creator.avatarUrl}
                          available={bid.creator.availableNow}
                          theme={cardTheme}
                          size="md"
                        />

                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/creators/${bid.creator.username}`}
                              className="font-editorial text-lg font-semibold text-white hover:text-cyan-300"
                            >
                              {bid.creator.displayName}
                            </Link>
                            {bid.creator.creatorTier === "ELITE" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/35">
                                <Crown className="w-3 h-3" />
                                {formatCreatorTier("ELITE")}
                              </span>
                            )}
                            {bid.creator.creatorTier === "TOP_RATED" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-400/35">
                                <Award className="w-3 h-3" />
                                {formatCreatorTier("TOP_RATED")}
                              </span>
                            )}
                            {bid.isTopBoostedSlot && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/35">
                                <Zap className="w-3 h-3" />
                                Boosted +{bid.boostConnects}
                              </span>
                            )}
                            {bid.isFeatured && (
                              <span className="text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/35">
                                Featured Offer
                              </span>
                            )}
                            {bid.isSealed && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-200 border border-white/[0.16]">
                                <Lock className="w-3 h-3" />
                                Private Price
                              </span>
                            )}
                            {bid.isMyBid && (
                              <span className="text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950">
                                Your Offer
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-300">
                            {bid.creator.taglineBadge || bid.creator.headline}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-tech text-slate-400">
                            <span className="inline-flex items-center gap-1 text-slate-200">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              {bid.creator.ratingAverage.toFixed(1)} (
                              {bid.creator.completedBookingsCount} orders)
                            </span>
                            <span>
                              Test score {Math.round(bid.creator.assessmentScore ?? 85)}%
                            </span>
                            <span>
                              {bid.creator.onTimeDeliveryRate.toFixed(0)}% on time
                            </span>
                            <span>Replies in ~{bid.creator.responseTimeMinutes}m</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <HudPriceDock
                          label={`${bid.deliveryDays}d delivery`}
                          price={
                            bid.proposedPrice !== null
                              ? formatKes(bid.proposedPrice, bid.currency)
                              : "Private Price"
                          }
                          theme={cardTheme}
                          size="sm"
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.1] space-y-2 text-xs text-slate-200 leading-relaxed">
                      <p>{bid.pitch}</p>
                      {bid.sampleHook && (
                        <div className="pt-2 border-t border-white/[0.1]">
                          <span className="text-[10px] font-tech uppercase font-bold text-teal-300 block mb-1">
                            Opening Sample
                          </span>
                          <p className="italic text-white">
                            &ldquo;{bid.sampleHook}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <Link
                        href={`/creators/${bid.creator.username}`}
                        className="text-xs font-semibold text-sky-300 hover:underline"
                      >
                        See Writer Profile ({bid.creator.profileCompletenessScore}% complete) →
                      </Link>

                      {isOwner && brief.status === "OPEN" && (
                        <button
                          type="button"
                          disabled={awardingId === bid.id}
                          onClick={() => handleAwardBid(bid.id)}
                          className="btn-primary px-4 py-2 text-xs gap-1.5"
                        >
                          {awardingId === bid.id
                            ? "Creating Order..."
                            : checkoutMode === "TRIPWIRE_OUTLINE"
                              ? `Choose Writer · Start for KES ${TRIPWIRE_OUTLINE_PRICE_KES}`
                              : checkoutMode === "MILESTONE_SPLIT"
                                ? `Choose Writer · Pay 25% Now`
                                : `Choose This Writer (${formatKes((bid.proposedPrice ?? 0) + addOnBreakdown.addOnsTotal)} + fee)`}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </HudCard>
                );
              })
            )}
          </div>
        </div>

        {/* Right Sticky Column */}
        <aside className="lg:col-span-5 sticky top-24 space-y-5">
          {myBid ? (
            <HudCard theme="amber" brackets className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-tech uppercase tracking-wider text-amber-300 font-bold">
                    Your Offer Position
                  </span>
                  <h2 className="font-editorial text-2xl font-semibold text-white">
                    Position #{myBid.rankPosition} of {myBid.totalBidders}
                  </h2>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/50 text-amber-300 flex flex-col items-center justify-center font-tech">
                  <span className="text-xl font-bold leading-none">
                    #{myBid.rankPosition}
                  </span>
                  <span className="text-[9px] uppercase">Spot</span>
                </div>
              </div>

              {myBid.rankPosition === 1 ? (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-xs text-emerald-200 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>
                    You are in the <strong className="text-white">#1 Top Spot</strong>! Clients see
                    your offer first.
                  </span>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-400/35 space-y-2.5 text-xs">
                  <p className="font-semibold text-amber-200 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-amber-300" />
                    Use +{myBid.connectsNeededForRank1} Credits to take the #1 spot!
                  </p>
                  <button
                    type="button"
                    disabled={boosting || brief.status !== "OPEN"}
                    onClick={() =>
                      handleBoostExistingBid(myBid.connectsNeededForRank1)
                    }
                    className="btn-amber w-full py-2.5 text-xs disabled:opacity-50"
                  >
                    {boosting
                      ? "Moving up..."
                      : `Move to #1 Now (-${myBid.connectsNeededForRank1} Credits)`}
                  </button>
                </div>
              )}

              {brief.status === "OPEN" && (
                <div className="space-y-4 pt-2 border-t border-white/[0.1]">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Add Credits to Move Up (+Credits)
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[3, 5, 10, 20].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAddBoost(val)}
                          className={`py-1.5 rounded-lg text-xs font-tech font-bold border ${
                            addBoost === val
                              ? "bg-amber-400/20 text-amber-200 border-amber-400/60"
                              : "bg-white/[0.045] text-slate-300 border-white/[0.12]"
                          }`}
                        >
                          +{val} Credits
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={addBoost}
                      onChange={(e) => setAddBoost(Number(e.target.value))}
                      className="hud-input w-full px-3 py-2 text-sm font-tech"
                    />
                  </div>

                  {(!myBid.isSealed || !myBid.isFeatured) && (
                    <div className="space-y-2 text-xs">
                      {!myBid.isSealed && (
                        <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.045] border border-white/[0.12] cursor-pointer text-slate-200">
                          <span className="flex items-center gap-2 font-semibold">
                            <input
                              type="checkbox"
                              checked={upgradeSealed}
                              onChange={(e) => setUpgradeSealed(e.target.checked)}
                              className="accent-cyan-400"
                            />
                            Hide my price from other writers (+10 pts)
                          </span>
                          <span className="font-tech font-bold text-amber-300">
                            +{BID_SEALED_CONNECTS_COST}
                          </span>
                        </label>
                      )}
                      {!myBid.isFeatured && (
                        <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.045] border border-white/[0.12] cursor-pointer text-slate-200">
                          <span className="flex items-center gap-2 font-semibold">
                            <input
                              type="checkbox"
                              checked={upgradeFeatured}
                              onChange={(e) =>
                                setUpgradeFeatured(e.target.checked)
                              }
                              className="accent-amber-400"
                            />
                            Highlight my offer in gold (+25 pts)
                          </span>
                          <span className="font-tech font-bold text-amber-300">
                            +{BID_FEATURED_CONNECTS_COST}
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
                    Move Offer Up (-
                    {addBoost +
                      (upgradeSealed ? BID_SEALED_CONNECTS_COST : 0) +
                      (upgradeFeatured ? BID_FEATURED_CONNECTS_COST : 0)}{" "}
                    Credits)
                  </button>
                </div>
              )}
            </HudCard>
          ) : isApprovedCreator && !isOwner && brief.status === "OPEN" ? (
            <HudCard theme="cyan" brackets className="p-6">
              <form onSubmit={handleSubmitBid} className="space-y-5">
                <div>
                  <span className="text-[11px] font-tech uppercase tracking-wider text-teal-300 font-bold">
                    Apply for This Job
                  </span>
                  <h2 className="font-editorial text-2xl font-semibold text-white">
                    Send Your Offer
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1">
                      Your Price (KES)
                    </label>
                    <input
                      type="number"
                      min={500}
                      required
                      value={proposedPrice}
                      onChange={(e) => setProposedPrice(Number(e.target.value))}
                      className="hud-input w-full px-3 py-2 text-sm font-tech font-bold"
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
                      required
                      value={deliveryDays}
                      onChange={(e) => setDeliveryDays(Number(e.target.value))}
                      className="hud-input w-full px-3 py-2 text-sm font-tech font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Why should the client pick you?
                  </label>
                  <textarea
                    rows={4}
                    required
                    minLength={20}
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    placeholder="Share how you will handle the topic, your experience, and what you will include..."
                    className="hud-input w-full px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Short Opening Sample (Optional — helps you win)
                  </label>
                  <textarea
                    rows={2}
                    value={sampleHook}
                    onChange={(e) => setSampleHook(e.target.value)}
                    placeholder="Write 2 opening sentences to show the client your writing style..."
                    className="hud-input w-full px-3 py-2 text-xs"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.045] border border-white/[0.11] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      Show Higher Up (Optional)
                    </span>
                    <span className="font-tech font-bold text-amber-300">
                      +{boostConnects} Credits
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
                            ? "bg-amber-400/20 text-amber-200 border-amber-400/60"
                            : "bg-white/[0.05] text-slate-300 border-white/[0.12]"
                        }`}
                      >
                        +{v}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5 text-xs pt-1 text-slate-200">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSealed}
                          onChange={(e) => setIsSealed(e.target.checked)}
                          className="accent-cyan-400"
                        />
                        <span>Hide my price from other writers</span>
                      </span>
                      <span className="font-tech font-bold text-amber-300">
                        +{BID_SEALED_CONNECTS_COST} Credits
                      </span>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isFeatured}
                          onChange={(e) => setIsFeatured(e.target.checked)}
                          className="accent-amber-400"
                        />
                        <span>Highlight offer in gold (+25 pts)</span>
                      </span>
                      <span className="font-tech font-bold text-amber-300">
                        +{BID_FEATURED_CONNECTS_COST} Credits
                      </span>
                    </label>
                  </div>

                  {simulatedPlacement && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-tech uppercase text-slate-300 block">
                          Expected Position
                        </span>
                        <span className="font-tech font-bold text-base text-amber-300">
                          #{simulatedPlacement.rankPosition} of{" "}
                          {simulatedPlacement.totalBidders} Writers
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-tech uppercase text-slate-300 block">
                          Total Credits
                        </span>
                        <span className="font-tech font-bold text-base text-white">
                          {simulatedPlacement.totalCost} Credits
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
                    ? "Sending Offer..."
                    : `Send Offer (-${simulatedPlacement?.totalCost ?? brief.requiredConnects} Credits)`}
                </button>
              </form>
            </HudCard>
          ) : (
            <HudCard theme="sky" brackets className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-tech uppercase text-sky-300 font-bold">
                <ShieldCheck className="w-4 h-4" />
                Safe Ordering Promise
              </div>
              <h3 className="font-editorial text-xl font-semibold text-white">
                How Clients Stay Protected
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-300 shrink-0 mt-0.5" />
                  <span>
                    Start small with{" "}
                    <strong className="text-white">KES {TRIPWIRE_OUTLINE_PRICE_KES}</strong> for Page 1
                    or a 25% deposit.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-300 shrink-0 mt-0.5" />
                  <span>
                    Every writer here has passed our writing test before they can
                    apply.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-300 shrink-0 mt-0.5" />
                  <span>
                    M-Pesa and Card payments are held safely until you approve
                    the finished work.
                  </span>
                </li>
              </ul>

              {!user && (
                <Link
                  href={`/auth?callbackUrl=${encodeURIComponent(`/bidding/${brief.id}`)}`}
                  className="btn-primary w-full py-3 text-sm"
                >
                  Sign In to Apply or Post a Job
                </Link>
              )}
            </HudCard>
          )}
        </aside>
      </div>
    </main>
  );
}
