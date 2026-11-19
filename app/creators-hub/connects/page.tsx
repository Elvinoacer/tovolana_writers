"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  CreditCard,
  Crown,
  Flame,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { CreatorShell } from "@/components/CreatorShell";
import { useAuth } from "@/components/AuthContext";
import {
  formatConnectTxType,
  formatCreatorTier,
  formatKes,
  formatShortDate,
} from "@/components/ui/Badges";
import {
  HudBadge,
  HudCard,
  HudPriceDock,
} from "@/components/ui/AuroraPrimitives";
import type { HudThemeKey } from "@/lib/design-tokens";

interface ConnectsBundleItem {
  id: "starter" | "growth" | "studio" | "agency";
  name: string;
  baseConnects: number;
  bonusConnects: number;
  totalConnects: number;
  priceKes: number;
  badge?: string;
  tagline: string;
}

interface ConnectsData {
  balance: number;
  totalConnectsSpent: number;
  creatorTier: string;
  boosts: {
    availableNowActive: boolean;
    availableNowBadgeUntil: string | null;
    featuredProfileActive: boolean;
    featuredProfileUntil: string | null;
    creatorPlusActive: boolean;
    creatorPlusUntil: string | null;
  };
  standoutReport: {
    score: number;
    tierRecommendation: string;
  };
  bundles: ConnectsBundleItem[];
  availableEarningsBalance: number;
  earningsRateKes: number;
  boostCosts: {
    AVAILABLE_NOW: number;
    FEATURED_PROFILE: number;
    CREATOR_PLUS: number;
  };
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }>;
}

const BUNDLE_THEMES: Record<ConnectsBundleItem["id"], HudThemeKey> = {
  starter: "cyan",
  growth: "amber",
  studio: "violet",
  agency: "emerald",
};

