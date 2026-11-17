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
import { formatKes, formatShortDate } from "@/components/ui/Badges";

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
        throw new Error(j?.error?.message || "Connects purchase failed.");
      }
      if (j.data.credited) {
        setNotice(
          `+${bundle.totalConnects} Connects credited! New balance: ${j.data.balance} Connects.`
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
          `IntaSend checkout initiated (${j.data.transaction.apiRef}). Complete payment or simulate sandbox webhook below.`
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
        throw new Error(j?.error?.message || "Webhook simulation failed.");
      }
      setNotice(`Sandbox webhook settled ${pendingTx.bundleName}!`);
      setPendingTx(null);
      await Promise.all([loadConnects(), refresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation error.");
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
        `Swapped ${formatKes(j.data.deductedKes)} earnings for +${swapCount} Connects!`
      );
      await Promise.all([loadConnects(), refresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap error.");
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
        throw new Error(j?.error?.message || "Boost activation failed.");
      }
      setNotice(
        `Boost activated! Tier: ${j.data.creatorTier} · Remaining balance: ${j.data.balance} Connects.`
      );
      await Promise.all([loadConnects(), refresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Boost error.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <CreatorShell
      title="Connects Store & Standout Boosters"
      subtitle="Power #1 boosted proposal ranks, activate Elite profile visibility, or swap cleared earnings for Connects."
    >
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {loading || !data ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Connects wallet and boost inventory...
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="editorial-card p-5 bg-gradient-to-br from-amber-50 to-white border-amber-200 space-y-1">
              <span className="text-xs text-amber-900 font-medium flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600" />
                Available Connects
              </span>
              <p className="font-tech text-3xl font-bold text-amber-950">
                {data.balance}
              </p>
            </div>
            <div className="editorial-card p-5 bg-white space-y-1">
              <span className="text-xs text-stone-500 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[#0f766e]" />
                Creator Rank Tier
              </span>
              <p className="font-tech text-2xl font-bold text-[#111827]">
                {data.creatorTier.replace(/_/g, " ")}
              </p>
            </div>
            <div className="editorial-card p-5 bg-white space-y-1">
              <span className="text-xs text-stone-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#1e3a8a]" />
                Standout Score
              </span>
              <p className="font-tech text-2xl font-bold text-[#1e3a8a]">
                {data.standoutReport.score}%
              </p>
            </div>
            <div className="editorial-card p-5 bg-white space-y-1">
              <span className="text-xs text-stone-500 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-rose-600" />
                Connects Invested
              </span>
              <p className="font-tech text-2xl font-bold text-[#111827]">
                {data.totalConnectsSpent}
              </p>
            </div>
          </div>

          {/* Pending Sandbox Webhook Simulation */}
          {pendingTx && (
            <div className="editorial-card p-5 bg-blue-50/70 border-blue-300 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-blue-950 space-y-1">
                <p className="font-semibold">
                  Pending IntaSend Transaction: {pendingTx.apiRef}
                </p>
                <p>
                  {pendingTx.bundleName} · {formatKes(pendingTx.amount)}
                </p>
              </div>
              <button
                type="button"
                disabled={busyKey === "simulate"}
                onClick={handleSimulatePending}
                className="btn-primary px-4 py-2 text-xs"
              >
                Simulate IntaSend COMPLETE Webhook
              </button>
            </div>
          )}

          {/* Buy Connects Bundles */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-[#111827]">
                  Buy Connects Bundles (IntaSend M-Pesa / Card)
                </h2>
                <p className="text-xs text-stone-600">
                  Win #1 boosted slots on open briefs and unlock high-converting profile badges.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setChannel("MPESA_STK")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold ${
                    channel === "MPESA_STK"
                      ? "bg-[#0f766e] text-white border-[#0f766e]"
                      : "bg-white text-stone-700 border-[#e6e0d4]"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  M-Pesa STK
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("CARD")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold ${
                    channel === "CARD"
                      ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                      : "bg-white text-stone-700 border-[#e6e0d4]"
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
                    className="w-36 rounded-xl border border-[#e6e0d4] px-3 py-1.5 font-tech bg-white"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.bundles.map((bundle) => (
                <div
                  key={bundle.id}
                  className={`editorial-card p-5 flex flex-col justify-between space-y-4 ${
                    bundle.id === "growth"
                      ? "bg-gradient-to-br from-amber-50/70 via-white to-white border-amber-300 ring-1 ring-amber-200"
                      : "bg-white"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-editorial text-lg font-semibold text-[#111827]">
                        {bundle.name}
                      </span>
                      {bundle.badge && (
                        <span className="text-[10px] font-tech uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          {bundle.badge}
                        </span>
                      )}
                    </div>
                    <p className="font-tech text-3xl font-bold text-[#111827]">
                      {bundle.totalConnects}{" "}
                      <span className="text-sm font-normal text-amber-700">
                        Connects
                      </span>
                    </p>
                    <p className="text-xs font-tech text-[#0f766e] font-semibold">
                      {formatKes(bundle.priceKes)} · KES{" "}
                      {(bundle.priceKes / bundle.totalConnects).toFixed(1)}/⚡
                    </p>
                    <p className="text-xs text-stone-600 leading-relaxed">
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
                      Pay {formatKes(bundle.priceKes)} via IntaSend
                    </button>
                    <button
                      type="button"
                      disabled={busyKey === `bundle:${bundle.id}`}
                      onClick={() => handleBuyBundle(bundle, true)}
                      className="w-full py-2 rounded-xl border border-[#e6e0d4] bg-[#faf7f2] text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
                    >
                      Sandbox Instant Test Credit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Instant Earnings Swap + Profile Boosters */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Swap Earnings */}
            <form
              onSubmit={handleSwapEarnings}
              className="lg:col-span-5 editorial-card p-6 bg-white space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-editorial text-xl font-semibold">
                  Swap Earnings for Connects
                </h2>
                <RefreshCw className="w-4 h-4 text-[#0f766e]" />
              </div>
              <p className="text-xs text-stone-600">
                Convert cleared escrow earnings instantly at{" "}
                <strong>KES {data.earningsRateKes} / Connect</strong> with zero
                withdrawal wait.
              </p>
              <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 flex items-center justify-between text-xs">
                <span className="text-teal-900 font-medium">
                  Available Escrow Balance
                </span>
                <span className="font-tech font-bold text-[#0f766e]">
                  {formatKes(data.availableEarningsBalance)}
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Connects to Mint (Min 10)
                </label>
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={swapCount}
                  onChange={(e) => setSwapCount(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#e6e0d4] px-3.5 py-2.5 text-sm font-tech font-bold"
                />
                <p className="text-[11px] font-tech text-stone-500 mt-1">
                  Cost: {formatKes(swapCount * data.earningsRateKes)}
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
                Convert {formatKes(swapCount * data.earningsRateKes)} → +
                {swapCount} Connects
              </button>
            </form>

            {/* Standout Profile Boosters */}
            <div className="lg:col-span-7 editorial-card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="font-editorial text-xl font-semibold">
                    Standout Profile &amp; Rank Boosters
                  </h2>
                  <p className="text-xs text-stone-600">
                    Raise your organic rank score on every bid and win more
                    client awards.
                  </p>
                </div>
                <Link
                  href="/creators-hub/profile"
                  className="text-xs font-semibold text-[#0f766e] hover:underline"
                >
                  Edit Profile ({data.standoutReport.score}%) →
                </Link>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e6e0d4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Available Now Live Pulse Badge (7 Days)
                    </p>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Signals instant availability on bid leaderboards + adds +10% Standout Score.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyKey === "boost:AVAILABLE_NOW"}
                    onClick={() => handleActivateBoost("AVAILABLE_NOW")}
                    className="btn-ghost px-4 py-2 text-xs font-semibold shrink-0"
                  >
                    {data.boosts.availableNowActive
                      ? "Extend (+5⚡)"
                      : `Activate (${data.boostCosts.AVAILABLE_NOW}⚡)`}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e6e0d4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#1e3a8a]" />
                      Featured Directory Spotlight &amp; Top Rated Tier (7 Days)
                    </p>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Adds +20 base rank score across all open bids &amp; spotlights your portfolio.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyKey === "boost:FEATURED_PROFILE"}
                    onClick={() => handleActivateBoost("FEATURED_PROFILE")}
                    className="btn-primary px-4 py-2 text-xs shrink-0"
                  >
                    {data.boosts.featuredProfileActive
                      ? "Extend (+15⚡)"
                      : `Activate (${data.boostCosts.FEATURED_PROFILE}⚡)`}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-white border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-amber-950 flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-700" />
                      Creator Plus Elite Pass (30 Days)
                    </p>
                    <p className="text-xs text-amber-900/80 mt-0.5">
                      Halves open-brief commission (10% → 5%), unlocks ELITE +40 rank bonus &amp; competitor bid ranges.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyKey === "boost:CREATOR_PLUS"}
                    onClick={() => handleActivateBoost("CREATOR_PLUS")}
                    className="px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 shrink-0"
                  >
                    {data.boosts.creatorPlusActive
                      ? "Extend (+60⚡)"
                      : `Unlock (${data.boostCosts.CREATOR_PLUS}⚡)`}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Connects Ledger */}
          <div className="editorial-card p-6 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-xl font-semibold">
                Connects Ledger
              </h2>
              <Link
                href="/bidding"
                className="text-xs font-semibold text-[#1e3a8a] hover:underline inline-flex items-center gap-1"
              >
                Use Connects on Live Briefs
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {data.transactions.length === 0 ? (
              <p className="text-xs text-stone-500">
                No Connects activity recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-[#e6e0d4] text-xs">
                {data.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-[#111827]">
                        {tx.description}
                      </p>
                      <p className="text-stone-500 font-tech text-[11px]">
                        {tx.type} · {formatShortDate(tx.createdAt)}
                      </p>
                    </div>
                    <div className="text-right font-tech shrink-0">
                      <p
                        className={`font-bold text-sm ${
                          tx.amount >= 0 ? "text-[#0f766e]" : "text-rose-700"
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} ⚡
                      </p>
                      <p className="text-[11px] text-stone-500">
                        Bal: {tx.balanceAfter}
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
