"use client";

import { CreatorShell } from "@/components/CreatorShell";
import { HudCard, HudPriceDock } from "@/components/ui/AuroraPrimitives";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, Wallet } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { StatusPill, formatKes, formatShortDate } from "@/components/ui/Badges";
import { NextStepBanner } from "@/components/ui/FlowGuide";

interface LedgerEntryRow {
  id: string;
  grossAmount: number;
  platformFee?: number;
  platformCut?: number;
  netAmount: number;
  status: string;
  createdAt: string;
  booking: {
    bookingRef: string;
    taskTitleSnapshot: string;
    status: string;
  };
}

interface PayoutRow {
  id: string;
  amount: number;
  currency: string;
  destinationPhone: string;
  payoutSpeed?: string;
  expressFee?: number;
  netDisbursed?: number;
  status: string;
  requestedAt: string;
}

export default function CreatorEarningsPage() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState({
    pendingEscrow: 0,
    availableBalance: 0,
    paidOutTotal: 0,
    currency: "KES",
  });
  const [ledger, setLedger] = useState<LedgerEntryRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const [payoutSpeed, setPayoutSpeed] = useState<"STANDARD" | "INSTANT_EXPRESS">(
    "STANDARD"
  );
  const phone = phoneOverride ?? user?.phone ?? "";
  const setPhone = (v: string) => setPhoneOverride(v);
  const [fetched, setFetched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEarnings = useCallback(async () => {
    try {
      const res = await fetch("/api/creators-hub/earnings", {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        setSummary(j.data.summary);
        setLedger(j.data.ledger ?? []);
        setPayouts(j.data.payouts ?? []);
      }
    } finally {
      setFetched(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetch("/api/creators-hub/earnings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (!active || !j?.data) return;
        setSummary(j.data.summary);
        setLedger(j.data.ledger ?? []);
        setPayouts(j.data.payouts ?? []);
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

  async function handleRequestPayout(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/creators-hub/earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationPhone: phone, payoutSpeed }),
      });
      const j = await res.json();
      if (!res.ok)
        throw new Error(j.error?.message || "Payout request failed.");
      setNotice(
        payoutSpeed === "INSTANT_EXPRESS"
          ? "Instant M-Pesa payout sent!"
          : "Free M-Pesa payout requested (3–5 business days)."
      );
      await loadEarnings();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send payout request."
      );
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading your earnings...
        </div>
      </main>
    );
  }

  if (!user || !user.roles.includes("CREATOR")) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <HudCard theme="cyan" brackets className="p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Writer access needed
          </h1>
          <Link
            href="/creators-hub"
            className="btn-creator inline-flex px-5 py-2.5 text-sm font-semibold"
          >
            Writer Hub
          </Link>
        </HudCard>
      </main>
    );
  }

  const totalFlow =
    summary.pendingEscrow + summary.availableBalance + summary.paidOutTotal;
  const escrowPct =
    totalFlow > 0 ? Math.round((summary.pendingEscrow / totalFlow) * 100) : 0;
  const readyPct =
    totalFlow > 0
      ? Math.round((summary.availableBalance / totalFlow) * 100)
      : 0;
  const paidPct = Math.max(0, 100 - escrowPct - readyPct);

  return (
    <CreatorShell
      title="Earnings & Payouts"
      subtitle="See money held on active orders, ready to withdraw, and sent to M-Pesa."
    >
      <NextStepBanner
        tone={
          summary.availableBalance >= 100
            ? "emerald"
            : summary.pendingEscrow > 0
              ? "teal"
              : "stone"
        }
        eyebrow={
          summary.availableBalance >= 100
            ? "Ready to withdraw"
            : summary.pendingEscrow > 0
              ? "Orders in progress"
              : "How payouts work"
        }
        now={
          summary.availableBalance >= 100
            ? `You have ${formatKes(summary.availableBalance, summary.currency)} ready to send to your M-Pesa phone.`
            : summary.pendingEscrow > 0
              ? `You have ${formatKes(summary.pendingEscrow, summary.currency)} waiting on client approval before you can withdraw it.`
              : "You do not have money ready to withdraw right now."
        }
        next={
          summary.availableBalance >= 100
            ? "Choose Free (3–5 days) or Instant M-Pesa below, check your phone number, and click Withdraw."
            : summary.pendingEscrow > 0
              ? "Finish and deliver your active orders so clients can approve them."
              : "Complete client orders from Writer Hub or Open Jobs to build your balance."
        }
        goal="Get paid straight to M-Pesa whenever your balance is KES 100 or more."
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

      {/* Where Your Money Is */}
      <HudCard
        theme="emerald"
        brackets
        microLabel="CREATOR LEDGER OVERVIEW"
        className="p-6 space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-tech uppercase tracking-wider text-slate-400 font-semibold">
            Where Your Money Is
          </span>
          <span className="font-tech text-xs text-teal-300 font-semibold">
            Total Earned: {formatKes(totalFlow, summary.currency)}
          </span>
        </div>

        <div className="h-3 rounded-full bg-white/10 overflow-hidden flex">
          {escrowPct > 0 && (
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${escrowPct}%` }}
            />
          )}
          {readyPct > 0 && (
            <div
              className="h-full bg-teal-400 transition-all duration-500"
              style={{ width: `${readyPct}%` }}
            />
          )}
          {paidPct > 0 && (
            <div
              className="h-full bg-sky-400 transition-all duration-500"
              style={{ width: `${paidPct}%` }}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <HudPriceDock
            label="1. HELD UNTIL APPROVED"
            price={formatKes(summary.pendingEscrow, summary.currency)}
            theme="amber"
            size="md"
            className="w-full"
          />
          <HudPriceDock
            label="2. READY TO WITHDRAW"
            price={formatKes(summary.availableBalance, summary.currency)}
            theme="emerald"
            size="md"
            className="w-full"
          />
          <HudPriceDock
            label="3. SENT TO M-PESA"
            price={formatKes(summary.paidOutTotal, summary.currency)}
            theme="sky"
            size="md"
            className="w-full"
          />
        </div>
      </HudCard>

      <HudCard theme="cyan" className="p-6">
        <form onSubmit={handleRequestPayout} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPayoutSpeed("STANDARD")}
              className={`text-left p-4 rounded-xl border transition-all ${
                payoutSpeed === "STANDARD"
                  ? "border-teal-400/55 bg-teal-500/15"
                  : "border-white/[0.11] bg-white/[0.04] hover:bg-white/[0.07]"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-white">Free M-Pesa Payout</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-emerald-200 font-tech">
                  Free
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Arrives in 3–5 business days · you keep 100%
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPayoutSpeed("INSTANT_EXPRESS")}
              className={`text-left p-4 rounded-xl border transition-all ${
                payoutSpeed === "INSTANT_EXPRESS"
                  ? "border-amber-400/55 bg-amber-500/15"
                  : "border-white/[0.11] bg-white/[0.04] hover:bg-white/[0.07]"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-white">Instant M-Pesa Payout</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/35 text-amber-200 font-tech">
                  2.5% fee (min KES 50)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Sent right away · You receive{" "}
                <span className="font-tech font-semibold text-white">
                  {formatKes(
                    Math.max(
                      0,
                      summary.availableBalance -
                        (summary.availableBalance > 0
                          ? Math.max(
                              50,
                              Math.round(summary.availableBalance * 0.025)
                            )
                          : 0)
                    ),
                    summary.currency
                  )}
                </span>
              </p>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                Your M-Pesa Phone Number (Min KES 100)
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254712345678"
                className="hud-input font-tech"
              />
            </div>
            <button
              type="submit"
              disabled={busy || summary.availableBalance < 100}
              className="btn-creator px-6 py-2.5 text-sm gap-2 disabled:opacity-50"
            >
              <ArrowDownRight className="w-4 h-4" />
              {payoutSpeed === "INSTANT_EXPRESS"
                ? `Withdraw Instantly ${formatKes(
                    Math.max(
                      0,
                      summary.availableBalance -
                        (summary.availableBalance > 0
                          ? Math.max(
                              50,
                              Math.round(summary.availableBalance * 0.025)
                            )
                          : 0)
                    ),
                    summary.currency
                  )}`
                : `Withdraw ${formatKes(summary.availableBalance, summary.currency)}`}
            </button>
          </div>
        </form>
      </HudCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="editorial-card p-5 space-y-3">
          <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-teal-300" />
            Order Earnings
          </h2>
          {ledger.length === 0 ? (
            <p className="text-xs text-slate-400">No earnings recorded yet.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {ledger.map((e) => (
                <div
                  key={e.id}
                  className="p-3.5 rounded-xl bg-white/[0.045] border border-white/[0.11] flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-tech font-medium text-white">
                      {e.booking.bookingRef}
                    </p>
                    <p className="text-slate-300 line-clamp-1">
                      {e.booking.taskTitleSnapshot}
                    </p>
                    <p className="text-slate-400">
                      Order {formatKes(e.grossAmount)} · Fee{" "}
                      {formatKes(e.platformFee ?? e.platformCut ?? 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">You keep</p>
                    <p className="font-tech font-bold text-teal-300">
                      {formatKes(e.netAmount)}
                    </p>
                    <StatusPill status={e.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="editorial-card p-5 space-y-3">
          <h2 className="font-editorial text-lg font-semibold text-white">
            Payout History
          </h2>
          {payouts.length === 0 ? (
            <p className="text-xs text-slate-400">No payouts requested yet.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-white/[0.045] border border-white/[0.11] flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-tech font-medium text-white">
                        {p.destinationPhone}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          p.payoutSpeed === "INSTANT_EXPRESS"
                            ? "bg-amber-500/20 text-amber-200 border-amber-400/35"
                            : "bg-white/[0.08] text-slate-200 border-white/[0.14]"
                        }`}
                      >
                        {p.payoutSpeed === "INSTANT_EXPRESS"
                          ? "Instant"
                          : "Free"}
                      </span>
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      {formatShortDate(p.requestedAt)}
                      {typeof p.expressFee === "number" && p.expressFee > 0
                        ? ` · Fee ${formatKes(p.expressFee, p.currency)}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-tech font-bold text-white">
                      {formatKes(p.netDisbursed ?? p.amount, p.currency)}
                    </p>
                    {p.netDisbursed !== undefined &&
                      p.netDisbursed !== p.amount && (
                        <p className="text-[10px] text-slate-400 font-tech">
                          Before fee {formatKes(p.amount, p.currency)}
                        </p>
                      )}
                    <StatusPill status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CreatorShell>
  );
}
