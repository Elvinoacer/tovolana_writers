"use client";

import { CustomerShell } from "@/components/CustomerShell";
import { InteractiveFeeCalculator } from "@/components/InteractiveFeeCalculator";
import { HudCard, HudPriceDock } from "@/components/ui/AuroraPrimitives";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CreditCard,
  Crown,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  ProBadge,
  StatusPill,
  formatKes,
  formatPaymentChannel,
  formatShortDate,
} from "@/components/ui/Badges";
import { NextStepBanner } from "@/components/ui/FlowGuide";

interface MembershipConfig {
  proMonthlyPrice: number;
  proAnnualPrice: number;
  proFeeDiscountPct: number;
  standardServiceFeePct: number;
  proEarlyAccessHours: number;
  currency: string;
}

interface SubscriptionRow {
  id: string;
  tier: string;
  planInterval: string;
  amount: number;
  currency: string;
  status: string;
  autoRenew: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface TransactionRow {
  id: string;
  apiRef: string;
  channel: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function CustomerMembershipPage() {
  const { user, refresh, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<MembershipConfig | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [interval, setInterval] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [channel, setChannel] = useState<"MPESA_STK" | "CARD">("MPESA_STK");
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const phone = phoneOverride ?? user?.phone ?? "";
  const setPhone = (v: string) => setPhoneOverride(v);
  const [pendingApiRef, setPendingApiRef] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/membership/subscribe", {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        setConfig(j.data?.config ?? null);
        setSubscriptions(j.data?.subscriptions ?? []);
        setTransactions(j.data?.transactions ?? []);
      }
    } finally {
      setFetched(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetch("/api/membership/subscribe", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (!active || !j?.data) return;
        setConfig(j.data.config ?? null);
        setSubscriptions(j.data.subscriptions ?? []);
        setTransactions(j.data.transactions ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setFetched(true);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const loading = authLoading || (Boolean(user) && !fetched);

  async function handleSubscribe() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/membership/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planInterval: interval,
          channel,
          phone: channel === "MPESA_STK" ? phone : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Could not start Pro checkout.");
      setPendingApiRef(j.data?.transaction?.apiRef ?? null);
      setNotice("Pro payment request sent! Finish paying below to activate Pro.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Pro payment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulateWebhookComplete() {
    if (!pendingApiRef) return;
    setBusy(true);
    try {
      const res = await fetch("/api/payments/simulate-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiRef: pendingApiRef, state: "COMPLETE" }),
      });
      if (res.ok) {
        setPendingApiRef(null);
        setNotice("Pro is now active on your account!");
        await Promise.all([refresh(), loadData()]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAutoRenew(subId: string, nextVal: boolean) {
    await fetch("/api/membership/subscribe", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: subId, autoRenew: nextVal }),
    });
    await loadData();
  }

  if (authLoading || loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading your plan details and receipts...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <Crown className="w-10 h-10 text-amber-300 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Sign in to see your Pro Plan
          </h1>
          <Link href="/auth?next=/dashboard/membership" className="btn-primary px-5 py-2.5 text-sm">
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  const isPro =
    user.membershipTier === "PRO" &&
    (!user.proExpiresAt || new Date(user.proExpiresAt) > new Date());
  const monthlyPrice = config?.proMonthlyPrice ?? 2500;
  const annualPrice = config?.proAnnualPrice ?? 24000;

  return (
    <CustomerShell
      title="Pro Plan & Receipts"
      subtitle={`Ordering stays free forever. Pro cuts service fees by ${config?.proFeeDiscountPct ?? 50}% and gives ${config?.proEarlyAccessHours ?? 48}h early access.`}
    >
      <NextStepBanner
        tone={isPro ? "emerald" : "amber"}
        eyebrow={isPro ? "Pro active" : "Free plan"}
        now={
          isPro
            ? `Your Pro plan is active until ${formatShortDate(user.proExpiresAt)}. You pay 50% less in service fees.`
            : "You are on the Free plan. You can still order any writing service anytime."
        }
        next={
          isPro
            ? "You can add another month or year anytime below, or check your receipts."
            : "Pick Monthly or Yearly below and pay via M-Pesa or Card only if you want lower fees."
        }
        goal="Save money whenever you order writing help."
      />

      {error && (
        <div className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 text-sm">
          {notice}
        </div>
      )}

      <InteractiveFeeCalculator
        standardFeePct={10}
        proDiscountPct={config?.proFeeDiscountPct ?? 50}
        monthlyProPrice={monthlyPrice}
        currency={config?.currency || "KES"}
      />

      {/* Upgrade HUD Card */}
      <HudCard theme="amber" brackets className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-tech uppercase tracking-wider font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>Tovolana Pro</span>
          </div>
          {isPro ? (
            <ProBadge label={`Active until ${formatShortDate(user.proExpiresAt)}`} />
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-tech bg-white/[0.06] text-slate-300 border border-white/[0.14]">
              Current: Free Plan
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setInterval("MONTHLY")}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-4 ${
              interval === "MONTHLY"
                ? "border-amber-400/65 bg-amber-500/15 ring-1 ring-amber-400/40"
                : "border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08]"
            }`}
          >
            <div>
              <p className="text-xs font-semibold text-slate-300">Monthly</p>
              <p className="text-xs text-slate-400 mt-1">
                30 days · 50% off fees + early access.
              </p>
            </div>
            <HudPriceDock
              label="Monthly"
              price={formatKes(monthlyPrice, config?.currency || "KES")}
              theme="amber"
              size="sm"
            />
          </button>

          <button
            type="button"
            onClick={() => setInterval("ANNUAL")}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-4 ${
              interval === "ANNUAL"
                ? "border-amber-400/65 bg-amber-500/15 ring-1 ring-amber-400/40"
                : "border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08]"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-300">Yearly</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 font-semibold">
                  Save 2 Months
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                365 days · Best deal if you order often.
              </p>
            </div>
            <HudPriceDock
              label="Yearly"
              price={formatKes(annualPrice, config?.currency || "KES")}
              theme="amber"
              size="sm"
            />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setChannel("MPESA_STK")}
              className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                channel === "MPESA_STK"
                  ? "bg-teal-500/25 text-teal-100 border-teal-400/60"
                  : "bg-white/[0.05] text-slate-300 border-white/[0.12]"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              M-Pesa
            </button>
            <button
              type="button"
              onClick={() => setChannel("CARD")}
              className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                channel === "CARD"
                  ? "bg-sky-500/25 text-sky-100 border-sky-400/60"
                  : "bg-white/[0.05] text-slate-300 border-white/[0.12]"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Card
            </button>
          </div>

          {channel === "MPESA_STK" && (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254712345678"
              className="hud-input px-3.5 py-2.5 text-sm font-tech"
            />
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleSubscribe}
            className="btn-amber px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {busy
              ? "Starting payment..."
              : isPro
                ? `Add Time (${interval === "ANNUAL" ? "Yearly" : "Monthly"})`
                : `Upgrade (${formatKes(
                    interval === "ANNUAL" ? annualPrice : monthlyPrice
                  )})`}
          </button>
        </div>

        {pendingApiRef && (
          <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs">
              <p className="font-semibold text-white">
                Waiting for Payment · Ref: <code className="text-amber-300">{pendingApiRef}</code>
              </p>
              <p className="text-amber-200/90">Test Mode (Demo only): finish this payment right away.</p>
            </div>
            <button
              disabled={busy}
              onClick={handleSimulateWebhookComplete}
              className="px-4 py-2 rounded-xl bg-emerald-400 text-slate-950 text-xs font-bold hover:bg-emerald-300"
            >
              Mark as Paid (Demo)
            </button>
          </div>
        )}
      </HudCard>

      {/* Subscriptions & Billing History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="editorial-card p-5 space-y-3">
          <h2 className="font-editorial text-lg font-semibold text-white">
            Your Pro History
          </h2>
          {subscriptions.length === 0 ? (
            <p className="text-xs text-slate-400">No Pro plans yet.</p>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3.5 rounded-xl border border-white/[0.11] bg-white/[0.045] space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      PRO · {sub.planInterval === "ANNUAL" ? "Yearly" : "Monthly"} (
                      {formatKes(sub.amount, sub.currency)})
                    </span>
                    <StatusPill status={sub.status} />
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Ends {formatShortDate(sub.expiresAt)}</span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={sub.autoRenew}
                        onChange={(e) =>
                          handleToggleAutoRenew(sub.id, e.target.checked)
                        }
                        className="accent-amber-400"
                      />
                      Auto-renew
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="editorial-card p-5 space-y-3">
          <h2 className="font-editorial text-lg font-semibold text-white">
            Receipts
          </h2>
          {transactions.length === 0 ? (
            <p className="text-xs text-slate-400">No receipts yet.</p>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl border border-white/[0.11] bg-white/[0.045] flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-tech font-medium text-white">{tx.apiRef}</p>
                    <p className="text-slate-400">
                      {formatPaymentChannel(tx.channel)} · {formatShortDate(tx.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-tech font-bold text-cyan-300">
                      {formatKes(tx.amount, tx.currency)}
                    </p>
                    <StatusPill status={tx.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-400 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <span>You can always order with a Free plan even if you stop Pro.</span>
      </div>
    </CustomerShell>
  );
}
