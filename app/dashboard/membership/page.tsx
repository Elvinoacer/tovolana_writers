"use client";

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
  formatShortDate,
} from "@/components/ui/Badges";

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
      if (!res.ok) throw new Error(j.error?.message || "Subscription failed.");
      setPendingApiRef(j.data?.transaction?.apiRef ?? null);
      setNotice("Pro membership IntaSend checkout created. Complete payment below.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate Pro payment.");
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
        setNotice("Pro Membership activated on your account!");
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
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading membership and billing records...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <Crown className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold">
            Sign in to manage Pro Membership
          </h1>
          <Link
            href="/auth?next=/dashboard/membership"
            className="inline-flex px-5 py-2.5 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold"
          >
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
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-editorial font-semibold">
            Membership & Billing
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Free plans can book every public listing. Upgrade to Pro for{" "}
            {config?.proFeeDiscountPct ?? 50}% off service fees and{" "}
            {config?.proEarlyAccessHours ?? 48}h early task access.
          </p>
        </div>
        {isPro ? (
          <ProBadge label={`Active until ${formatShortDate(user.proExpiresAt)}`} />
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-stone-200 text-stone-700">
            Current Tier: Free Plan
          </span>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          {notice}
        </div>
      )}

      {/* Upgrade Card */}
      <div className="editorial-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
          <Sparkles className="w-4 h-4" />
          <span>TOVOLANA PRO SUBSCRIPTION</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setInterval("MONTHLY")}
            className={`p-5 rounded-xl border text-left transition-all ${
              interval === "MONTHLY"
                ? "border-amber-700 bg-amber-50/70 ring-2 ring-amber-700/20"
                : "border-[#e6e0d4] bg-white"
            }`}
          >
            <p className="text-xs font-semibold text-stone-500">Monthly</p>
            <p className="font-tech text-2xl font-bold text-[#111827] mt-1">
              {formatKes(monthlyPrice, config?.currency || "KES")}
              <span className="text-xs font-normal text-stone-500"> / mo</span>
            </p>
            <p className="text-xs text-stone-600 mt-1">
              30 days of 50% service fee discount & early task discovery.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setInterval("ANNUAL")}
            className={`p-5 rounded-xl border text-left transition-all ${
              interval === "ANNUAL"
                ? "border-amber-700 bg-amber-50/70 ring-2 ring-amber-700/20"
                : "border-[#e6e0d4] bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-500">Annual</p>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                Save 2 Months
              </span>
            </div>
            <p className="font-tech text-2xl font-bold text-[#111827] mt-1">
              {formatKes(annualPrice, config?.currency || "KES")}
              <span className="text-xs font-normal text-stone-500"> / yr</span>
            </p>
            <p className="text-xs text-stone-600 mt-1">
              Full 365-day Pro privileges for regular research & business
              clients.
            </p>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setChannel("MPESA_STK")}
              className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                channel === "MPESA_STK"
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                  : "bg-white text-stone-700 border-[#e6e0d4]"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              M-Pesa
            </button>
            <button
              type="button"
              onClick={() => setChannel("CARD")}
              className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                channel === "CARD"
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                  : "bg-white text-stone-700 border-[#e6e0d4]"
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
              className="rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech"
            />
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleSubscribe}
            className="px-5 py-2.5 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 disabled:opacity-50"
          >
            {busy
              ? "Processing..."
              : isPro
                ? `Extend Pro (${interval === "ANNUAL" ? "Annual" : "Monthly"})`
                : `Upgrade to Pro (${formatKes(
                    interval === "ANNUAL" ? annualPrice : monthlyPrice
                  )})`}
          </button>
        </div>

        {pendingApiRef && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs">
              <p className="font-semibold text-amber-950">
                Pending IntaSend Ref: <code>{pendingApiRef}</code>
              </p>
              <p className="text-amber-800">
                Confirm payment immediately using Sandbox Webhook Simulator:
              </p>
            </div>
            <button
              disabled={busy}
              onClick={handleSimulateWebhookComplete}
              className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
            >
              Simulate Webhook Complete
            </button>
          </div>
        )}
      </div>

      {/* Subscriptions & Billing History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="editorial-card p-5 space-y-3">
          <h2 className="font-editorial text-lg font-semibold">
            Subscription Records
          </h2>
          {subscriptions.length === 0 ? (
            <p className="text-xs text-stone-500">No subscription history yet.</p>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3.5 rounded-lg border border-[#e6e0d4] bg-[#faf7f2] space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      PRO · {sub.planInterval} (
                      {formatKes(sub.amount, sub.currency)})
                    </span>
                    <StatusPill status={sub.status} />
                  </div>
                  <div className="flex items-center justify-between text-stone-600">
                    <span>Expires: {formatShortDate(sub.expiresAt)}</span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sub.autoRenew}
                        onChange={(e) =>
                          handleToggleAutoRenew(sub.id, e.target.checked)
                        }
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
          <h2 className="font-editorial text-lg font-semibold">
            Membership Payment Receipts
          </h2>
          {transactions.length === 0 ? (
            <p className="text-xs text-stone-500">No receipts yet.</p>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-lg border border-[#e6e0d4] flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-tech font-medium">{tx.apiRef}</p>
                    <p className="text-stone-500">
                      {tx.channel} · {formatShortDate(tx.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-tech font-bold">
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

      <div className="text-xs text-stone-500 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
        <span>
          Free plan access guarantee: canceling Pro never prevents you from
          placing standard bookings on Tovolana Writers.
        </span>
      </div>
    </main>
  );
}