export default function CreatorConnectsStorePage() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState<ConnectsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<"MPESA_STK" | "CARD">("MPESA_STK");
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const phone = phoneOverride ?? user?.phone ?? "";
  const [swapCount, setSwapCount] = useState(20);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<{
    apiRef: string;
    bundleName: string;
    amount: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConnects = useCallback(async () => {
    try {
      const res = await fetch("/api/creators-hub/connects", {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        setData(j.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnects();
  }, [loadConnects]);

  async function handleBuyBundle(
    bundle: ConnectsBundleItem,
    autoCompleteSandbox: boolean = false
  ) {
    setError(null);
    setNotice(null);
    setBusyKey(`bundle:${bundle.id}`);
    try {
      const res = await fetch("/api/creators-hub/connects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BUY_BUNDLE",
          bundleId: bundle.id,
          channel,
          phone: channel === "MPESA_STK" ? phone : undefined,
          autoCompleteSandbox,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || "Could not buy credits.");
      }
      if (j.data.credited) {
        setNotice(
          `+${bundle.totalConnects} Credits added! New balance: ${j.data.balance} Credits.`
        );
        setPendingTx(null);
        await Promise.all([loadConnects(), refresh()]);
      } else if (j.data.checkoutUrl && j.data.mode === "LIVE_INTASEND") {
        window.location.assign(j.data.checkoutUrl);
      } else {
        setPendingTx({
          apiRef: j.data.transaction.apiRef,
          bundleName: bundle.name,
          amount: bundle.priceKes,
        });
        setNotice(
          `Payment request sent (${j.data.transaction.apiRef}). Complete it or click Test Mode below.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSimulatePending() {
    if (!pendingTx) return;
    setBusyKey("simulate");
    setError(null);
    try {
      const res = await fetch("/api/payments/simulate-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiRef: pendingTx.apiRef, state: "COMPLETE" }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || "Test confirmation failed.");
      }
      setNotice(`Demo payment done — ${pendingTx.bundleName} credits added!`);
      setPendingTx(null);
      await Promise.all([loadConnects(), refresh()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not complete demo payment."
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSwapEarnings(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusyKey("swap");
    try {
      const res = await fetch("/api/creators-hub/connects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SWAP_EARNINGS",
          connectsCount: Number(swapCount),
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || "Swap failed.");
      }
      setNotice(
        `Swapped ${formatKes(j.data.deductedKes)} earnings for +${swapCount} Credits!`
      );
      await Promise.all([loadConnects(), refresh()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not swap earnings."
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleActivateBoost(
    boostType: "AVAILABLE_NOW" | "FEATURED_PROFILE" | "CREATOR_PLUS"
  ) {
    setError(null);
    setNotice(null);
    setBusyKey(`boost:${boostType}`);
    try {
      const res = await fetch("/api/creators-hub/connects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACTIVATE_BOOST", boostType }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || "Could not turn on boost.");
      }
      setNotice(
        `Boost active! Level: ${formatCreatorTier(j.data.creatorTier)} · Credits left: ${j.data.balance}.`
      );
      await Promise.all([loadConnects(), refresh()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not turn on boost."
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <CreatorShell
      title="Credits & Boosts"
      subtitle="Use Bid Credits to apply for Open Jobs, highlight your offers, or boost your writer profile."
    >
      {error && (
        <div className="p-4 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-4 rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
          <span>{notice}</span>
        </div>
      )}

      {loading || !data ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading your credits and boosts...
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <HudCard theme="amber" brackets className="p-5 space-y-1">
              <span className="text-xs text-amber-200 font-medium flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-300" />
                Credits Left
              </span>
              <p className="font-tech text-3xl font-bold text-white">
                {data.balance}
              </p>
            </HudCard>
            <div className="editorial-card p-5 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-teal-300" />
                Writer Level
              </span>
              <p className="font-tech text-2xl font-bold text-white">
                {formatCreatorTier(data.creatorTier)}
              </p>
            </div>
            <div className="editorial-card p-5 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-300" />
                Profile Strength
              </span>
              <p className="font-tech text-2xl font-bold text-sky-300">
                {data.standoutReport.score}%
              </p>
            </div>
            <div className="editorial-card p-5 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-rose-300" />
                Credits Used
              </span>
              <p className="font-tech text-2xl font-bold text-white">
                {data.totalConnectsSpent}
              </p>
            </div>
          </div>

          {/* Pending Demo Payment Confirmation */}
          {pendingTx && (
            <HudCard
              theme="sky"
              brackets
              className="p-5 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="text-xs text-sky-100 space-y-1">
                <p className="font-semibold text-white">
                  Waiting for Payment: {pendingTx.apiRef}
                </p>
                <p className="text-sky-200/90">
                  {pendingTx.bundleName} · {formatKes(pendingTx.amount)}
                </p>
              </div>
              <button
                type="button"
                disabled={busyKey === "simulate"}
                onClick={handleSimulatePending}
                className="btn-primary px-4 py-2 text-xs"
              >
                Mark Payment Complete (Demo)
              </button>
            </HudCard>
          )}

          {/* Buy Credit Packs */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-white">
                  Buy Bid Credit Packs
                </h2>
                <p className="text-xs text-slate-400">
                  Apply for Open Jobs, boost your offers higher, and unlock
                  profile badges.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <button
                  type="button"
                  onClick={() => setChannel("MPESA_STK")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold transition-all ${
                    channel === "MPESA_STK"
                      ? "bg-teal-500/20 text-teal-100 border-teal-400/50"
                      : "bg-white/[0.05] text-slate-300 border-white/[0.12] hover:text-white"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  M-Pesa
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("CARD")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold transition-all ${
                    channel === "CARD"
                      ? "bg-sky-500/20 text-sky-100 border-sky-400/50"
                      : "bg-white/[0.05] text-slate-300 border-white/[0.12] hover:text-white"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Card
                </button>
                {channel === "MPESA_STK" && (
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhoneOverride(e.target.value)}
                    placeholder="0712345678"
                    className="hud-input w-36 py-1.5 font-tech"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.bundles.map((bundle) => {
                const theme = BUNDLE_THEMES[bundle.id] ?? "cyan";
                return (
                  <HudCard
                    key={bundle.id}
                    theme={theme}
                    brackets={bundle.id === "growth"}
                    dotMatrix={bundle.id === "growth" ? "right" : "none"}
                    className="p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-editorial text-lg font-semibold text-white">
                          {bundle.name}
                        </span>
                        {bundle.badge && <HudBadge label={bundle.badge} />}
                      </div>
                      <p className="font-tech text-3xl font-bold text-white">
                        {bundle.totalConnects}{" "}
                        <span className="text-sm font-normal text-amber-300">
                          Credits
                        </span>
                      </p>
                      <HudPriceDock
                        label={`KES ${(bundle.priceKes / bundle.totalConnects).toFixed(1)}/CREDIT`}
                        price={formatKes(bundle.priceKes)}
                        theme={theme}
                        size="sm"
                        className="w-full"
                      />
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {bundle.tagline}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={busyKey === `bundle:${bundle.id}`}
                        onClick={() => handleBuyBundle(bundle, false)}
                        className="btn-primary w-full py-2.5 text-xs"
                      >
                        Buy for {formatKes(bundle.priceKes)}
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === `bundle:${bundle.id}`}
                        onClick={() => handleBuyBundle(bundle, true)}
                        className="w-full py-2 rounded-xl border border-white/[0.12] bg-white/[0.04] text-[11px] font-semibold text-slate-300 hover:bg-white/[0.09] hover:text-white transition-colors"
                      >
                        Test Mode: Add Free Credits (Demo)
                      </button>
                    </div>
                  </HudCard>
                );
              })}
            </div>
          </section>

          {/* Swap Earnings + Profile Boosts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Swap Earnings */}
            <HudCard theme="emerald" className="lg:col-span-5 p-6">
              <form onSubmit={handleSwapEarnings} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-editorial text-xl font-semibold text-white">
                    Trade Earnings for Credits
                  </h2>
                  <RefreshCw className="w-4 h-4 text-teal-300" />
                </div>
                <p className="text-xs text-slate-300">
                  Turn your finished-order balance into credits right away at{" "}
                  <strong className="text-white">
                    KES {data.earningsRateKes} per Credit
                  </strong>
                  .
                </p>
                <div className="p-3.5 rounded-xl bg-teal-500/15 border border-teal-400/35 flex items-center justify-between text-xs">
                  <span className="text-teal-200 font-medium">
                    Available Earnings
                  </span>
                  <span className="font-tech font-bold text-teal-300">
                    {formatKes(data.availableEarningsBalance)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    How many Credits? (Min 10)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    value={swapCount}
                    onChange={(e) => setSwapCount(Number(e.target.value))}
                    className="hud-input font-tech font-bold"
                  />
                  <p className="text-[11px] font-tech text-slate-400 mt-1">
                    Cost from balance:{" "}
                    {formatKes(swapCount * data.earningsRateKes)}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={
                    busyKey === "swap" ||
                    data.availableEarningsBalance <
                      swapCount * data.earningsRateKes
                  }
                  className="btn-creator w-full py-2.5 text-xs disabled:opacity-50"
                >
                  Use {formatKes(swapCount * data.earningsRateKes)} → +
                  {swapCount} Credits
                </button>
              </form>
            </HudCard>

            {/* Profile Boosts */}
            <HudCard theme="violet" className="lg:col-span-7 p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="font-editorial text-xl font-semibold text-white">
                    Profile Boosts
                  </h2>
                  <p className="text-xs text-slate-400">
                    Help clients spot you faster and lift your offer position on
                    Open Jobs.
                  </p>
                </div>
                <Link
                  href="/creators-hub/profile"
                  className="text-xs font-semibold text-teal-300 hover:underline"
                >
                  Edit Profile ({data.standoutReport.score}%) →
                </Link>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white/[0.045] border border-white/[0.11] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-300" />
                      Available Now Badge (7 Days)
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Shows clients you are ready right now (+10% Profile
                      Strength).
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyKey === "boost:AVAILABLE_NOW"}
                    onClick={() => handleActivateBoost("AVAILABLE_NOW")}
                    className="btn-ghost px-4 py-2 text-xs font-semibold shrink-0"
                  >
                    {data.boosts.availableNowActive
                      ? "Extend (+5 Credits)"
                      : `Turn On (${data.boostCosts.AVAILABLE_NOW} Credits)`}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.045] border border-white/[0.11] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-white flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-sky-300" />
                      Featured Profile Spotlight (7 Days)
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Highlights your profile on Find Writers and boosts every
                      job offer (+20 pts).
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyKey === "boost:FEATURED_PROFILE"}
                    onClick={() => handleActivateBoost("FEATURED_PROFILE")}
                    className="btn-primary px-4 py-2 text-xs shrink-0"
                  >
                    {data.boosts.featuredProfileActive
                      ? "Extend (+15 Credits)"
                      : `Turn On (${data.boostCosts.FEATURED_PROFILE} Credits)`}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/[0.1] border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-amber-200 flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-300" />
                      Writer Plus Pass (30 Days)
                    </p>
                    <p className="text-xs text-amber-100/85 mt-0.5">
                      Cuts job fee in half (10% to 5%), gives Top Writer
                      priority (+40 pts), and lets you see average offer prices.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyKey === "boost:CREATOR_PLUS"}
                    onClick={() => handleActivateBoost("CREATOR_PLUS")}
                    className="btn-amber px-4 py-2 text-xs font-semibold shrink-0"
                  >
                    {data.boosts.creatorPlusActive
                      ? "Extend (+60 Credits)"
                      : `Get Pass (${data.boostCosts.CREATOR_PLUS} Credits)`}
                  </button>
                </div>
              </div>
            </HudCard>
          </div>

          {/* Credit History */}
          <div className="editorial-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-xl font-semibold text-white">
                Credit History
              </h2>
              <Link
                href="/bidding"
                className="text-xs font-semibold text-cyan-300 hover:underline inline-flex items-center gap-1"
              >
                Apply on Open Jobs
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {data.transactions.length === 0 ? (
              <p className="text-xs text-slate-400">No credit activity yet.</p>
            ) : (
              <div className="divide-y divide-white/[0.08] text-xs">
                {data.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {tx.description}
                      </p>
                      <p className="text-slate-400 font-tech text-[11px]">
                        {formatConnectTxType(tx.type)} ·{" "}
                        {formatShortDate(tx.createdAt)}
                      </p>
                    </div>
                    <div className="text-right font-tech shrink-0">
                      <p
                        className={`font-bold text-sm ${
                          tx.amount >= 0 ? "text-teal-300" : "text-rose-300"
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Left: {tx.balanceAfter}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </CreatorShell>
  );
}
